import type { LucideIcon } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

export type PlannerNoticeTone = 'info' | 'neutral' | 'warning'

/**
 * Tông của thanh thông báo trên nền tối Planner (V2.3 `.nbar`, `.nbar.info`, `.nbar.warn`). Nền là tint mờ của thang màu token trên
 * nền dầu `--canvas-1` — thanh nằm ngoài khung 3D nên không cần kính mờ. `detail` là màu phụ của dòng thứ hai; `accent` cho icon.
 */
const TONE: Record<PlannerNoticeTone, { box: string; title: string; detail: string; accent: string; action: string }> = {
  info: {
    box: 'border-cyan-300/40 bg-cyan-900/60', title: 'text-sky-text', detail: 'text-glass-dark-muted', accent: 'text-cyan-300',
    action: 'border-cyan-300/45 bg-cyan-400/15 [&_svg]:text-cyan-200',
  },
  neutral: {
    box: 'border-glass-dark-border bg-cyan-900/45', title: 'text-sky-text', detail: 'text-glass-dark-muted', accent: 'text-glass-dark-muted',
    action: '',
  },
  warning: {
    box: 'border-amber-500/50 bg-amber-700/35', title: 'text-amber-50', detail: 'text-amber-200', accent: 'text-amber-500',
    action: 'border-amber-500/55 bg-amber-500/15 hover:bg-amber-500/25 [&_svg]:text-amber-500',
  },
}

/**
 * Một thanh thông báo nổi dưới thanh trên Planner (V2.3, LM-107): icon, câu chính (đậm), dòng thứ hai tuỳ chọn, hành động dồn phải.
 * Từ `xl` rộng theo nội dung (tối đa 1.160 px như bản mẫu) và bo góc; hẹp hơn thì tràn ngang. Cảm ứng (dưới `xl`) chữ 16 px.
 */
export function PlannerNoticeBar({ tone, icon: Icon, title, detail, action, className, ...props }: {
  tone: PlannerNoticeTone
  icon: LucideIcon
  /** Câu chính. */
  title: ReactNode
  detail?: ReactNode
  action?: ReactNode
} & Omit<ComponentProps<'div'>, 'title' | 'children'>) {
  const spec = TONE[tone]
  return (
    <div
      className={cn('flex w-full min-w-0 items-center gap-3 rounded-lg border px-3.5 py-2 xl:w-fit xl:max-w-290 xl:py-1.75 xl:pr-2', spec.box, className)}
      {...props}
    >
      <Icon aria-hidden className={cn('size-4.5 flex-none', spec.accent)} strokeWidth={1.75} />
      <div className="min-w-0 flex-1 py-0.5">
        <p className={cn('m-0 text-body-lg leading-6 font-semibold xl:text-small xl:leading-4.75', spec.title)}>{title}</p>
        {/* Điện thoại: chỉ câu chính, dòng chi tiết nhường chỗ cho khung 3D (như mô tả của PageHero dưới 768 px) */}
        {detail ? <p className={cn('m-0 hidden text-body-lg leading-6 md:block xl:text-fine xl:leading-4.25', spec.detail)}>{detail}</p> : null}
      </div>
      {action ? <div className="ml-2 flex-none">{action}</div> : null}
    </div>
  )
}

/** Hành động của thanh thông báo: nút kính dẫn tới màn khác, viền theo tông của thanh. */
export function PlannerNoticeLink({ tone, to, icon: Icon, children }: { tone: PlannerNoticeTone; to: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <Button variant="glass" className={cn('h-14 px-3 text-body-lg xl:h-8.5 xl:text-small', TONE[tone].action)} asChild>
      <Link to={to}>
        <Icon strokeWidth={1.75} aria-hidden />
        {children}
      </Link>
    </Button>
  )
}
