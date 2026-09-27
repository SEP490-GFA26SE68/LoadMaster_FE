import { Lock } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/Badge'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/**
 * Một mục đánh số của form chuyến theo V2.3 (`v3.css` `.sec-h`, TaoChuyen.jpg): ô số 28 px nền `--cyan-950` chữ `--cyan-200`, tiêu đề
 * Archivo, ghi chú đếm (`meta`) và nhãn "Đã khoá" cạnh tiêu đề; mô tả và nội dung thụt theo cột tiêu đề. Các mục chung một card, chia
 * bằng đường `--line-soft` tràn mép. `FormSection` dùng chung (Thiết lập tối ưu) chưa có `meta` và nhãn khoá nên form chuyến dựng riêng.
 * Số chỉ dẫn mắt: `aria-hidden`, tiêu đề đọc được một mình.
 */
export function TripFormSection({ number, title, meta, locked = false, description, children }: {
  number: number
  title: string
  meta?: ReactNode
  locked?: boolean
  description?: ReactNode
  children: ReactNode
}) {
  const t = useT()
  return (
    <section className={cn('px-7 pt-5.5 pb-6.5 max-sm:px-4', number > 1 && 'border-t border-line-soft')}>
      <div className="flex items-center gap-3">
        <SectionNumber number={number} />
        <h2 className="font-display text-h3 leading-5.5 font-[650] text-ink-strong font-stretch-106%">{title}</h2>
        {meta ? <span className="text-small text-ink-3">{meta}</span> : null}
        {locked ? <LockedTag label={t('trips.create.locked')} /> : null}
      </div>
      {description ? <p className="mt-1 ml-10 text-lede text-ink-3">{description}</p> : null}
      <div className="mt-4.5 ml-10 max-sm:ml-0">{children}</div>
    </section>
  )
}

export function SectionNumber({ number, muted = false }: { number: number; muted?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-7 flex-none place-items-center rounded-[9px] font-display text-caption font-bold',
        muted ? 'bg-n-100 text-ink-3' : 'bg-cyan-950 text-cyan-200',
      )}
    >
      {number}
    </span>
  )
}

export function LockedTag({ label }: { label: string }) {
  return (
    <Badge shape="tag" tone="neutral">
      <Lock aria-hidden className="size-3" strokeWidth={1.75} />
      {label}
    </Badge>
  )
}

/** Dấu bắt buộc và chữ "(không bắt buộc)" cạnh nhãn. `aria-hidden`: tên truy cập của ô giữ đúng chữ nhãn (test đọc `exact`). */
export function FieldMark({ kind }: { kind: 'required' | 'optional' }) {
  const t = useT()
  return kind === 'required'
    ? <span aria-hidden className="ml-1.5 text-danger">*</span>
    : <span aria-hidden className="ml-1.5 font-normal text-ink-3">{t('trips.create.optional')}</span>
}
