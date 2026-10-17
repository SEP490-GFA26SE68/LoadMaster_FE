import { MapPinCheck, PackagePlus } from 'lucide-react'
import { Banner } from '@/components/Banner'
import { useFormat, useT } from '@/lib/i18n'
import type { DeliveryView } from './delivery-progress'
import { useDriverCapabilities } from './useDriverQueries'

const TEXT = 'text-body-lg'

/**
 * Các thông báo đầu màn điểm giao (V2.3 đợt 6, `Banner`, chữ 16px): kho chưa xếp xong (chỉ xem), kho đã xếp xong (chờ xuất phát), đang
 * tới điểm (chưa bấm "Đã đến") hoặc giờ đã đến, kiện của điểm này hỏng lúc xếp nên bị bỏ lại kho, và điểm nhận hàng dọc đường (FE-7-05).
 * Nằm trong vùng cuộn để không chiếm chỗ cố định của màn một tay. Không có thông báo bản duyệt lỗi thời: màn chỉ dựng chuyến từ lúc kho
 * soạn hàng theo bản duyệt còn hiệu lực, và từ đó xe, điểm giao, kiện đã khoá — chuyến quay về lập kế hoạch thì màn nói "Chuyến tạm dừng".
 */
export function StopNotices({ view }: { view: DeliveryView }) {
  const t = useT()
  const format = useFormat()
  const caps = useDriverCapabilities()
  const leftOut = view.leftAtWarehouse.length
  return (
    <>
      <Banner tone="info" icon={view.arrivedAt === undefined ? undefined : MapPinCheck} className={TEXT}>
        {view.mode !== 'delivering'
          ? t(view.mode === 'preview' ? 'driver.notice.preview' : 'driver.notice.ready')
          // Backend chưa có bước "Đã đến" (Q-02) nên không có giờ đến: nói việc cần làm ở điểm đang giao
          : !caps.arrive
            ? t('driver.backend.atStop', { number: view.stop.number })
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
