/**
 * Nhịp sáng một lần khi chọn kiện (`CargoFeedback`): viền nở ra tới `SELECT_PULSE_PEAK_M` mỗi phía rồi về sát kiện, trong
 * `SELECT_PULSE_MS` — chạy một lần, không lặp (WCAG 2.2.2). Hàm thuần của tiến độ `p` ∈ [0, 1], ngoài khoảng là 0.
 */
export const SELECT_PULSE_MS = 480
/** Độ nở lớn nhất mỗi phía của viền (m). */
export const SELECT_PULSE_PEAK_M = 0.03

export function selectPulseGrowth(p: number): number {
  if (!(p > 0 && p < 1)) return 0
  return SELECT_PULSE_PEAK_M * Math.sin(Math.PI * p)
}
