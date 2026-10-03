import { useMemo } from 'react'
import { RouteMap } from '@/components/map'
import { useCan } from '@/features/auth/useCan'
import { LiveLocationBar } from '@/features/monitoring/LiveLocationBar'
import { useTripMonitoringQuery } from '@/features/monitoring/useTrackingQuery'
import { useT } from '@/lib/i18n'
import { vnClock, type DeliveryStop, type Trip, type TripEta } from '@/lib/mock-db'
import { RouteDiagram } from './RouteDiagram'
import { RoutePlanBar } from './RoutePlanBar'
import type { StopRow } from './trip-summary'

/**
 * Card sơ đồ tuyến của Chi tiết chuyến cùng dữ liệu của riêng nó: giờ đến dự kiến của tuyến đã tối ưu (FE-4b-09) khi xe chưa rời kho,
 * và — khi chuyến **Đang vận chuyển** và người xem có quyền `monitoring.view` — vị trí xe trên bản đồ kèm giờ đến tính lại từ vị trí
 * (FE-6-08, FE-6-09). Truy vấn giám sát nằm ở đây chứ không ở trang: vị trí làm mới theo nhịp của kho, chỉ card này vẽ lại, bảng kiện
 * và cột phải đứng yên.
 */
export function TripRouteCard({ tripId, trip, eta, vehicleName, stops, editable, onAddStop, onReorder, onRemove, selectedStop, onSelectStop }: {
  tripId: string
  trip: Trip
  /** Tuyến đã tối ưu của chuyến: `null` khi chưa tối ưu, `undefined` khi đang tải. Trang đọc cùng lúc với chuyến để card không phải chờ thêm một lượt. */
  eta: TripEta | null | undefined
  vehicleName: string
  stops: readonly StopRow[]
  /** Người xem sửa được chuyến và chuyến còn lập kế hoạch (D-41, D-45). */
  editable: boolean
  onAddStop: () => void
  onReorder: (stops: readonly DeliveryStop[]) => void
  onRemove: (stop: StopRow) => void
  selectedStop: number | null
  onSelectStop: (stopNumber: number | null) => void
}) {
  const t = useT()
  const can = useCan()
  const planning = trip.phase === 'planning'
  const inTransit = trip.phase === 'delivering'
  const departed = inTransit || trip.phase === 'completed'
  const monitoring = useTripMonitoringQuery(tripId, inTransit && can('monitoring.view')).data
  const location = inTransit ? (monitoring?.location ?? null) : null
  // Xe chưa rời kho: giờ đến dự kiến của tuyến. Đang chạy: giờ đến tính từ vị trí xe. Đã giao xong: sơ đồ chỉ còn tiến độ giao thật
  const etas = useMemo(
    () => new Map((departed ? (inTransit ? monitoring?.stops ?? [] : []) : eta?.stops ?? []).map((stop) => [stop.stopId, stop])),
    [departed, inTransit, monitoring, eta],
  )
  const mapStops = stops.flatMap((stop) => (stop.lat === undefined || stop.lng === undefined ? [] : [{ id: stop.id, number: stop.number, name: stop.name, lat: stop.lat, lng: stop.lng }]))
  const vehicle = location
    ? { name: t('monitoring.location.vehicle', { name: vehicleName, source: t(`monitoring.location.sources.${location.source}`) }), lat: location.lat, lng: location.lng }
    : undefined

  return (
    // Trạng thái giao chỉ khi chuyến đang giao hoặc đã hoàn thành (LM-097)
    <RouteDiagram
      stops={stops}
      delivery={departed ? trip.delivery : undefined}
      depotName={trip.depot.name}
      departureTime={vnClock(new Date(trip.departureAt))}
      etas={etas}
      flagMissingCoordinates={planning}
      planBar={<RoutePlanBar tripId={tripId} eta={eta} stopCount={stops.length} canOptimize={can('routes.optimize') && planning} />}
      map={mapStops.length > 0 ? (
        <>
          {location ? <LiveLocationBar location={location} isMockResult={monitoring?.isMockResult ?? false} /> : null}
          <RouteMap label={t('trips.routePlan.map', { id: tripId })} className="h-64" depot={{ name: trip.depot.name, lat: trip.depot.lat, lng: trip.depot.lng }} stops={mapStops} vehicle={vehicle} />
        </>
      ) : undefined}
      onAddStop={editable ? onAddStop : undefined}
      readOnly={!editable}
      onReorder={onReorder}
      onRemove={onRemove}
      selectedStop={selectedStop}
      onSelectStop={onSelectStop}
    />
  )
}
