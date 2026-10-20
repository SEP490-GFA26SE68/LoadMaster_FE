/** Chỗ dừng của focus ở đầu trang công khai (`PublicPage`): một dòng chỉ trình đọc màn hình thấy, đứng trước liên kết "Bỏ qua tới nội dung chính". */
export const PAGE_TOP_ID = 'dau-trang'

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * "Lên đầu trang": cuộn về đầu tài liệu — mượt, trừ khi người dùng xin giảm chuyển động — rồi đưa focus về chỗ dừng ở đầu trang, để phím
 * Tab kế tiếp đi tới liên kết bỏ qua và đầu trang thay vì ở lại chân trang. Focus trước với `preventScroll` để không cắt ngang lần cuộn mượt.
 */
export function scrollToPageTop(): void {
  document.getElementById(PAGE_TOP_ID)?.focus({ preventScroll: true })
  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
}
