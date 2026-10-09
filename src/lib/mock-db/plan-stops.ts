import type { DeliveryStop } from './types'

/**
 * Số điểm giao theo **phương án đã duyệt** và theo **vị trí hiện tại** của điểm trong chuyến (FE-7-04). Phương án là revision bất biến
 * (D-31): nó đánh số điểm giao theo vị trí lúc duyệt. Chèn điểm nhận dọc đường vào tuyến đang chạy làm các điểm sau lệch vị trí; điểm
 * nào lệch thì mang `DeliveryStop.planNumber` (số của nó trong phương án), điểm chèn lúc đang chạy mang `null` — không có trong phương
 * án. Điểm vắng `planNumber` chưa từng bị lệch: số trong phương án bằng vị trí + 1.
 */

type Numbered = Pick<DeliveryStop, 'planNumber'>

/** Số của điểm ở vị trí `index` (0-based) trong phương án đã duyệt; `null` khi điểm không có trong phương án. */
export function planNumberOf(stops: readonly Numbered[], index: number): number | null {
  const planNumber = stops[index]?.planNumber
  return planNumber === undefined ? index + 1 : planNumber
}

/** Số điểm trong phương án → số điểm hiện tại (vị trí + 1). Điểm chèn lúc đang chạy không có số trong phương án nên không có dòng. */
export function currentNumbersOfPlan(stops: readonly Numbered[]): Map<number, number> {
  const current = new Map<number, number>()
  stops.forEach((_, index) => {
    const planNumber = planNumberOf(stops, index)
    if (planNumber !== null) current.set(planNumber, index + 1)
  })
  return current
}

/** `true` khi số điểm hiện tại đã lệch khỏi số trong phương án — chỉ khi từng chèn điểm vào tuyến. */
export function hasInsertedStops(stops: readonly Numbered[]): boolean {
  return stops.some((stop) => stop.planNumber !== undefined)
}
