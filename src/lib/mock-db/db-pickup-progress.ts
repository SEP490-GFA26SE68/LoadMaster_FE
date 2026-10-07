import { put, type DbContext } from './db-context'
import { movePackage } from './db-packages'
import { MockDbError } from './errors'
import type { Package } from './package-model'
import type { PickupRequest } from './pickup-model'
import type { TripLabel } from './source-types'
import type { StopProgress, Trip } from './types'

/**
 * Tiến độ nhận và giao kiện nhận dọc đường (FE-7-05, D-88). Kiện nhận không có dòng kiện trong chuyến nên **mã kiện kho kiện** (`PK-NNNN`)
 * đóng vai mã instance ở mọi chỗ kho ghi tiến độ: nhãn của chuyến, lần đối chiếu, `StopProgress.pickedIds` (kiện đã đối chiếu ở điểm nhận)
 * và `unloadedIds` (kiện đã dỡ ở điểm giao, như kiện thường). Vai trò của một kiện tại một điểm suy từ yêu cầu của nó:
 *
 * - `pick`: điểm là điểm nhận của yêu cầu và yêu cầu còn `APPROVED` — tài xế đối chiếu kiện lên xe (`LOADED`);
 * - `deliver`: điểm là điểm giao và yêu cầu đã `LOADED` — tài xế dỡ như kiện thường (`DELIVERED`).
 *
 * Hoàn tất điểm nhận: kiện `IN_TRANSIT`, yêu cầu `LOADED`. Hoàn tất điểm giao: kiện đã dỡ `DELIVERED`, còn lại `RETURNED`; mọi kiện của
 * yêu cầu đã giao thì yêu cầu `DELIVERED`. Kiện nhận chưa có vị trí 3D (P2) nên không có trong phương án, không có thứ tự dỡ.
 */

export type PickupRole = 'pick' | 'deliver'

/** Một kiện nhận cùng yêu cầu của nó. */
export type PickupEntry = { request: PickupRequest; pkg: Package }

/** Yêu cầu đã duyệt trở đi (có kiện kho kiện). */
const HAS_PACKAGES = new Set(['APPROVED', 'LOADED', 'DELIVERED'])

/** Kiện nhận của mọi yêu cầu đã duyệt của chuyến, theo thứ tự yêu cầu rồi thứ tự kiện trong yêu cầu. */
export function pickupEntries(ctx: DbContext, tripId: string): PickupEntry[] {
  return [...ctx.state.pickups.values()]
    .filter((request) => request.tripId === tripId && HAS_PACKAGES.has(request.status))
    .flatMap((request) => (request.packageIds ?? []).flatMap((id) => {
      const pkg = ctx.state.packages.get(id)
      return pkg === undefined ? [] : [{ request, pkg }]
    }))
}

/** Vai trò của kiện tại điểm `stopId`; `undefined` khi kiện không phải việc của điểm này (lúc này). */
export function pickupRoleAt({ request }: PickupEntry, stopId: string): PickupRole | undefined {
  if (request.status === 'APPROVED' && request.pickupStopId === stopId) return 'pick'
  if (request.status === 'LOADED' && request.deliveryStopId === stopId) return 'deliver'
  return undefined
}

/** Kiện nhận phải xử lý ở điểm `stopId`, kèm vai trò. */
export function pickupDutiesAt(ctx: DbContext, trip: Trip, stopId: string): (PickupEntry & { role: PickupRole })[] {
  return pickupEntries(ctx, trip.id).flatMap((entry) => {
    const role = pickupRoleAt(entry, stopId)
    return role === undefined ? [] : [{ ...entry, role }]
  })
}

/** Kiện nhận mang mã `id` của chuyến, nếu `id` là mã một kiện nhận. */
export function pickupEntryOf(ctx: DbContext, trip: Trip, id: string): PickupEntry | undefined {
  return pickupEntries(ctx, trip.id).find(({ pkg }) => pkg.id === id)
}

