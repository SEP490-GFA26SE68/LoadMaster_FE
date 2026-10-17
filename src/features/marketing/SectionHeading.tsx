import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Tiêu đề một phần của trang công khai: `<h2>` Archivo 700 cỡ `section` (28 → 44 px theo bề rộng) kèm một câu mô tả 18 px; `id` để phần
 * đó `aria-labelledby` vào. Nhận focus bằng code (`tabIndex -1`) khi trang tới phần này qua neo (`useHashScroll`). `tone="dark"` cho
 * phần nền tối (dải số liệu, dải liên hệ): chữ trắng và `--sky-text-2`.
 */
export function SectionHeading({ id, title, lede, tone = 'light', className }: {
  id: string
  title: string
  lede?: ReactNode
  tone?: 'light' | 'dark'
  className?: string
}) {
  const dark = tone === 'dark'
  return (
    <div className={cn('flex max-w-180 flex-col gap-3', className)}>
      <h2
        id={id}
        tabIndex={-1}
        className={cn(
          'm-0 outline-none font-display text-section font-bold tracking-[-0.02em] text-balance font-stretch-112%',
          dark ? 'text-sky-text' : 'text-ink-strong',
        )}
      >
        {title}
      </h2>
      {lede ? <p className={cn('m-0 text-intro text-pretty', dark ? 'text-sky-text-2' : 'text-ink-2')}>{lede}</p> : null}
    </div>
  )
}
