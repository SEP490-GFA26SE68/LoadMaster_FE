import { put, type DbContext } from './db-context'
import { movePackage } from './db-packages'
import { pickupRoleAt, pickupWrongStop, type PickupEntry } from './db-pickup-progress'
import type { Trip } from './types'
import { withVerification, type ManualConfirm, type PackageVerification, type VerifyMethod } from './verify-model'

/**
 * Ghi một lần đối chiếu **kiện nhận dọc đường** ở điểm `stopNumber` (FE-7-05) — dùng chung cho quét / gõ mã (`confirmUnloadByQr`) và xác
 * nhận tay (`confirmUnloadManually`) của tài xế: vai trò của kiện tại điểm quyết định ghi vào đâu. Điểm nhận (`pick`): kiện vào
 * `StopProgress.pickedIds`, lần đối chiếu thuộc bước `PICKUP`, và kiện sang `LOADED` ngay nếu đối chiếu bằng nhãn — xác nhận tay thì khi điều
 * phối viên duyệt (`approveManualConfirmation`), như bước soạn. Điểm giao (`deliver`): kiện vào `unloadedIds` như kiện thường, bước `UNLOADING`.
 * Kiện không phải việc của điểm này: `QR_WRONG_STOP` kèm số điểm đúng. Trả chuyến đã ghi và lần đối chiếu (chưa có mã `VF-NNN`).
 */
export function recordPickupItem(
  ctx: DbContext, trip: Trip, stopNumber: number, entry: PickupEntry, method: VerifyMethod, manual?: ManualConfirm,
): { trip: Trip; verification: Omit<PackageVerification, 'id'> } {
  const stopId = trip.stops[stopNumber - 1]?.id ?? ''
  const role = pickupRoleAt(entry, stopId)
  if (role === undefined) throw pickupWrongStop(trip, entry)
  const delivery = trip.delivery
  if (!delivery) throw new Error(`Chuyến ${trip.id} đang giao nhưng không có tiến độ giao`)
  const id = entry.pkg.id
  const verification: Omit<PackageVerification, 'id'> = {
    context: role === 'pick' ? 'PICKUP' : 'UNLOADING', stopNumber, packageInstanceId: id, method,
    at: ctx.nowIso(), by: ctx.state.session.userId, ...(manual === undefined ? {} : { manual }),
  }
  const stops = delivery.stops.map((stop) => {
    if (stop.number !== stopNumber) return stop
    if (role === 'pick') return { ...stop, pickedIds: [...(stop.pickedIds ?? []).filter((item) => item !== id), id] }
    // Xác nhận tay không phải đối chiếu bằng nhãn: kiện rời `qrConfirmedIds` nếu trước đó từng được quét
    const confirmed = (stop.qrConfirmedIds ?? []).filter((item) => item !== id)
    return { ...stop, unloadedIds: [...stop.unloadedIds.filter((item) => item !== id), id], qrConfirmedIds: manual === undefined ? [...confirmed, id] : confirmed }
  })
  if (role === 'pick' && manual === undefined && entry.pkg.status === 'ASSIGNED') movePackage(ctx, entry.pkg, 'LOADED')
  const stored = put(ctx.state.trips, { ...trip, delivery: { ...delivery, stops }, verifications: withVerification(trip.verifications, verification) })
  return { trip: stored, verification }
}
