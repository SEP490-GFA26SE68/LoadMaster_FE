import { ArrowRight, MapPinCheck } from 'lucide-react'
import { useId, useState } from 'react'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'
import { CompleteStopDialog } from './CompleteStopDialog'
import type { DeliveryView } from './delivery-progress'
import type { StopDelivery } from './driver-plan'
import type { useDeliveryStop } from './useDeliveryStop'

type StopFooterProps = {
  view: DeliveryView
  /** Mọi điểm của chuyến, cho hộp hỏi lại (điểm kế tiếp, điểm cuối). */
  stops: readonly StopDelivery[]
  actions: ReturnType<typeof useDeliveryStop>
  scanPending: boolean
}

/**
 * Chân màn điểm giao: **đúng một nút chính** theo bước của luồng giao nhiều điểm (D-84) — "Xuất phát" khi kho đã xếp xong; đang vận
 * chuyển thì "Đã đến điểm n" (ghi giờ đến thật), rồi "Hoàn tất điểm giao" / "Hoàn tất điểm nhận" (FE-7-05). Xem trước (kho chưa xếp xong)
 * thì không có chân. Xác nhận tay của điểm còn chờ duyệt (FE-6-04): kho chặn hoàn tất điểm — nút mờ, lý do ngay trên nút.
 * Bấm hoàn tất mở hộp hỏi lại (`CompleteStopDialog`) — hoàn tất không mở lại được; hộp gắn với điểm đang hỏi nên điểm đổi (đã hoàn tất)
 * hoặc điểm hết hoàn tất được (điều phối viên vừa từ chối một xác nhận tay) thì hộp tự đóng, và không tự mở lại.
 */
export function StopFooter({ view, stops, actions, scanPending }: StopFooterProps) {
  const t = useT()
  const blockedId = useId()
  const [asking, setAsking] = useState<number | null>(null)
  if (view.mode === 'preview') return null
  const pickupStop = view.stop.kind === 'PICKUP'
  const arrived = view.arrivedAt !== undefined
  const completable = arrived && view.remaining === 0 && view.pendingConfirms === 0 && !scanPending
  const asked = completable && asking === view.stop.number
  // Hộp đã tự đóng: quên câu hỏi, để hộp không tự mở lại khi điểm hoàn tất được trở lại
  if (asking !== null && !asked && !actions.completing) setAsking(null)

  async function handleConfirm() {
    if (await actions.completeStop()) setAsking(null)
  }

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
            disabled={!completable || actions.completing}
            aria-describedby={view.pendingConfirms > 0 ? blockedId : undefined}
            aria-haspopup="dialog"
            onClick={() => setAsking(view.stop.number)}
          >
            {t(pickupStop ? 'driver.pickup.complete' : 'driver.complete')}
            <ArrowRight strokeWidth={2.5} />
          </Button>
        </div>
      )}
      <CompleteStopDialog
        open={asked}
        onOpenChange={(open) => { if (!open) setAsking(null) }}
        view={view}
        stops={stops}
        pending={actions.completing}
        onConfirm={() => void handleConfirm()}
      />
    </div>
  )
}
