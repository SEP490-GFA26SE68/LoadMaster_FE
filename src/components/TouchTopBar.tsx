import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Thanh trên của màn toàn màn hình cảm ứng (kho, tài xế; V2.3 đợt 6): **dải trời** `.sky` cao 80 px, điều khiển ĐẶC 56 px (`tone="sky"` của
 * `ExitIconButton`, `LanguageSwitch`, `NotificationBell`, `AccountMenu`, `Button variant="skySolid"`) — không kính, không blur: kính ở
 * thiết bị kho chưa đo ngoài thực tế (AGENTS mục 5). Thanh thấp hơn offset của toast (152 px) nên toast không đè lên nút nào của nó.
 * `leading` là nút thoát / quay lại, `children` là phần giãn ở giữa (tiêu đề, tiến độ), `trailing` là các điều khiển bên phải.
 *
 * Màn tài xế (điện thoại 390 px): `wrap` cho thanh cao theo nội dung và dưới 480 px đẩy `children` (tiêu đề) xuống hàng riêng — hàng trên
 * chỉ đủ chỗ cho bốn điều khiển 56 px; `below` là một hàng đầy bề ngang dưới các điều khiển (dải tiến độ điểm giao nằm trong dải trời).
 * Cả hai vẫn thấp hơn offset của toast.
 */
export function TouchTopBar({ leading, children, trailing, below, wrap = false, className }: {
  leading?: ReactNode
  children?: ReactNode
  trailing?: ReactNode
  below?: ReactNode
  wrap?: boolean
  className?: string
}) {
  const flexible = wrap || below !== undefined
  return (
    <header className={cn('sky flex flex-none items-center px-3', flexible ? 'flex-wrap gap-x-3 gap-y-1 py-2' : 'h-20 gap-3', className)}>
      {leading}
      <div className={cn('flex min-w-0 flex-1 items-center gap-3', wrap && 'max-[479px]:order-last max-[479px]:basis-full')}>{children}</div>
      {trailing ? <div className={cn('flex flex-none items-center gap-2', wrap && 'max-[479px]:ml-auto')}>{trailing}</div> : null}
      {below !== undefined ? <div className="order-last basis-full pb-1">{below}</div> : null}
    </header>
  )
}
