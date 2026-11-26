/**
 * Một khung của số đếm lên (số sống của hộp thoại chạy tối ưu). Đi từ `from` tới `to` theo đường giảm tốc, làm tròn **về phía `from`**
 * theo bước `step` (1 cho số kiện, 0,1 cho %) nên không bao giờ vượt qua giá trị thật; `progress` ≥ 1 trả đúng `to`. Thuần.
 */
export function countFrame(from: number, to: number, progress: number, step = 1): number {
  if (progress >= 1 || from === to) return to
  const eased = 1 - (1 - Math.max(0, progress)) ** 3
  const raw = (from + (to - from) * eased) / step
  const rounded = (to > from ? Math.floor(raw + 1e-9) : Math.ceil(raw - 1e-9)) * step
  const value = Math.round(rounded * 1e6) / 1e6
  return to > from ? Math.min(value, to) : Math.max(value, to)
}
