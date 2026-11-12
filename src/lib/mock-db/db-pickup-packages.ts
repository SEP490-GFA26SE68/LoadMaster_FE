import { nextId, put, type DbContext } from './db-context'
import type { Package } from './package-model'
import type { PickupRequest } from './pickup-model'
import type { Trip } from './types'

/**
 * Kiện nhận dọc đường vào kho kiện khi yêu cầu được duyệt (FE-7-04, D-88, PRD v2 mục 7.2): nguồn `PICKUP`, trạng thái `ASSIGNED` kèm
 * chuyến và điểm giao, mã QR thật cấp một lần — điều phối viên in nhãn gửi bên gửi dán sẵn, tài xế quét như kiện thường. Kiện thứ i ứng
 * với `request.packages[i]`; kích thước, khối lượng, loại hàng, mã của bên gửi lấy từ yêu cầu, điểm đến là tên điểm giao.
 * Lịch sử kiện ghi hai mốc như một kiện nhập rồi gán chuyến (`created` rồi `IMPORTED → ASSIGNED`), cùng một thời điểm.
 */
export function createPickupPackages(ctx: DbContext, request: PickupRequest, deliveryStopId: string): Package[] {
  const { packages, session } = ctx.state
  const at = ctx.nowIso()
  const taken = ctx.qrTokensInUse()
  return request.packages.map((pkg) =>
    put(packages, {
      id: nextId('PK', packages.keys(), 4),
      companyId: request.companyId,
      packageCode: pkg.packageCode,
      qrToken: ctx.newQrToken(taken),
      lengthCm: pkg.lengthCm,
      widthCm: pkg.widthCm,
      heightCm: pkg.heightCm,
      weightKg: pkg.weightKg,
      handlingClass: pkg.handlingClass,
      destination: request.delivery.name,
      status: 'ASSIGNED',
      flags: [],
      source: 'PICKUP',
      tripId: request.tripId,
      stopId: deliveryStopId,
      createdAt: at,
      createdBy: session.userId,
      history: [
        { at, actorId: session.userId, kind: 'created', source: 'PICKUP' },
        { at, actorId: session.userId, kind: 'status', from: 'IMPORTED', to: 'ASSIGNED', tripId: request.tripId },
      ],
    }),
  )
}

/**
 * Huỷ chuyến Đang vận chuyển (D-91): yêu cầu nhận dọc đường đã duyệt (`APPROVED`) mà chưa kiện nào lên xe — không kiện nào trong
 * `StopProgress.pickedIds` (kể cả xác nhận tay đang chờ), mọi kiện còn `ASSIGNED` — thành `REJECTED` với `rejectCause`
 * `TRIP_CANCELLED`, và kiện kho kiện của nó bị xoá: hàng còn ở chỗ bên gửi, không có gì để hoàn trả. `APPROVED → REJECTED` chỉ đi lối
 * này, ngoài `PICKUP_TRANSITIONS`. Yêu cầu đã có kiện lên xe giữ nguyên trạng thái; kiện đã lên xe thành Hoàn trả ở
 * `returnUndeliveredPackages`. Trả số yêu cầu vừa từ chối.
 */
export function rejectUnpickedPickups(ctx: DbContext, trip: Trip): number {
  const { pickups, packages, session } = ctx.state
  const picked = new Set(trip.delivery?.stops.flatMap((stop) => stop.pickedIds ?? []))
  const untouched = [...pickups.values()].filter((request) =>
    request.tripId === trip.id && request.status === 'APPROVED' &&
    (request.packageIds ?? []).every((id) => !picked.has(id) && (packages.get(id)?.status ?? 'ASSIGNED') === 'ASSIGNED'))
  const at = ctx.nowIso()
  for (const request of untouched) {
    for (const id of request.packageIds ?? []) packages.delete(id)
    const rejected: PickupRequest = { ...request, status: 'REJECTED', rejectCause: 'TRIP_CANCELLED', rejectedAt: at, rejectedBy: session.userId, packageIds: [] }
    delete rejected.layout
    put(pickups, rejected)
  }
  return untouched.length
}