/** Nhãn QR của kiện nhận: mã kiện kho kiện làm mã instance; số điểm là số điểm giao hiện tại của kiện. */
export function pickupLabels(ctx: DbContext, trip: Trip): TripLabel[] {
  return pickupEntries(ctx, trip.id).map(({ request, pkg }) => ({
    packageInstanceId: pkg.id,
    packageId: pkg.id,
    name: pkg.packageCode,
    deliveryStop: trip.stops.findIndex((stop) => stop.id === request.deliveryStopId) + 1,
    qrToken: pkg.qrToken,
    poolPackageId: pkg.id,
    packageCode: pkg.packageCode,
  }))
}

/**
 * Kiện nhận quét ở điểm không phải việc của nó: `QR_WRONG_STOP` kèm số điểm đúng — điểm giao nếu kiện đã lên xe, không thì điểm nhận.
 */
export function pickupWrongStop(trip: Trip, entry: PickupEntry): MockDbError {
  const { request, pkg } = entry
  if (request.status === 'LOADED') {
    return new MockDbError('QR_WRONG_STOP', { packageInstanceId: pkg.id, stopNumber: trip.stops.findIndex((stop) => stop.id === request.deliveryStopId) + 1 })
  }
  return new MockDbError('QR_WRONG_STOP', { packageInstanceId: pkg.id, stopNumber: trip.stops.findIndex((stop) => stop.id === request.pickupStopId) + 1 })
}

/** Kiện nhận đã xong việc của điểm: đã đối chiếu ở điểm nhận, hoặc đã dỡ ở điểm giao. */
export function pickupDone(progress: Pick<StopProgress, 'pickedIds' | 'unloadedIds'> | undefined, role: PickupRole, id: string): boolean {
  return (role === 'pick' ? progress?.pickedIds : progress?.unloadedIds)?.includes(id) ?? false
}

/**
 * Hoàn tất điểm `stopNumber` (đã qua kiểm tra đủ kiện, hết xác nhận tay chờ): kiện nhận của điểm nhận sang `IN_TRANSIT` và yêu cầu `LOADED`;
 * kiện của điểm giao sang `DELIVERED` (đã dỡ) hoặc `RETURNED`, và yêu cầu `DELIVERED` khi mọi kiện của nó đã giao. `duties` tính **trước**
 * khi hàm này đổi trạng thái yêu cầu.
 */
export function settlePickupStop(ctx: DbContext, trip: Trip, stopNumber: number, duties: readonly (PickupEntry & { role: PickupRole })[]) {
  const progress = trip.delivery?.stops.find((stop) => stop.number === stopNumber)
  const { pickups, packages } = ctx.state
  const touched = new Set<string>()
  for (const { request, pkg, role } of duties) {
    const current = packages.get(pkg.id)
    if (!current) continue
    if (role === 'pick' && current.status === 'LOADED') movePackage(ctx, current, 'IN_TRANSIT')
    if (role === 'deliver' && current.status === 'IN_TRANSIT') movePackage(ctx, current, pickupDone(progress, 'deliver', pkg.id) ? 'DELIVERED' : 'RETURNED')
    touched.add(request.id)
  }
  for (const id of touched) {
    const request = pickups.get(id)
    if (!request) continue
    const members = (request.packageIds ?? []).map((packageId) => packages.get(packageId))
    if (request.status === 'APPROVED' && members.every((pkg) => pkg?.status === 'IN_TRANSIT')) {
      put(pickups, { ...request, status: 'LOADED', loadedAt: ctx.nowIso() })
      ctx.log('pickup.loaded', { type: 'trip', id: trip.id }, { pickupId: id, count: members.length })
    } else if (request.status === 'LOADED' && members.every((pkg) => pkg?.status === 'DELIVERED')) {
      put(pickups, { ...request, status: 'DELIVERED', deliveredAt: ctx.nowIso() })
      ctx.log('pickup.delivered', { type: 'trip', id: trip.id }, { pickupId: id, count: members.length })
    }
  }
}
