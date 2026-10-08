import { ArrowRight, MapPinCheck } from 'lucide-react'
import { useId } from 'react'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'
import type { DeliveryView } from './delivery-progress'
import type { useDeliveryStop } from './useDeliveryStop'

/**
 * Chân màn điểm giao: **đúng một nút chính** theo bước của luồng giao nhiều điểm (D-84) — "Xuất phát" khi kho đã xếp xong; đang vận
 * chuyển thì "Đã đến điểm n" (ghi giờ đến thật), rồi "Hoàn tất điểm giao" / "Hoàn tất điểm nhận" (FE-7-05). Xem trước (kho chưa xếp xong)
 * thì không có chân. Xác nhận tay của điểm còn chờ duyệt (FE-6-04): kho chặn hoàn tất điểm — nút mờ, lý do ngay trên nút.
 */
export function StopFooter({ view, actions, scanPending }: { view: DeliveryView; actions: ReturnType<typeof useDeliveryStop>; scanPending: boolean }) {
  const t = useT()
  const blockedId = useId()
  if (view.mode === 'preview') return null
  const pickupStop = view.stop.kind === 'PICKUP'
  const arrived = view.arrivedAt !== undefined
  return (
    <div className="flex-none border-t border-line-soft bg-bg px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
      {view.mode === 'ready' ? (
        <Button variant="primary" block className="h-15 text-[18px]" loading={actions.starting} onClick={actions.startDelivery}>
          {t('driver.start')}
        </Button>
      ) : !arrived ? (
        <Button variant="primary" block className="h-15 gap-2.5 text-[18px] [&_svg]:size-5.5" loading={actions.arriving} onClick={actions.arrive}>
          <MapPinCheck strokeWidth={2.5} />
          {t('driver.arrive', { number: view.stop.number })}
        </Button>
      ) : (
        <div className="flex flex-col gap-2">
          {view.pendingConfirms > 0 ? (
            <Banner tone="warning" className="text-body-lg font-medium">
              <span id={blockedId}>{t(pickupStop ? 'driver.pickup.blocked' : 'driver.confirms.blocked', { count: view.pendingConfirms })}</span>
            </Banner>
          ) : null}
          <Button
            variant="primary"
            block
            className="h-15 gap-2.5 text-[18px] [&_svg]:size-5.5"
            disabled={view.remaining > 0 || view.pendingConfirms > 0 || scanPending || actions.completing}
            aria-describedby={view.pendingConfirms > 0 ? blockedId : undefined}
            onClick={actions.completeStop}
          >
            {t(pickupStop ? 'driver.pickup.complete' : 'driver.complete')}
            <ArrowRight strokeWidth={2.5} />
          </Button>
        </div>
      )}
    </div>
  )
}
