import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { Banner } from '@/components/Banner'
import { PageHero } from '@/components/PageHero'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { isApiError } from '@/lib/api-client'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { vnClock, vnDate } from '@/lib/mock-db'
import { BackendTripStops } from './BackendTripStops'
import { dateOnly } from './trip-dates'
import type { ServerTrip } from './server-trip'
import { useServerTripQuery } from './useTripsQuery'

/**
 * Chi tiết chuyến khi nhóm `trips` đọc backend (`TRIPS_CAPABILITIES.backend`): máy chủ mới trả thông tin chuyến và điểm giao, nên màn
 * chỉ có dải tiêu đề (tên, mã, trạng thái, ngày và giờ xuất phát, xe, tài xế, số kiện) và thẻ điểm giao kèm giờ đến. Không có thẻ nào
 * đọc kho mẫu theo mã chuyến — kiện, phương án, tiến độ kho, nhật ký của chuyến chưa có ở máy chủ — và không có nút ghi nào.
 */
export function BackendTripDetailPage() {
  const t = useT()
  const tripId = useParams().tripId ?? ''
  const query = useServerTripQuery(tripId)
  const trip = query.data

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero
        overlap={trip !== undefined}
        crumbs={[{ label: t('trips.list.title'), to: '/chuyen' }, { label: tripId, mono: true }]}
        title={trip?.name ?? tripId}
        badge={trip ? <StatusBadge status={trip.status} /> : undefined}
        description={trip ? <ServerTripMeta trip={trip} /> : undefined}
      />

      {query.isPending ? (
        <div role="status" aria-label={t('trips.detail.loading')} className="grid flex-1 place-items-center"><Spinner /></div>
      ) : !trip ? (
        <div className="flex flex-1 flex-col items-start gap-3 px-shell py-8">
          <h2 className="text-h2 font-semibold">
            {isApiError(query.error) && query.error.code === 'TRIP_NOT_FOUND'
              ? t('trips.detail.notFound', { id: tripId })
              : dataErrorMessage(query.error, t)}
          </h2>
          <Button variant="secondary" asChild><Link to="/chuyen">{t('common.backToTrips')}</Link></Button>
        </div>
      ) : (
        <div className="sky-overlap flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-shell pb-8">
          <BackendTripStops trip={trip} />
          <Banner tone="neutral">{t('trips.backend.note')}</Banner>
        </div>
      )}
    </div>
  )
}

/** "Ngày chạy 24/09/2026, xuất phát 08:00 · Hyundai HD210 60C-446.32 · Tài xế … · 12 kiện" — chỉ các phần máy chủ có trả. */
function ServerTripMeta({ trip }: { trip: ServerTrip }) {
  const t = useT()
  const format = useFormat()
  const value = (children: ReactNode) => <b className="font-semibold text-sky-text">{children}</b>
  const departure = trip.departureAt === null ? null : new Date(trip.departureAt)
  const parts: ReactNode[] = []
  if (departure) {
    parts.push(
      <span key="date">
        {t('trips.detail.runDate')} {value(format.date(dateOnly(vnDate(departure))))}
        {t('trips.detail.departsAt')} {value(vnClock(departure))}
      </span>,
    )
  }
  if (trip.vehicleName || trip.licensePlate) {
    parts.push(
      <span key="vehicle">
        {trip.vehicleName}
        {trip.vehicleName && trip.licensePlate ? ' ' : null}
        {trip.licensePlate ? <span className="font-mono text-caption text-cyan-200">{trip.licensePlate}</span> : null}
      </span>,
    )
  }
  parts.push(
    <span key="driver">
      {trip.driverName === null ? t('trips.detail.noDriver') : <>{t('trips.detail.driver')} {value(trip.driverName)}</>}
    </span>,
  )
  if (trip.packageCount !== null) parts.push(<span key="packages">{value(t('common.packageCount', { count: trip.packageCount }))}</span>)
  return (
    <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
      {parts.flatMap((part, index) => (index === 0 ? [part] : [<span key={`dot-${index}`} aria-hidden>·</span>, part]))}
    </span>
  )
}
