/**
 * Đổi thứ tự các điểm chưa giao khi xe đang chạy (FE-BL-03, D-87): luật về thứ tự, thuần — không biết gì về kiện hay phương án 3D
 * (kiểm khả năng dỡ là `checkStopReorder` của `@/domain/constraints`). Trả mã + tham số (D-28), UI dịch.
 */

export type ProposedOrderInput = {
  /** Mã điểm theo thứ tự hiện tại của chuyến. */
  readonly current: readonly string[]
  /** Thứ tự đề xuất: phải là một hoán vị của `current`, khác `current`. */
  readonly proposed: readonly string[]
  /** Số điểm đầu danh sách phải đứng nguyên chỗ: điểm đã hoàn tất, và điểm xe đã tới (đang đứng ở đó). */
  readonly fixedCount: number
  /** Điểm nhận chưa tới của các yêu cầu nhận hàng dọc đường và điểm giao của chúng: điểm nhận phải đứng trước điểm giao của nó. */
  readonly pickups: readonly { readonly pickupStopId: string; readonly deliveryStopId: string }[]
}

export type OrderViolation =
  | { readonly code: 'STOP_ORDER_INVALID' }
  | { readonly code: 'STOP_NOT_MOVABLE'; readonly stopIds: readonly string[] }
  | { readonly code: 'PICKUP_AFTER_DELIVERY'; readonly pickupStopId: string; readonly deliveryStopId: string }

/** Lỗi đầu tiên của thứ tự đề xuất, theo thứ tự: không phải hoán vị (hoặc không đổi gì) → điểm cố định bị dời → điểm nhận sau điểm giao của nó; `null` khi hợp lệ. */
export function checkProposedOrder({ current, proposed, fixedCount, pickups }: ProposedOrderInput): OrderViolation | null {
  const sameSet = proposed.length === current.length && new Set(proposed).size === current.length && proposed.every((id) => current.includes(id))
  if (!sameSet || proposed.every((id, index) => id === current[index])) return { code: 'STOP_ORDER_INVALID' }
  const moved = current.slice(0, fixedCount).filter((id, index) => proposed[index] !== id)
  if (moved.length > 0) return { code: 'STOP_NOT_MOVABLE', stopIds: moved }
  const violated = pickups.find((pickup) => proposed.indexOf(pickup.pickupStopId) > proposed.indexOf(pickup.deliveryStopId))
  return violated === undefined ? null : { code: 'PICKUP_AFTER_DELIVERY', ...violated }
}
