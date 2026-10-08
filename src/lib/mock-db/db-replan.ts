import { expandPackages } from '@/domain/cargo'
import { restingOnIds } from '@/domain/constraints'
import type { CargoPackage, PackagePlacement } from '@/domain/models'
import { found, put, type DbContext } from './db-context'
import { movePackage } from './db-packages'
import { labelsOf } from './db-scans'
import { setTripLinks, stopDemandsOf, tripLinks } from './db-trip-lines'
import { settleSegregation } from './db-trip-segregation'
import type { PackageFlag } from './package-model'
import { withFreshRoute } from './trip-route'
import { pruneGeneratedStops, withStopDemands } from './trip-stops'
import type { ReplanReason, Trip } from './types'

/**
 * Chuyển ngược `LOADING → PLANNED` (PRD v2 mục 7.1, D-82, D-91): một kiện của chuyến đang xếp bị bỏ hẳn khỏi chuyến — kiện thiếu lúc
 * soạn (cờ `NOT_FOUND`), hoặc kiện hỏng lúc xếp mà trong phương án có kiện tựa lên nó (cờ `DAMAGED`).
 *
 * - Kiện về `IMPORTED` kèm cờ (D-92), vẫn do yêu cầu giao của nó giữ nên yêu cầu đó đọc ra "giao thiếu".
 * - Dòng kiện của nó bớt một (hết kiện thì bỏ dòng; điểm tự sinh hết dòng kiện tự mất), chuyến tăng `inputVersion`: phương án lỗi thời,
 *   điều phối viên tối ưu lại và duyệt.
 * - Chuyến về pha `planning`, bỏ tiến độ xếp và các lần đối chiếu của phiên vừa rồi (mã instance của dòng đã đổi), ghi `replan` để kho
 *   biết đang chờ gì. Kiện đã soạn giữ `STAGED` — bắt đầu lại thì chúng vẫn tính là đã soạn; kiện đã lên xe cũng còn `STAGED` (trạng
 *   thái `LOADED` chỉ ghi lúc xếp xong), kho dỡ ra xếp lại theo phương án mới.
 *
 * Báo thiếu khác còn mở của phiên bị đóng theo: kiện đó vẫn chưa soạn, kho báo lại khi soạn tiếp.
 *
 * Kiện hỏng lúc xếp (FE-BL-02): chỗ của các kiện kho đã xếp lên xe được giữ trong `replan.keep` để điều phối viên tối ưu lại mà ghim
 * chúng tại chỗ (`keptLoaded`), thay vì dỡ cả xe.
 */
export function returnToPlanning(ctx: DbContext, trip: Trip, packageInstanceId: string, flag: PackageFlag, reason: ReplanReason): Trip {
  const label = labelsOf(ctx, trip).find((item) => item.packageInstanceId === packageInstanceId)
  const line = trip.packages.find((item) => item.id === label?.packageId)
  if (!label || !line) throw new Error(`Chuyến ${trip.id} không có kiện kho kiện cho ${packageInstanceId}`)
  const pkg = found(ctx.state.packages, 'packages', label.poolPackageId)
  const links = tripLinks(ctx, trip.id)
  // Liên kết đang có hiệu lực của dòng: đủ số kiện như số lượng của dòng (liên kết lệch số lượng đã mất hiệu lực, `lineInstances`)
  const link = links.find((item) => item.lineId === line.id && item.packageIds.length === line.quantity && item.packageIds.includes(pkg.id))
  if (!link) throw new Error(`Chuyến ${trip.id} không có liên kết dòng kiện cho ${packageInstanceId}`)
  const packageIds = link.packageIds.filter((id) => id !== pkg.id)
  setTripLinks(ctx, trip.id, links.flatMap((item) => (item !== link ? [item] : packageIds.length === 0 ? [] : [{ ...item, packageIds }])))
  const lines = packageIds.length === 0
    ? trip.packages.filter((item) => item.id !== line.id)
    : trip.packages.map((item) => (item.id === line.id ? { ...item, quantity: packageIds.length } : item))
  const pruned = pruneGeneratedStops(trip.stops, lines)
  const packagesLeft = [...pruned.packages]
  const stops = withStopDemands(pruned.stops, stopDemandsOf(ctx, { id: trip.id, packages: packagesLeft }))
  const unload = trip.loading?.steps.some((step) => step.outcome === 'loaded') ?? false
  const plan = trip.loading === undefined ? undefined : ctx.state.revisions.get(trip.loading.revisionId)
  const loaded = new Set(trip.loading?.steps.filter((step) => step.outcome === 'loaded').map((step) => step.packageInstanceId))
  const carried = reason === 'DAMAGED' && plan !== undefined ? keptLoaded(plan.result.placements, loaded, line, packageInstanceId, packageIds.length) : {}
  const { loading: _loading, verifications: _verifications, ...rest } = trip
  const settled = settleSegregation(ctx, trip, { ...rest, stops, packages: packagesLeft, inputVersion: trip.inputVersion + 1 })
  const stored = put(ctx.state.trips, withFreshRoute({ ...settled, phase: 'planning', replan: { reason, at: ctx.nowIso(), unload, ...carried } }))
  movePackage(ctx, pkg, 'IMPORTED', { flags: [...new Set([...pkg.flags, flag])] })
  return stored
}

/**
 * Chỗ của các kiện đã xếp lên xe trong phiên xếp của `trip` (FE-BL-02), để ghim lại sau khi kiện hỏng đưa chuyến về Đã lập kế hoạch.
 * Lấy từ phương án kho đã xếp theo; vẫn là chỗ vật lý của kiện, nên giữ nguyên toạ độ và hướng.
 * - Có kiện đã xếp tựa lên kiện hỏng (`restingOnIds`): chỗ đó trống ra, kiện kia lơ lửng — không giữ được, trả `blocked` (mã trong
 *   phương án cũ) và không có `keep`.
 * - Dòng kiện của kiện hỏng bớt một kiện nên mã instance của nó đánh số lại: các kiện cùng dòng giống hệt nhau, nên kiện đã xếp thứ i
 *   của dòng nhận mã thứ i của dòng mới. Dòng khác giữ nguyên mã.
 * Chưa kiện nào lên xe thì không có gì để giữ.
 */
export function keptLoaded(
  placements: readonly PackagePlacement[],
  loaded: ReadonlySet<string>,
  line: CargoPackage,
  damagedId: string,
  newQuantity: number,
): Pick<NonNullable<Trip['replan']>, 'keep' | 'blocked'> {
  if (loaded.size === 0) return {}
  const blocked = restingOnIds(placements, damagedId).filter((id) => loaded.has(id))
  if (blocked.length > 0) return { blocked }
  const idsOf = (quantity: number) => expandPackages([{ ...line, quantity }]).instances.map(({ packageInstanceId }) => packageInstanceId)
  const renamed = new Map(idsOf(line.quantity).filter((id) => loaded.has(id)).map((id, index): [string, string] => [id, idsOf(newQuantity)[index] as string]))
  const keep = placements.filter(({ packageInstanceId }) => loaded.has(packageInstanceId))
    .map((placement): PackagePlacement => ({ ...placement, packageInstanceId: renamed.get(placement.packageInstanceId) ?? placement.packageInstanceId, pinned: true }))
  return keep.length > 0 ? { keep } : {}
}
