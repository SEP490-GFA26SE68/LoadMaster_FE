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
  const { loading: _loading, verifications: _verifications, ...rest } = trip
  const settled = settleSegregation(ctx, trip, { ...rest, stops, packages: packagesLeft, inputVersion: trip.inputVersion + 1 })
  const stored = put(ctx.state.trips, withFreshRoute({ ...settled, phase: 'planning', replan: { reason, at: ctx.nowIso(), unload } }))
  movePackage(ctx, pkg, 'IMPORTED', { flags: [...new Set([...pkg.flags, flag])] })
  return stored
}
