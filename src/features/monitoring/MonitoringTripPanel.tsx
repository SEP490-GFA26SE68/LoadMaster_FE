import { ExternalLink, ListOrdered, PackagePlus, TriangleAlert } from 'lucide-react'
import { memo, useState } from 'react'
import { Link } from 'react-router'
import { VehicleName } from '@/components/VehicleName'
import { StopMarker } from '@/components/map'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardActions, CardBody, CardHeader, CardMeta, CardTitle } from '@/components/ui/Card'
import { useCan } from '@/features/auth/useCan'
import { PickupRequestsCard } from '@/features/pickups/PickupRequestsCard'
import { ManualConfirmCard } from '@/features/trips/ManualConfirmCard'
import { useFormat, useT } from '@/lib/i18n'
import type { TripMonitoring } from '@/lib/mock-db'
import { LiveLocationBar } from './LiveLocationBar'
import { LocationHistory } from './LocationHistory'
import type { MonitoringTrip } from './monitoring-api'
import { DeadlineChip } from './monitoring-chips'
import { fixedStopCount } from './monitoring-view'
import { ReorderStopsDialog } from './ReorderStopsDialog'
import { ReportExceptionDialog } from './ReportExceptionDialog'
import { RerouteDialog } from './RerouteDialog'
import { TripExceptionList } from './TripExceptionList'
import { useTripChannel } from './useMonitoringQuery'
import { useMoment } from './useMoment'

/**
 * Chi tiết giám sát của chuyến đang chọn (FE-6-10, FE-6-11): giờ đến dự kiến của từng điểm so với hạn, sự cố của chuyến, lịch sử vị
 * trí và các xác nhận tay chờ duyệt (thẻ của Chi tiết chuyến, dùng lại). Người có `exceptions.report` (điều phối viên) có nút chính của
 * màn — "Báo sự cố". Thành phần nghe kênh cập nhật của chuyến (`useTripChannel`) để lịch sử vị trí theo kịp xe. `memo`: lần đọc giám sát
 * mới chỉ vẽ lại phần này khi chính chuyến đang chọn có điều gì đổi.
 */
