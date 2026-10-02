import type { DbContext } from './db-context'
import { movePackage } from './db-packages'
import { missingIds } from './operations'
import type { Package, PackageStatus } from './package-model'
import { assignmentInstances } from './review1-status'
import type { Trip } from './types'

/**
 * Trạng thái kiện kho kiện đi theo chuyến (FE-3b-01, D-70): mỗi mốc của chuyến ghi trạng thái cho các kiện của chuyến qua
 * `movePackage`, không suy lúc đọc. Ghi ở **mốc chốt** của chuyến chứ không theo từng lần bấm, vì bước xếp và ô đánh dấu dỡ còn sửa lại
 * được cho tới lúc chốt:
 *
 * - kho bắt đầu xếp → `STAGED` *(tạm, tới khi có bước Soạn hàng quét từng kiện vào khu chờ)*;
 * - kho xếp xong → kiện đã lên xe `LOADED`; kiện báo thiếu về `IMPORTED` kèm cờ `NOT_FOUND` (D-92), vẫn do đơn của nó giữ;
 * - xe xuất phát → `IN_TRANSIT`;
 * - hoàn tất một điểm giao → kiện đã dỡ `DELIVERED`, kiện của điểm đó không dỡ được (có sự cố) `RETURNED`;
 * - huỷ chuyến trước khi xe chạy → về `IMPORTED`.
 *
 * Kiện nối với instance của chuyến qua đơn hàng (`assignmentInstances`); dòng kiện bị sửa số lượng sau khi gán thì mất liên kết và
 * kiện của dòng đó đứng yên ở trạng thái đang có.
 */

type Linked = { pkg: Package; instanceId: string | undefined }

function tripPackages(ctx: DbContext, trip: Trip): Linked[] {
  const instanceOf = new Map<string, string>()
  for (const order of ctx.state.orders.values()) {
    if (order.assignment?.tripId !== trip.id) continue
    for (const [packageId, instanceId] of assignmentInstances(order, trip)) instanceOf.set(packageId, instanceId)
  }
  return [...ctx.state.packages.values()].filter((pkg) => pkg.tripId === trip.id).map((pkg) => ({ pkg, instanceId: instanceOf.get(pkg.id) }))
}

function moveAll(ctx: DbContext, trip: Trip, from: PackageStatus, to: PackageStatus) {
  for (const { pkg } of tripPackages(ctx, trip)) if (pkg.status === from) movePackage(ctx, pkg, to)
}

/** Kho bắt đầu xếp. */
export function stageTripPackages(ctx: DbContext, trip: Trip) {
  moveAll(ctx, trip, 'ASSIGNED', 'STAGED')
}

/** Kho xếp xong: `trip` đã có đủ kết quả từng bước xếp. */
export function settleLoadedPackages(ctx: DbContext, trip: Trip) {
  const loaded = new Set(trip.loading?.steps.filter((step) => step.outcome === 'loaded').map((step) => step.packageInstanceId))
  const missing = missingIds(trip)
  for (const { pkg, instanceId } of tripPackages(ctx, trip)) {
    if (pkg.status !== 'STAGED' || instanceId === undefined) continue
    if (loaded.has(instanceId)) movePackage(ctx, pkg, 'LOADED')
    else if (missing.has(instanceId)) movePackage(ctx, pkg, 'IMPORTED', { flags: [...new Set([...pkg.flags, 'NOT_FOUND' as const])] })
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

/** Huỷ chuyến trước khi xe chạy: kiện rời chuyến, về kho kiện. */
export function releaseTripPackages(ctx: DbContext, trip: Trip) {
  for (const { pkg } of tripPackages(ctx, trip)) if (pkg.status !== 'IMPORTED') movePackage(ctx, pkg, 'IMPORTED')
}
