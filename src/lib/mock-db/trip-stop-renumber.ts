import type { DbContext } from './db-context'
import type { DeliveryStop, StopProgress, Trip } from './types'

/**
 * Đổi danh sách điểm giao của chuyến **đang vận chuyển** (FE-7-04 chèn điểm nhận dọc đường, FE-BL-03 đổi thứ tự): số điểm là vị trí + 1
 * nên mọi thứ khoá theo số điểm phải theo điểm sang số mới — tiến độ giao (điểm mới chưa có tiến độ), sự cố giao, dòng kiện của chuyến
 * (`deliveryStop`), lần đối chiếu, sự cố cấp chuyến, tuyến thay thế, đề xuất của sự cố và cảnh báo trễ hạn. Một chỗ duy nhất làm việc
 * đó; hai nơi gọi chỉ khác nhau ở danh sách `stops` mới.
 *
 * `stops` gồm mọi điểm cũ (cùng mã) theo thứ tự mới, cộng điểm mới nếu có. Trả chuyến với `stops` mới và các trường trên đã đánh số lại,
 * **không** có `routePlan` — nơi gọi tính lại tuyến (`routePlanOf`) và ghi (`put`). Dữ liệu giữ ngoài `Trip` được sửa tại chỗ.
 * `DeliveryStop.planNumber` (số trong phương án đã duyệt) là việc của nơi gọi: nó quyết định điểm nào còn khớp phương án.
 */
export function renumberTripStops(ctx: DbContext, trip: Trip, stops: readonly DeliveryStop[]): Omit<Trip, 'routePlan'> {
  // Số điểm cũ → số điểm mới
  const renumbered = new Map(trip.stops.map((stop, index) => [index + 1, stops.findIndex((item) => item.id === stop.id) + 1]))
  const renumber = (number: number) => renumbered.get(number) ?? number

  const delivery = trip.delivery && {
    ...trip.delivery,
    stops: stops.map((stop, index): StopProgress => {
      const before = trip.stops.findIndex((item) => item.id === stop.id)
      const progress = before === -1 ? undefined : trip.delivery?.stops.find((item) => item.number === before + 1)
      return { ...(progress ?? { unloadedIds: [] }), number: index + 1 }
    }),
    issues: trip.delivery.issues.map((issue) => ({ ...issue, stopNumber: renumber(issue.stopNumber) })),
  }
  const { routePlan: _routePlan, ...rest } = trip
  const next: Omit<Trip, 'routePlan'> = {
    ...rest,
    stops: [...stops],
    packages: trip.packages.map((pkg) => ({ ...pkg, deliveryStop: renumber(pkg.deliveryStop) })),
    ...(delivery === undefined ? {} : { delivery }),
    ...(trip.verifications === undefined ? {} : { verifications: trip.verifications.map((entry) => (entry.stopNumber === undefined ? entry : { ...entry, stopNumber: renumber(entry.stopNumber) })) }),
  }

  // Dữ liệu của chuyến giữ ngoài `Trip` cũng khoá theo số điểm
  const incidents = ctx.state.exceptions.get(trip.id)
  for (const exception of incidents?.exceptions ?? []) if (exception.stopNumber !== undefined) exception.stopNumber = renumber(exception.stopNumber)
  for (const reroute of incidents?.reroutes ?? []) reroute.stopNumber = renumber(reroute.stopNumber)
  if (incidents?.proposal) incidents.proposal.stopNumber = renumber(incidents.proposal.stopNumber)
  for (const alert of ctx.state.tracking.get(trip.id)?.alerts ?? []) alert.stopNumber = renumber(alert.stopNumber)
  return next
}
