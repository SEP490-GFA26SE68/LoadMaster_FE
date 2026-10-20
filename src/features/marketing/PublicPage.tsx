import type { MouseEvent, ReactNode } from 'react'
import { useT } from '@/lib/i18n'
import { PublicFooter } from './PublicFooter'
import { PublicHeader } from './PublicHeader'
import { useHashScroll } from './useHashScroll'

const MAIN_ID = 'noi-dung-chinh'

/**
 * Liên kết "Bỏ qua tới nội dung chính" chuyển focus thẳng vào `<main>` mà không đổi neo của URL: neo mới làm `useHashScroll` cuộn lại và
 * đặt focus vào tiêu đề phần đầu tiên, không phải đầu nội dung.
 */
function handleSkip(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault()
  document.getElementById(MAIN_ID)?.focus()
}

/**
 * Khung của hai trang công khai: liên kết bỏ qua đầu trang (chỉ hiện khi nhận focus bằng bàn phím), đầu trang dải trời, nội dung trên
 * nền `--app`, chân trang tối. Khác khung ứng dụng: trang cuộn cả tài liệu (màn không có dữ liệu vận hành), nên neo `#…` và chỗ cuộn khi
 * đổi trang do `useHashScroll` lo. `progress`: vạch tiến độ cuộn dưới đầu trang — chỉ trang giới thiệu bật.
 */
export function PublicPage({ children, progress = false }: { children: ReactNode; progress?: boolean }) {
  const t = useT()
  useHashScroll()
  return (
    <div className="flex min-h-dvh flex-col bg-app text-text">
      {/* Đẩy lên khỏi khung nhìn thay vì `sr-only` / `not-sr-only`: `not-sr-only` đặt padding về 0 nên chữ dính mép khi hiện ra */}
      <a
        href={`#${MAIN_ID}`}
        onClick={handleSkip}
        className="fixed top-3 left-4 z-50 flex h-11 -translate-y-[calc(100%+2rem)] items-center rounded-md bg-bg px-4 text-body font-semibold whitespace-nowrap text-ink-strong outline-2 outline-offset-2 outline-cyan-300 focus:translate-y-0 focus:shadow-e2 pointer-coarse:h-14 pointer-coarse:text-body-lg"
      >
        {t('landing.skipToContent')}
      </a>
      <PublicHeader progress={progress} />
      <main id={MAIN_ID} tabIndex={-1} className="flex flex-1 flex-col outline-none">{children}</main>
      <PublicFooter />
    </div>
  )
}
