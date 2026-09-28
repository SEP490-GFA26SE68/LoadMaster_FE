import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Lumo, type LumoPose } from '@/components/brand/Lumo'
import { cn } from '@/lib/utils'

const ART: Record<'info' | 'warning' | 'danger', string> = {
  info: 'bg-cyan-50 text-cyan-700 shadow-[inset_0_0_0_1px_var(--cyan-100)]',
  warning: 'bg-amber-50 text-amber-700 shadow-[inset_0_0_0_1px_var(--amber-200)]',
  danger: 'bg-red-50 text-red-700 shadow-[inset_0_0_0_1px_var(--red-200)]',
}

/**
 * Trạng thái rỗng V2.3 (`.empty`, `TrangThaiChung.jpg`): không khung, căn giữa; ô minh hoạ 64px bo 18px tô theo nghĩa (`icon` +
 * `tone`: cyan = chưa có dữ liệu / không khớp, hổ phách = cần chú ý, đỏ = lỗi) hoặc hình minh hoạ riêng (`illustration`), tiêu đề
 * Archivo 700, mô tả tối đa 400px, và đúng một hành động chính.
 *
 * *(LM-105)* `mascot`: linh vật Lumo thay ô icon ở màn không có dữ liệu — `empty` chưa có dữ liệu, `notFound` lọc không khớp, `error`
 * lỗi tải, `done` đã xong hết, `warehouseWaiting` / `driverWaiting` màn chờ việc của kho / tài xế. `compact` cho trạng thái rỗng nằm
 * trong card (96 px).
 */
export function EmptyState({
  illustration,
  mascot,
  compact = false,
  wide = false,
  icon: Icon,
  tone = 'info',
  title,
  description,
  action,
  className,
}: {
  illustration?: ReactNode
  mascot?: LumoPose
  compact?: boolean
  /** Mô tả rộng tới 520 px thay vì 400 px — câu dài trong card rộng (LM-106, So sánh phương án). */
  wide?: boolean
  icon?: LucideIcon
  tone?: keyof typeof ART
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-4 px-6 py-12 text-center',
        className,
      )}
    >
      {mascot ? (
        <Lumo pose={mascot} size={compact ? 'sm' : 'md'} />
      ) : Icon ? (
        <span aria-hidden className={cn('grid size-16 place-items-center rounded-xl', ART[tone])}>
          <Icon className="size-6" strokeWidth={1.5} />
        </span>
      ) : (
        illustration
      )}
      <div className="flex flex-col gap-1.5">
        <span className="font-display text-h2 leading-6 font-bold text-ink-strong font-stretch-106%">{title}</span>
        {description ? (
          <span className={cn('text-body leading-5.25 text-pretty text-ink-2', wide ? 'max-w-130' : 'max-w-100')}>{description}</span>
        ) : null}
      </div>
      {action}
    </div>
  )
}
