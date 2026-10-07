import { useMemo } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { Spinner } from '@/components/ui/Spinner'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { DeliveryStopView } from './DeliveryStopView'
import { DriverNotice } from './DriverNotice'
import { TripSummary } from './TripSummary'
import { useDriverTripQuery } from './useDriverQueries'

/**
 * Một chuyến của tài xế `/tai-xe/diem-giao?chuyen=<mã>` (LM-087). Không có `?chuyen` thì về "Chuyến của tôi" `/tai-xe`.
 * `key` theo mã chuyến: đổi chuyến là dựng màn mới, không mang hộp thoại hay khung 3D đang mở sang.
 */
export function DriverStopPage() {
  const [search] = useSearchParams()
  const tripId = search.get('chuyen')
  if (!tripId) return <Navigate to="/tai-xe" replace />
  return <DriverTripScreen key={tripId} tripId={tripId} />
}

/**
 * Theo pha chuyến trong kho (D-45): đã hoàn thành → tổng kết; kho chưa xếp xong, đã xếp xong hoặc đang giao → màn điểm giao (xem trước,
 * bắt đầu giao, giao); chưa có bản duyệt, đã huỷ hoặc không phải chuyến của tài xế này → nói lý do.
 */
function DriverTripScreen({ tripId }: { tripId: string }) {
  const t = useT()
  const query = useDriverTripQuery(tripId)
  // Kiện nhận dọc đường của chuyến (FE-7-05): giữ một tham chiếu ổn định để màn không dựng lại danh sách điểm mỗi lần vẽ
  const pickup = useMemo(() => ({ requests: query.data?.pickups ?? [], packages: query.data?.pickupPackages ?? [] }), [query.data])

  if (query.isPending) {
    return (
      <div role="status" className="grid h-dvh place-items-center bg-bg text-body-lg text-text-2">
        <span className="inline-flex items-center gap-2"><Spinner />{t('driver.loading')}</span>
      </div>
    )
  }
  if (query.isError) return <DriverNotice mascot="error" title={t('driver.loadErrorTitle')} description={dataErrorMessage(query.error, t)} />
  const { trip, plan } = query.data
  if (trip.phase === 'cancelled') {
    return <DriverNotice mascot="error" title={t('driver.cancelledTitle')} description={t('driver.cancelledDescription', { tripId, reason: trip.cancellation?.reason ?? '' })} />
  }
  if (!plan) return <DriverNotice title={t('driver.emptyTitle')} description={t('driver.emptyTripDescription', { tripId })} />
  if (trip.phase === 'completed') return <TripSummary trip={trip} plan={plan} />
  return <DeliveryStopView trip={trip} plan={plan} pickup={pickup} />
}