export const MonitoringTripPanel = memo(function MonitoringTripPanel({ trip, live, userNames }: { trip: MonitoringTrip; live: TripMonitoring | undefined; userNames: Readonly<Record<string, string>> }) {
  const t = useT()
  const format = useFormat()
  const can = useCan()
  const moment = useMoment()
  const [reporting, setReporting] = useState(false)
  const [rerouting, setRerouting] = useState(false)
  const [reordering, setReordering] = useState(false)
  useTripChannel(trip.tripId)
  const etaOf = new Map((live?.stops ?? []).map((stop) => [stop.stopId, stop]))
  const reroute = live?.reroute
  const stopName = (stopNumber: number) => trip.stops.find((stop) => stop.number === stopNumber)?.name ?? ''
  // Đổi thứ tự cần ít nhất hai điểm chưa giao và chưa tới (FE-BL-03); không thì nút mờ kèm lý do
  const canReorder = trip.stops.length - fixedStopCount(trip.stops) >= 2

  return (
    <section aria-label={t('monitoring.panel.label', { id: trip.tripId })} className="flex flex-col gap-3">
      <Card>
        <CardHeader>
          <CardTitle as="h2"><span className="font-mono tabular-nums">{trip.tripId}</span> · {trip.name}</CardTitle>
          <CardMeta><VehicleName name={trip.vehicleName} /></CardMeta>
          <CardActions className="flex-wrap">
            <Button asChild variant="secondary" size="sm">
              <Link to={`/chuyen/${encodeURIComponent(trip.tripId)}`}>
                <ExternalLink strokeWidth={1.5} />
                {t('monitoring.panel.openTrip')}
              </Link>
            </Button>
            {can('routes.optimize') ? (
              <Button
                variant="secondary"
                size="sm"
                disabled={!canReorder}
                aria-describedby={canReorder ? undefined : `${trip.tripId}-reorder-reason`}
                onClick={() => setReordering(true)}
              >
                <ListOrdered strokeWidth={1.5} />
                {t('monitoring.reorder.open')}
              </Button>
            ) : null}
            {can('routes.optimize') && !canReorder ? <span id={`${trip.tripId}-reorder-reason`} className="sr-only">{t('monitoring.reorder.unavailable')}</span> : null}
            {can('exceptions.report') ? (
              <Button onClick={() => setReporting(true)}>
                <TriangleAlert strokeWidth={1.5} />
                {t('monitoring.exceptions.report')}
              </Button>
            ) : null}
          </CardActions>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          {live?.location ? <LiveLocationBar location={live.location} isMockResult={live.isMockResult} /> : null}
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-160 border-collapse text-body">
              <caption className="pb-2 text-left font-display text-h3 font-[650] text-ink-strong">{t('monitoring.panel.stops.title')}</caption>
              <thead>
                <tr className="border-b border-border text-left text-caption font-semibold text-ink-2">
                  <th scope="col" className="py-2 pr-3 font-semibold">{t('monitoring.panel.stops.columns.stop')}</th>
                  <th scope="col" className="px-3 py-2 font-semibold">{t('monitoring.panel.stops.columns.eta')}</th>
                  <th scope="col" className="px-3 py-2 font-semibold">{t('monitoring.panel.stops.columns.deadline')}</th>
                  <th scope="col" className="py-2 pl-3 font-semibold">{t('monitoring.panel.stops.columns.status')}</th>
                </tr>
              </thead>
              <tbody>
                {trip.stops.map((stop) => {
                  const eta = etaOf.get(stop.id)
                  return (
                    <tr key={stop.id} className="border-b border-line-soft last:border-b-0">
                      <th scope="row" className="py-2.5 pr-3 text-left font-medium text-ink-1">
                        <span className="flex items-center gap-2.5">
                          <span aria-hidden className="flex-none"><StopMarker number={stop.number} /></span>
                          <span>
                            <span className="sr-only">{t('common.stop', { number: stop.number })} · </span>{stop.name}
                            {stop.kind === 'PICKUP' ? (
                              <Badge shape="tag" tone="azure" className="ml-2 align-middle">
                                <PackagePlus aria-hidden className="size-3" strokeWidth={2} />
                                {t('trips.route.pickupTag')}
                              </Badge>
                            ) : null}
                          </span>
                        </span>
                      </th>
                      <td className="px-3 py-2.5 text-ink-1 tabular-nums">
                        {stop.completedAt !== undefined
                          ? t('monitoring.panel.stops.completed', { time: format.time(stop.completedAt) })
                          : eta === undefined
                            ? t('monitoring.panel.stops.noEta')
                            : eta.arrived ? t('monitoring.panel.stops.arrived', { time: format.time(eta.eta) }) : moment(eta.eta)}
                      </td>
                      <td className="px-3 py-2.5 text-ink-1 tabular-nums">{eta?.deadline === undefined ? t('monitoring.panel.stops.noDeadline') : moment(eta.deadline)}</td>
                      <td className="py-2.5 pl-3">{stop.completedAt === undefined && eta?.deadlineStatus !== undefined ? <DeadlineChip status={eta.deadlineStatus} /> : null}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 items-start gap-3 max-lg:grid-cols-1">
        <Card>
          <CardHeader><CardTitle>{t('monitoring.exceptions.title')}</CardTitle></CardHeader>
          <CardBody className="flex flex-col gap-3">
            {reroute ? (
              <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-ink-2">
                {t('monitoring.reroute.current', {
                  time: format.time(reroute.confirmedAt), route: t(`monitoring.reroute.routes.${reroute.route}`),
                  km: format.decimal(reroute.distanceKm), minutes: format.integer(reroute.durationMinutes), number: format.integer(reroute.stopNumber),
                })}
                <Badge shape="tag" tone="mock">MOCK RESULT</Badge>
              </p>
            ) : null}
            <TripExceptionList
              tripId={trip.tripId}
              exceptions={live?.exceptions ?? []}
              userNames={userNames}
              canResolve={can('exceptions.resolve')}
              onReroute={() => setRerouting(true)}
            />
          </CardBody>
        </Card>
        <LocationHistory tripId={trip.tripId} />
      </div>

      <ManualConfirmCard tripId={trip.tripId} />
      <PickupRequestsCard tripId={trip.tripId} phase="delivering" stops={trip.stops} />
      <ReportExceptionDialog tripId={trip.tripId} open={reporting} onOpenChange={setReporting} />
      <ReorderStopsDialog trip={trip} open={reordering} onOpenChange={setReordering} />
      <RerouteDialog tripId={trip.tripId} stopName={stopName} open={rerouting} onOpenChange={setRerouting} />
    </section>
  )
})
