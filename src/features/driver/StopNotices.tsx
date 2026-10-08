import { MapPinCheck, PackagePlus } from 'lucide-react'
import { Banner } from '@/components/Banner'
import { useFormat, useT } from '@/lib/i18n'
import type { DeliveryView } from './delivery-progress'

const TEXT = 'text-body-lg'

/**
 * Các thông báo đầu màn điểm giao (V2.3 đợt 6, `Banner`, chữ 16px): bản duyệt lỗi thời, kho chưa xếp xong (chỉ xem), kho đã xếp xong
 * (chờ xuất phát), đang tới điểm (chưa bấm "Đã đến") hoặc giờ đã đến, kiện của điểm này hỏng lúc xếp nên bị bỏ lại kho, và điểm nhận
 * hàng dọc đường (FE-7-05). Nằm trong vùng cuộn để không chiếm chỗ cố định của màn một tay.
 */
export function StopNotices({ view, stale }: { view: DeliveryView; stale: boolean }) {
  const t = useT()
  const format = useFormat()
  const leftOut = view.leftAtWarehouse.length
  return (
    <>
      {stale ? <Banner tone="warning" role="alert" className={TEXT}>{t('driver.stale')}</Banner> : null}
      <Banner tone="info" icon={view.arrivedAt === undefined ? undefined : MapPinCheck} className={TEXT}>
        {view.mode !== 'delivering'
          ? t(view.mode === 'preview' ? 'driver.notice.preview' : 'driver.notice.ready')
          : view.arrivedAt === undefined
            ? t('driver.notice.enRoute', { number: view.stop.number })
            : t('driver.notice.arrived', { number: view.stop.number, time: format.time(view.arrivedAt) })}
      </Banner>
      {leftOut > 0 ? <Banner tone="warning" className={TEXT}>{t('driver.notice.leftOut', { count: leftOut })}</Banner> : null}
      {view.stop.kind === 'PICKUP' ? (
        <Banner tone="info" icon={PackagePlus} className={`${TEXT} font-medium`}>
          {t('driver.pickup.banner', { count: view.pickupItems.length, name: view.stop.name })}
        </Banner>
      ) : null}
    </>
  )
}
