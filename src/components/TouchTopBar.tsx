import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Thanh trên của màn toàn màn hình cảm ứng (kho; V2.3 đợt 6): **dải trời** `.sky` cao 80 px, điều khiển ĐẶC 56 px (`tone="sky"` của
 * `ExitIconButton`, `LanguageSwitch`, `NotificationBell`, `AccountMenu`, `Button variant="skySolid"`) — không kính, không blur: kính ở
 * thiết bị kho chưa đo ngoài thực tế (AGENTS mục 5). Thanh thấp hơn offset của toast (152 px) nên toast không đè lên nút nào của nó.
 * `leading` là nút thoát / quay lại, `children` là phần giãn ở giữa (tiêu đề, tiến độ), `trailing` là các điều khiển bên phải.
 * Chưa dùng ở màn tài xế — đợt sau.
 */
export function TouchTopBar({ leading, children, trailing, className }: {
  leading?: ReactNode
  children?: ReactNode
  trailing?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('sky flex h-20 flex-none items-center gap-3 px-3', className)}>
      {leading}
      <div className="flex min-w-0 flex-1 items-center gap-3">{children}</div>
      {trailing ? <div className="flex flex-none items-center gap-2">{trailing}</div> : null}
    </header>
  )
}
