/** Thời gian xếp đầy thùng ở khung 3D của trang giới thiệu: dưới 5 giây nên không cần nút dừng (WCAG 2.2.2), và không lặp lại. */
export const LANDING_FILL_MS = 3000

/**
 * Số kiện đã hiện sau `elapsedMs` của một lần xếp ở trang giới thiệu. Tính theo thời gian, không theo khung hình: máy chiếu yếu vẽ
 * 20 khung một giây vẫn xếp xong đúng `durationMs` (vài kiện hiện cùng một khung), máy nhanh thì từng kiện một theo `loadingOrder`.
 */
export function fillStep(total: number, elapsedMs: number, durationMs = LANDING_FILL_MS): number {
  if (total <= 0 || elapsedMs <= 0) return 0
  if (durationMs <= 0) return total
  return Math.min(total, Math.ceil((total * elapsedMs) / durationMs))
}
