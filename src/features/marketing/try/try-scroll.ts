/** Chiều cao đầu trang dính (60 px) cộng lề nhỏ: phần cột kết quả nằm dưới mốc này coi là đã thấy. */
const HEADER_PX = 72
const REDUCE = '(prefers-reduced-motion: reduce)'

/**
 * Sau khi tính xong, đưa cột kết quả vào khung nhìn nếu đang bị cắt (nút "Tính ba phương án" nằm cuối form dài, nên cột kết quả dính
 * có thể đang nằm một phần trên mép trên hoặc dưới mép dưới). Chỉ cuộn khi cột vừa khung nhìn: cột cao hơn màn hình (điện thoại, kết quả
 * ngay dưới nút) thì để nguyên chỗ khách đang đứng. Giảm chuyển động thì nhảy thẳng. `scroll-margin-top` của cột chừa chỗ đầu trang.
 */
export function scrollResultsIntoView(element: HTMLElement | null): void {
  if (element === null || typeof element.scrollIntoView !== 'function') return
  const box = element.getBoundingClientRect()
  if (box.height > window.innerHeight - HEADER_PX) return
  if (box.top >= HEADER_PX && box.bottom <= window.innerHeight) return
  const reduce = typeof window.matchMedia === 'function' && window.matchMedia(REDUCE).matches
  element.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
}
