import { CircleX, Info, TriangleAlert } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type BannerTone = 'info' | 'warning' | 'danger' | 'neutral'

const TONE: Record<BannerTone, { box: string; accent: string; icon: LucideIcon }> = {
  info: { box: 'border-cyan-100 bg-cyan-50 text-cyan-900', accent: 'text-cyan-700', icon: Info },
  warning: { box: 'border-amber-200 bg-amber-50 text-ink-strong', accent: 'text-amber-700', icon: TriangleAlert },
  danger: { box: 'border-red-200 bg-red-50 text-ink-strong', accent: 'text-red-700', icon: CircleX },
  neutral: { box: 'border-border bg-n-50 text-ink-2', accent: 'text-ink-3', icon: Info },
}

/**
 * Thông báo trong trang V2.3 (`v3.css` `.banner`): bo 14px, viền cùng tông, icon 16px, chữ 14/20; hành động (liên kết hoặc nút nhỏ)
 * dồn phải. Bốn tông theo nghĩa: info (khoá, thông tin), warning (lỗi thời, cần xem lại), danger (đã huỷ, lỗi), neutral (chỉ xem).
 * `role="status"` để trình đọc màn hình đọc khi banner hiện ra.
 */
export function Banner({
  tone = 'info',
  icon,
  action,
  className,
  children,
}: {
  tone?: BannerTone
  /** Đè icon mặc định của tông (ví dụ ổ khoá cho chuyến đã khoá). */
  icon?: LucideIcon
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  const spec = TONE[tone]
  const Icon = icon ?? spec.icon
  return (
    <div role="status" className={cn('flex items-start gap-3 rounded-lg border px-3.5 py-3 text-body', spec.box, className)}>
      <Icon aria-hidden className={cn('mt-0.5 size-4 flex-none', spec.accent)} strokeWidth={1.75} />
      <div className="min-w-0 flex-1">{children}</div>
      {action ? <div className={cn('flex-none font-semibold whitespace-nowrap', spec.accent)}>{action}</div> : null}
    </div>
  )
}
