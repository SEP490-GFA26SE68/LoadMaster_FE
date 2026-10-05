import type { DbContext } from './db-context'
import { movePackage } from './db-packages'
import { tripLinks } from './db-trip-lines'
import type { Package, PackageStatus } from './package-model'
import { lineInstances } from './review1-status'
import type { Trip } from './types'

/**
 * Trạng thái kiện kho kiện đi theo chuyến (FE-3b-01, D-70): mỗi mốc của chuyến ghi trạng thái cho các kiện của chuyến qua
 * `movePackage`, không suy lúc đọc.
 *
 * - kho soạn một kiện (FE-6-02) → `STAGED` ngay lúc đối chiếu bằng nhãn; soạn bằng xác nhận tay thì khi điều phối viên duyệt
 *   (`db-staging.ts`, `db-manual-confirm.ts`). Kiện bị bỏ lúc soạn (thiếu) hoặc lúc xếp (hỏng) về `IMPORTED` kèm cờ (D-92) ở đó;
 * - kho xếp xong → kiện đã lên xe `LOADED` — ghi ở **mốc chốt**, vì kết quả xếp của một kiện còn bị gỡ khi xác nhận tay bị từ chối;
 * - xe xuất phát → `IN_TRANSIT`;
 * - hoàn tất một điểm giao → kiện đã dỡ `DELIVERED`, kiện của điểm đó ở lại xe (khách từ chối, sự cố khác) `RETURNED` — cũng ở mốc
 *   chốt, cùng lý do;
 * - huỷ chuyến trước khi xe chạy → về `IMPORTED` (yêu cầu giao của chuyến về `PENDING`, `db-requirement-trips.ts`);
 * - huỷ chuyến Đang vận chuyển → kiện chưa giao `RETURNED`, yêu cầu giao của chúng đọc là giao thiếu (D-91, D-92).
 *
 * Kiện nối với instance của chuyến qua yêu cầu giao, hoặc là kiện thêm ngay trong chuyến (`lineInstances`, FE-3b-07); dòng của yêu cầu
 * bị sửa số lượng sau khi vào chuyến thì kiện của yêu cầu mất liên kết và đứng yên ở trạng thái đang có.
 */

type Linked = { pkg: Package; instanceId: string | undefined }

function tripPackages(ctx: DbContext, trip: Trip): Linked[] {
  const instanceOf = lineInstances(tripLinks(ctx, trip.id), trip)
  return [...ctx.state.packages.values()].filter((pkg) => pkg.tripId === trip.id).map((pkg) => ({ pkg, instanceId: instanceOf.get(pkg.id) }))
}

function moveAll(ctx: DbContext, trip: Trip, from: PackageStatus, to: PackageStatus) {
  for (const { pkg } of tripPackages(ctx, trip)) if (pkg.status === from) movePackage(ctx, pkg, to)
}

/** Kiện của các instance `instanceIds` sang `STAGED` — dựng seed theo tiến độ soạn đã có (`seed-trip-pool.ts`). */
export function stageInstances(ctx: DbContext, trip: Trip, instanceIds: ReadonlySet<string>) {
  for (const { pkg, instanceId } of tripPackages(ctx, trip)) {
    if (pkg.status === 'ASSIGNED' && instanceId !== undefined && instanceIds.has(instanceId)) movePackage(ctx, pkg, 'STAGED')
  }
}

/** Kiện của instance `instanceId` hỏng lúc xếp, bị bỏ lại kho: về `IMPORTED` kèm cờ `DAMAGED` (D-92) — dựng seed. */
export function dropDamagedInstance(ctx: DbContext, trip: Trip, instanceId: string) {
  for (const { pkg, instanceId: id } of tripPackages(ctx, trip)) {
    if (id === instanceId && pkg.status === 'STAGED') movePackage(ctx, pkg, 'IMPORTED', { flags: [...new Set([...pkg.flags, 'DAMAGED' as const])] })
  }
}

/** Kho xếp xong: `trip` đã có đủ kết quả từng bước xếp. */
export function settleLoadedPackages(ctx: DbContext, trip: Trip) {
  const loaded = new Set(trip.loading?.steps.filter((step) => step.outcome === 'loaded').map((step) => step.packageInstanceId))
  for (const { pkg, instanceId } of tripPackages(ctx, trip)) {
    if (pkg.status === 'STAGED' && instanceId !== undefined && loaded.has(instanceId)) movePackage(ctx, pkg, 'LOADED')
  }
}

/** Xe xuất phát. */
export function departTripPackages(ctx: DbContext, trip: Trip) {
  moveAll(ctx, trip, 'LOADED', 'IN_TRANSIT')
}

/** Hoàn tất điểm giao `stopNumber`: `trip` đã có danh sách kiện dỡ ở điểm đó. */
export function settleStopPackages(ctx: DbContext, trip: Trip, stopNumber: number) {
  const stopId = trip.stops[stopNumber - 1]?.id
  const unloaded = new Set(trip.delivery?.stops.find((stop) => stop.number === stopNumber)?.unloadedIds)
  for (const { pkg, instanceId } of tripPackages(ctx, trip)) {
    if (pkg.status !== 'IN_TRANSIT' || pkg.stopId !== stopId || instanceId === undefined) continue
    movePackage(ctx, pkg, unloaded.has(instanceId) ? 'DELIVERED' : 'RETURNED')
  }
}

/**
 * Huỷ chuyến Đang vận chuyển (FE-6-07, D-91): kiện chưa giao — còn `IN_TRANSIT`, kể cả kiện đã dỡ ở điểm chưa hoàn tất — thành
 * `RETURNED` và ở lại chuyến. Trả số kiện vừa hoàn trả.
 */
export function returnUndeliveredPackages(ctx: DbContext, trip: Trip): number {
  const undelivered = tripPackages(ctx, trip).filter(({ pkg }) => pkg.status === 'IN_TRANSIT')
  for (const { pkg } of undelivered) movePackage(ctx, pkg, 'RETURNED')
  return undelivered.length
}

/** Huỷ chuyến trước khi xe chạy: kiện rời chuyến, về kho kiện. */
export function releaseTripPackages(ctx: DbContext, trip: Trip) {
  for (const { pkg } of tripPackages(ctx, trip)) if (pkg.status !== 'IMPORTED') movePackage(ctx, pkg, 'IMPORTED')
}
