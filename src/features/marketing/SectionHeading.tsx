import type { ReactNode } from 'react'

/**
 * Tiêu đề một phần của trang công khai: `<h2>` Archivo 700 24/32 kèm một câu mô tả; `id` để phần đó `aria-labelledby` vào. Nhận focus
 * bằng code (`tabIndex -1`) khi trang tới phần này qua neo (`useHashScroll`).
 */
export function SectionHeading({ id, title, lede }: { id: string; title: string; lede?: ReactNode }) {
  return (
    <div className="flex max-w-180 flex-col gap-2">
      <h2 id={id} tabIndex={-1} className="m-0 outline-none font-display text-h1 leading-8 font-bold tracking-[-0.3px] text-ink-strong font-stretch-112%">
        {title}
      </h2>
      {lede ? <p className="m-0 text-body-lg text-ink-2">{lede}</p> : null}
    </div>
  )
}
