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
}

export type OrderViolation =
  | { readonly code: 'STOP_ORDER_INVALID' }
  | { readonly code: 'STOP_NOT_MOVABLE'; readonly stopIds: readonly string[] }

/** Lỗi đầu tiên của thứ tự đề xuất, theo thứ tự: không phải hoán vị (hoặc không đổi gì) → điểm cố định bị dời; `null` khi hợp lệ. */
export function checkProposedOrder({ current, proposed, fixedCount }: ProposedOrderInput): OrderViolation | null {
  const sameSet = proposed.length === current.length && new Set(proposed).size === current.length && proposed.every((id) => current.includes(id))
  if (!sameSet || proposed.every((id, index) => id === current[index])) return { code: 'STOP_ORDER_INVALID' }
  const moved = current.slice(0, fixedCount).filter((id, index) => proposed[index] !== id)
  return moved.length > 0 ? { code: 'STOP_NOT_MOVABLE', stopIds: moved } : null
}
