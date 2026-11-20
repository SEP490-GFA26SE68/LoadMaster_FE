import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { FlowHeading, Reveal, RevealWords } from './reveal'

/** Câu mô tả bắt đầu đậm dần sau khi tiêu đề bắt đầu nhô lên chừng này (ms). */
const LEDE_DELAY_MS = 200

/**
 * Tiêu đề một phần của trang công khai: `<h2>` Archivo 700 cỡ `section` (28 → 44 px theo bề rộng) kèm một câu mô tả 18 px (16 px dưới
 * 640 px); `id` để phần
 * đó `aria-labelledby` vào. Nhận focus bằng code (`tabIndex -1`) khi trang tới phần này qua neo (`useHashScroll`). `tone="dark"` cho
 * phần nền tối (dải số liệu, dải liên hệ): chữ trắng và `--sky-text-2`. Trong `RevealProvider` (trang giới thiệu, chuyển động bật) cả khối
 * là một cổng: tiêu đề chảy chữ — từng grapheme nhô lên theo một con sóng màu (`FlowHeading`) —, câu mô tả đậm dần từ +200 ms; ngoài
 * đó (`/bang-gia`) DOM đúng như chưa có chuyển động.
 */
export function SectionHeading({ id, title, lede, tone = 'light', className }: {
  id: string
  title: string
  lede?: ReactNode
  tone?: 'light' | 'dark'
  className?: string
}) {
  const dark = tone === 'dark'
  // Dưới 640 px câu mô tả là chữ thân 16/24 của điện thoại: cỡ `intro` 18/28 làm câu dài thêm một dòng ở 390 px
  const ledeClass = cn('m-0 text-body-lg text-pretty sm:text-intro', dark ? 'text-sky-text-2' : 'text-ink-2')
  return (
    <Reveal group className={cn('flex max-w-180 flex-col gap-3', className)}>
      <FlowHeading
        as="h2"
        id={id}
        tabIndex={-1}
        text={title}
        className={cn(
          'm-0 outline-none font-display text-section font-bold tracking-[-0.02em] text-balance font-stretch-112%',
          dark ? 'text-sky-text' : 'text-ink-strong',
        )}
      />
      {typeof lede === 'string' && lede ? (
        <RevealWords as="p" text={lede} mode="ink" delay={LEDE_DELAY_MS} className={ledeClass} />
      ) : lede ? (
        <Reveal as="p" kind="fade" delay={LEDE_DELAY_MS} className={ledeClass}>
          {lede}
        </Reveal>
      ) : null}
    </Reveal>
  )
}
