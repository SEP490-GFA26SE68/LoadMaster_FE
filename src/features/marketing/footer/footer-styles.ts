/**
 * Kiểu chữ dùng chung của chân trang. Nền tối đặc `--panel-dark`: chữ thường `--sky-text-2` (≈ 8:1), tiêu đề và chữ khi rê chuột trắng.
 * Rê chuột chỉ đổi màu chữ (AGENTS mục 5); vòng focus `--cyan-300` như mọi điều khiển trên nền tối; vùng bấm 44 px, 56 px và chữ 16 px trên
 * máy cảm ứng (mục 10). Lề âm `-mx-2` đưa chữ của liên kết thẳng mép tiêu đề cột mà vùng bấm vẫn rộng.
 */
export const FOOTER_HEADING =
  'm-0 font-display text-h3 font-[650] text-sky-text font-stretch-106%'

export const FOOTER_LINK = [
  '-mx-2 inline-flex min-h-11 items-center rounded-md px-2 py-1 text-body font-medium text-pretty text-sky-text-2',
  'transition-colors duration-(--dur-fast) ease-standard outline-none hover:text-sky-text',
  'focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-cyan-300',
  'aria-[current=page]:font-semibold aria-[current=page]:text-sky-text',
  'pointer-coarse:min-h-14 pointer-coarse:text-body-lg',
].join(' ')

/** Chữ phụ của chân trang (mô tả, ghi chú). */
export const FOOTER_TEXT = 'm-0 text-body text-pretty text-sky-text-2 pointer-coarse:text-body-lg'
