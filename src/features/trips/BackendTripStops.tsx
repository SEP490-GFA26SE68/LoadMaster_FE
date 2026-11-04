import { Warehouse } from 'lucide-react'
import { RouteMap } from '@/components/map'
import { StopDot } from '@/components/StopChip'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Card, CardBody, CardHeader, CardMeta, CardTitle } from '@/components/ui/Card'
import { useCan } from '@/features/auth/useCan'
import { LiveLocationBar } from '@/features/monitoring/LiveLocationBar'
import { DeadlineChip } from '@/features/monitoring/monitoring-chips'
import { useTripMonitoringQuery } from '@/features/monitoring/useTrackingQuery'
import type { TripLiveStop } from '@/lib/mock-db'
import { useFormat, useT } from '@/lib/i18n'
import { useTripsCapabilities } from './trips-capabilities'
import type { ServerTrip, ServerTripStop, ServerTripStopStatus } from './server-trip'

const STATUS_TONE: Readonly<Record<ServerTripStopStatus, BadgeTone>> = { PENDING: 'neutral', ARRIVED: 'azure', COMPLETED: 'success' }

/**
 * Điểm giao của Chi tiết chuyến từ máy chủ: kho xuất phát rồi các điểm theo thứ tự đi, mỗi điểm có trạng thái, giờ đến kế hoạch của
 * tuyến, hạn giao và giờ xe đến (khi máy chủ có). Chuyến Đang vận chuyển và người xem có quyền giám sát — khi màn Giám sát cũng đọc
 * máy chủ — thì thêm vị trí xe và giờ đến máy chủ tính từ vị trí, đọc lại theo nhịp máy chủ trả. Bản đồ chỉ vẽ điểm có toạ độ.
 */
export function BackendTripStops({ trip }: { trip: ServerTrip }) {
  const t = useT()
  const can = useCan()
  const caps = useTripsCapabilities()
  const live = useTripMonitoringQuery(trip.id, trip.status === 'IN_TRANSIT' && caps.liveMonitoring && can('monitoring.view')).data
  const location = trip.status === 'IN_TRANSIT' ? (live?.location ?? null) : null
  const liveStops = new Map((location ? live?.stops ?? [] : []).map((stop) => [stop.stopId, stop]))
  const { origin } = trip
  const mapped = trip.stops.flatMap((stop) =>
    stop.lat === undefined || stop.lng === undefined ? [] : [{ id: stop.id, number: stop.number, name: stop.name, lat: stop.lat, lng: stop.lng }])
  const depot = origin.lat === undefined || origin.lng === undefined
    ? undefined
    : { name: origin.name || t('trips.backend.origin'), lat: origin.lat, lng: origin.lng }
  const vehicle = location
    ? {
        name: t('monitoring.location.vehicle', { name: trip.vehicleName || trip.licensePlate, source: t(`monitoring.location.sources.${location.source}`) }),
        lat: location.lat,
        lng: location.lng,
      }
    : undefined

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{t('trips.backend.stops')}</CardTitle>
        <CardMeta>{t('trips.backend.stopCount', { count: trip.stops.length })}</CardMeta>
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        {location ? <LiveLocationBar location={location} isMockResult={live?.isMockResult ?? false} backend /> : null}
        <ol aria-label={t('trips.backend.stopsLabel')} className="m-0 flex list-none flex-col divide-y divide-line-soft p-0">
          <li className="flex items-start gap-3 py-3">
            <span aria-hidden className="grid size-7 flex-none place-items-center rounded-full bg-tint-slate text-tint-slate-fg">
              <Warehouse className="size-4" strokeWidth={1.5} />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-caption text-ink-3">{t('trips.backend.origin')}</span>
              <span className="font-semibold text-ink-strong">{origin.name || '—'}</span>
              {origin.address ? <span className="text-small text-ink-2">{origin.address}</span> : null}
            </span>
          </li>
          {trip.stops.map((stop) => <ServerStopRow key={stop.id} stop={stop} live={liveStops.get(stop.id)} />)}
        </ol>
        {trip.stops.length === 0 ? <p className="m-0 text-body text-ink-3">{t('trips.backend.noStops')}</p> : null}
        {mapped.length > 0 ? (
          <RouteMap label={t('trips.routePlan.map', { id: trip.id })} className="h-64" depot={depot} stops={mapped} vehicle={vehicle} />
        ) : null}
      </CardBody>
    </Card>
  )
}

function ServerStopRow({ stop, live }: { stop: ServerTripStop; live: TripLiveStop | undefined }) {
  const t = useT()
  const format = useFormat()
  const at = (iso: string) => ({ time: format.time(iso), date: format.dayMonth(iso) })
  const missing = stop.lat === undefined || stop.lng === undefined
  return (
    <li className="flex items-start gap-3 py-3">
      <StopDot stop={stop.number} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="sr-only">{t('common.stop', { number: stop.number })}</span>
          <span className="font-semibold text-ink-strong">{stop.name || '—'}</span>
          <Badge tone={STATUS_TONE[stop.status]} dot={stop.status === 'ARRIVED' ? 'halo' : 'solid'}>
            {t(`trips.backend.stopStatuses.${stop.status}`)}
          </Badge>
          {missing ? <Badge shape="tag" tone="warning">{t('trips.routePlan.missingCoordinates')}</Badge> : null}
        </span>
        {stop.address ? <span className="text-small text-ink-2">{stop.address}</span> : null}
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-ink-2 tabular-nums">
          {stop.actualArrival ? <span>{t('trips.routePlan.arrived', at(stop.actualArrival))}</span> : null}
          {!stop.actualArrival && live ? (
            <>
              <span>{t('trips.backend.liveEta', at(live.eta))}</span>
              {live.deadlineStatus ? <DeadlineChip status={live.deadlineStatus} /> : null}
            </>
          ) : null}
          {!stop.actualArrival && !live && stop.plannedArrival ? <span>{t('trips.routePlan.eta', at(stop.plannedArrival))}</span> : null}
          {stop.deadline ? <span>{t('trips.route.deadline', at(stop.deadline))}</span> : null}
        </span>
      </span>
    </li>
  )
}
