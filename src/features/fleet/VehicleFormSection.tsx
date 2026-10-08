import { useId, type ReactNode } from 'react'

/**
 * Một phần đánh số của form xe (V2.3, ChiTietXe.jpg): ô số tối, tiêu đề Archivo, một dòng gợi ý hoặc số đếm sau tiêu đề, ngăn
 * cách phần trước bằng đường kẻ mảnh. Số chỉ để nhìn (`aria-hidden`): tiêu đề `<h2>` giữ đúng chữ để trình đọc màn hình và test
 * đọc bằng tên.
 */
export function VehicleFormSection({ number, title, meta, children }: {
  number: number
  title: string
  /** Gợi ý hoặc số đếm ngay sau tiêu đề ("2 vùng"). */
  meta?: ReactNode
  children: ReactNode
}) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4 border-t border-line-soft px-5 py-5 first:border-t-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          aria-hidden
          className="grid size-6 flex-none place-items-center rounded-md bg-panel-dark font-mono text-caption font-semibold text-sky-text"
        >
          {number}
        </span>
        <h2 id={headingId} className="font-display text-h3 leading-5.5 font-[650] text-ink-strong font-stretch-106%">{title}</h2>
        {meta ? <span className="text-small text-ink-3">{meta}</span> : null}
      </div>
      {children}
    </section>
  )
}
