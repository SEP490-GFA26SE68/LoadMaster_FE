import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Thanh trên của màn toàn màn hình cảm ứng (kho, tài xế; V2.3 đợt 6): **dải trời** `.sky` cao 80 px, điều khiển ĐẶC 56 px (`tone="sky"` của
 * `ExitIconButton`, `LanguageSwitch`, `NotificationBell`, `AccountMenu`, `Button variant="skySolid"`) — không kính, không blur: kính ở
 * thiết bị kho chưa đo ngoài thực tế (AGENTS mục 5). Thanh thấp hơn offset của toast (152 px) nên toast không đè lên nút nào của nó.
 * `leading` là nút thoát / quay lại, `children` là phần giãn ở giữa (tiêu đề, tiến độ), `assistant` là nút trợ lý (`TouchAssistant`, không
 * vẽ gì khi trợ lý không có), `trailing` là các điều khiển bên phải.
 *
 * Màn tài xế (điện thoại 390 px): `wrap` cho thanh cao theo nội dung và dưới 480 px đẩy `children` (tiêu đề) xuống hàng riêng — hàng trên
 * chỉ đủ chỗ cho bốn điều khiển 56 px. Nút trợ lý khi đó ở hàng trên, trước `trailing`; `assistantBesideTitle` (màn "Chuyến của tôi": hàng
 * trên đã đủ bốn điều khiển) đưa nó xuống cuối hàng tiêu đề. `below` là một hàng đầy bề ngang dưới các điều khiển (dải tiến độ điểm giao
 * nằm trong dải trời). Cả hai vẫn thấp hơn offset của toast.
 */
export function TouchTopBar({ leading, children, assistant, assistantBesideTitle = false, trailing, below, wrap = false, className }: {
  leading?: ReactNode
  children?: ReactNode
  assistant?: ReactNode
  assistantBesideTitle?: boolean
  trailing?: ReactNode
  below?: ReactNode
  wrap?: boolean
  className?: string
}) {
  const flexible = wrap || below !== undefined
  const besideTitle = wrap && assistant !== undefined && assistantBesideTitle
  return (
    <header
      className={cn(
        'sky flex flex-none items-center px-3',
        flexible ? 'flex-wrap gap-x-3 gap-y-1 py-2' : 'h-20 gap-3',
        // Dưới 480 px nút trợ lý (`data-touch-assistant`, chỉ có khi trợ lý hiện) hoặc theo tiêu đề xuống cuối hàng thứ hai, hoặc đứng ở
        // hàng trên sát `trailing` (nhận `ml-auto` thay cho `trailing`)
        besideTitle && 'max-[479px]:[&>[data-touch-assistant]]:order-last',
        wrap && !besideTitle && 'max-[479px]:[&>[data-touch-assistant]]:ml-auto max-[479px]:[&>[data-touch-assistant]+div]:ml-0',
        className,
      )}
    >
      {leading}
      <div
        className={cn(
          'flex min-w-0 flex-1 items-center gap-3',
          wrap && 'max-[479px]:order-last',
          wrap && (besideTitle ? 'max-[479px]:basis-[calc(100%-4.5rem)]' : 'max-[479px]:basis-full'),
        )}
      >
        {children}
      </div>
      {assistant}
      {trailing ? <div className={cn('flex flex-none items-center gap-2', wrap && 'max-[479px]:ml-auto')}>{trailing}</div> : null}
      {below !== undefined ? <div className="order-last basis-full pb-1">{below}</div> : null}
    </header>
  )
}
