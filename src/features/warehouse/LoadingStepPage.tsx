import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { LoadingFinished } from './LoadingFinished'
import { LoadingSessionView } from './LoadingSessionView'
import { warehouseSession } from './loading-session'
import { useStartLoadingMutation, useWarehouseTripQuery } from './useWarehouseQueries'
import { WarehouseEmpty } from './WarehouseEmpty'

/**
 * Phiên xếp chuyến `/kho?chuyen=<mã>` (LM-086). Theo pha và revision của chuyến trong kho: vào lần đầu là bắt đầu xếp theo bản duyệt
 * mới nhất; đang xếp thì tiếp tục ở kiện chưa ghi đầu tiên; đã xếp xong thì ra màn Xếp xong. Bản duyệt lỗi thời không bắt đầu được —
 * chờ điều phối viên tối ưu lại và duyệt (D-31); chưa có bản duyệt hoặc chuyến đã huỷ thì nói rõ, có lối về danh sách.
 */
export function LoadingStepPage({ tripId }: { tripId: string }) {
  const t = useT()
  const query = useWarehouseTripQuery(tripId)

  if (query.isPending) return <FullScreenStatus label={t('warehouse.loading')} />
  if (query.isError) {
    return <WarehouseEmpty tripId={tripId} mascot="error" title={t('warehouse.loadErrorTitle')} description={dataErrorMessage(query.error, t)} />
  }
  const { trip, revisions } = query.data
  const session = warehouseSession(trip, revisions)
  switch (session.kind) {
    case 'no-plan':
      return <WarehouseEmpty tripId={tripId} title={t('warehouse.emptyTitle')} description={t('warehouse.emptyTripDescription', { tripId })} />
    case 'cancelled':
      return (
        <WarehouseEmpty
          tripId={tripId}
          mascot="error"
          title={t('warehouse.cancelledTitle')}
          description={t('warehouse.cancelledDescription', { tripId, reason: trip.cancellation?.reason ?? '' })}
        />
      )
    case 'stale':
      return <WarehouseEmpty tripId={tripId} title={t('warehouse.staleTitle')} description={t('warehouse.staleDescription', { tripId })} />
    case 'start':
      return <StartingSession tripId={tripId} />
    case 'loading':
      return <LoadingSessionView trip={trip} plan={session.plan} />
    case 'finished':
      return <LoadingFinished trip={trip} plan={session.plan} />
  }
}

function FullScreenStatus({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="grid h-dvh place-items-center bg-bg">
      <Spinner />
    </div>
  )
}

/**
 * Vào phiên của chuyến đã duyệt là bắt đầu xếp (D-45: `planning` → `loading`). Ghi xong, kho được đọc lại và màn chuyển sang phiên
 * đang xếp. Bị từ chối vì máy khác vừa bắt đầu trước thì lần đọc lại đó cũng đưa vào phiên; lỗi khác thì nói lỗi và cho thử lại.
 */
function StartingSession({ tripId }: { tripId: string }) {
  const t = useT()
  const { mutate, isError, error } = useStartLoadingMutation(tripId)
  const requested = useRef(false)

  useEffect(() => {
    // StrictMode chạy effect hai lần: ref giữ để chỉ gửi một lần bắt đầu
    if (requested.current) return
    requested.current = true
    mutate()
  }, [mutate])

  if (isError) {
    return (
      <WarehouseEmpty
        tripId={tripId}
        mascot="error"
        title={t('warehouse.startErrorTitle')}
        description={dataErrorMessage(error, t)}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="primary" size="touch" onClick={() => mutate()}>{t('warehouse.retry')}</Button>
            <Button asChild variant="secondary" size="touch"><Link to="/kho">{t('warehouse.backToList')}</Link></Button>
          </div>
        }
      />
    )
  }
  return <FullScreenStatus label={t('warehouse.starting')} />
}
