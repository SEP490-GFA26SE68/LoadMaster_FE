import { RouteMap } from '@/components/map'
import { Badge } from '@/components/ui/Badge'
import { Card, CardBody, CardHeader, CardMeta, CardTitle } from '@/components/ui/Card'
import { useT } from '@/lib/i18n'
import type { TripMonitoring } from '@/lib/mock-db'
import type { MonitoringBoard as Board, MonitoringTrip } from './monitoring-api'
import { MonitoringTripList } from './MonitoringTripList'
import { MonitoringTripPanel } from './MonitoringTripPanel'
import { matchesFilter, selectedTripId, tripSummary, type MonitoringFilter } from './monitoring-view'
import { useFleetMonitoringQuery } from './useTrackingQuery'

/**
 * Thân của tab "Chuyến đang chạy" (FE-6-10): bản đồ, danh sách cạnh nó và chi tiết của chuyến đang chọn. **Chỉ thành phần này đọc
 * giám sát theo nhịp của kho** (`useFleetMonitoringQuery`: nhiều nhất một lần mỗi giây, gỡ màn là hết nhịp) — dải tiêu đề và tab của
 * màn không vẽ lại theo từng điểm vị trí. Truy vấn giữ nguyên tham chiếu của chuyến không đổi, nên dòng danh sách (`memo`) và bản đồ
 * (so nội dung) chỉ vẽ lại phần có điều gì đổi.
 */
export function MonitoringBoard({ board, filter, requestedTripId, onToggleFilter, onClearFilter, onSelectTrip }: {
  board: Board
  filter: MonitoringFilter
  /** Mã chuyến trên URL; chuyến không còn hiện thì chọn chuyến đầu danh sách. */
  requestedTripId: string | null
  onToggleFilter: (name: keyof MonitoringFilter) => void
  onClearFilter: () => void
  onSelectTrip: (tripId: string) => void
}) {
  const fleet = useFleetMonitoringQuery(true).data
  const byId = new Map((fleet ?? []).map((live) => [live.tripId, live]))
  const summaries = board.trips.map((trip) => ({ trip, summary: tripSummary(trip, byId.get(trip.tripId)) }))
  const visible = summaries.filter(({ summary }) => matchesFilter(summary, filter)).map(({ trip }) => trip)
  const counts = {
    late: summaries.filter(({ summary }) => summary.lateRisk).length,
    incidents: summaries.filter(({ summary }) => summary.activeExceptions > 0).length,
  }
  const selectedId = selectedTripId(visible, requestedTripId)
  const selected = visible.find((trip) => trip.tripId === selectedId)

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[minmax(0,1fr)_26rem] items-start gap-3 max-lg:grid-cols-1">
        <FleetMap trips={board.trips} fleet={fleet ?? []} selected={selected} />
        <MonitoringTripList
          liveOf={(tripId) => byId.get(tripId)}
          visible={visible}
          counts={counts}
          filter={filter}
          onToggle={onToggleFilter}
          onClear={onClearFilter}
          selectedId={selectedId}
          onSelect={onSelectTrip}
        />
      </div>
      {selected ? <MonitoringTripPanel key={selected.tripId} trip={selected} live={byId.get(selected.tripId)} userNames={board.userNames} /> : null}
    </div>
  )
}

/**
 * Bản đồ các xe Đang vận chuyển: xe của mọi chuyến kèm nhãn mã chuyến và nguồn vị trí ("Mô phỏng" / "GPS"); tuyến, kho và điểm giao
 * (màu điểm giao kèm số) là của chuyến đang chọn. Vị trí mô phỏng là kết quả mock nên thẻ mang nhãn MOCK RESULT.
 */
function FleetMap({ trips, fleet, selected }: { trips: readonly MonitoringTrip[]; fleet: readonly TripMonitoring[]; selected: MonitoringTrip | undefined }) {
  const t = useT()
  const tripOf = new Map(trips.map((trip) => [trip.tripId, trip]))
  const vehicles = fleet.flatMap((live) => {
    const trip = tripOf.get(live.tripId)
    if (!trip || !live.location) return []
    const source = t(`monitoring.location.sources.${live.location.source}`)
    return [{
      id: live.tripId,
      name: t('monitoring.map.vehicle', { trip: live.tripId, name: trip.vehicleName, source }),
      tag: t('monitoring.map.tag', { trip: live.tripId, source }),
      lat: live.location.lat,
      lng: live.location.lng,
    }]
  })
  const stops = (selected?.stops ?? []).flatMap((stop) => (stop.lat === undefined || stop.lng === undefined ? [] : [{ id: stop.id, number: stop.number, name: stop.name, lat: stop.lat, lng: stop.lng }]))
  const vehicle = vehicles.find((item) => item.id === selected?.tripId)
  const hasPosition = selected === undefined || vehicle !== undefined || fleet.length === 0
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle as="h2">{t('monitoring.map.title')}</CardTitle>
        <Badge shape="tag" tone="mock">MOCK RESULT</Badge>
        <CardMeta className="basis-full">{t('monitoring.map.note')}</CardMeta>
      </CardHeader>
      <CardBody className="flex flex-col gap-2.5">
        {hasPosition ? null : <p role="status" className="m-0 text-small text-ink-2">{t('monitoring.map.noPosition', { id: selected?.tripId ?? '' })}</p>}
        <RouteMap
          label={t('monitoring.map.label')}
          className="h-112"
          depot={selected?.depot}
          stops={stops}
          vehicle={vehicle}
          others={vehicles.filter((item) => item.id !== selected?.tripId)}
        />
      </CardBody>
    </Card>
  )
}
