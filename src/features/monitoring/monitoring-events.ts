import type { EtaRiskAlert, LocationPoint, TripException, TripLiveStop, TripMonitoring } from '@/lib/mock-db'

/**
 * Kênh cập nhật của giám sát khi chưa có backend (FE-6-10, D-86): sự kiện **trong bộ nhớ** của tab đang mở, thay cho WebSocket
 * `/ws/trips/{tripId}/monitoring`. Kho không tự chạy — nó ghi điểm vị trí mới mỗi lần được đọc — nên sự kiện phát ra khi một lần đọc
 * giám sát (`monitoring-api.ts`) trả về điều gì mới so với lần đọc trước của chuyến đó. Màn đọc lại nhiều nhất một lần mỗi giây
 * (`refreshMs` của kho), nên sự kiện cũng không dày hơn thế.
 */
export type TripMonitoringEvent =
  | { type: 'LocationUpdate'; tripId: string; location: LocationPoint }
  | { type: 'EtaUpdate'; tripId: string; stops: TripLiveStop[] }
  | { type: 'EtaRiskAlert'; tripId: string; alert: EtaRiskAlert }
  /** Không có ở kênh của backend: sự cố cấp chuyến mới hoặc đổi trạng thái (FE-6-11). */
  | { type: 'ExceptionUpdate'; tripId: string; exception: TripException }
  | { type: 'TripCompleted'; tripId: string }

type Listener = (event: TripMonitoringEvent) => void

/**
 * Sự kiện giữa hai lần đọc giám sát của một chuyến — hàm thuần. Lần đọc đầu (`previous` vắng) phát vị trí và ETA hiện có, không phát
 * lại cảnh báo và sự cố đã có từ trước. Chuyến không còn chạy (`refreshMs` là `null`) phát `TripCompleted` một lần.
 */
export function monitoringEvents(previous: TripMonitoring | undefined, next: TripMonitoring): TripMonitoringEvent[] {
  const { tripId } = next
  const events: TripMonitoringEvent[] = []
  if (next.location && next.location.recordedAt !== previous?.location?.recordedAt) events.push({ type: 'LocationUpdate', tripId, location: next.location })
  if (JSON.stringify(next.stops) !== JSON.stringify(previous?.stops ?? [])) events.push({ type: 'EtaUpdate', tripId, stops: next.stops })
  if (previous) {
    const seen = new Set(previous.alerts.map((alert) => alert.eventId))
    for (const alert of next.alerts) if (!seen.has(alert.eventId)) events.push({ type: 'EtaRiskAlert', tripId, alert })
    const before = new Map(previous.exceptions.map((exception) => [exception.id, JSON.stringify(exception)]))
    for (const exception of next.exceptions) if (before.get(exception.id) !== JSON.stringify(exception)) events.push({ type: 'ExceptionUpdate', tripId, exception })
    if (next.refreshMs === null && previous.refreshMs !== null) events.push({ type: 'TripCompleted', tripId })
  }
  return events
}

const listeners = new Map<string, Set<Listener>>()
const lastSeen = new Map<string, TripMonitoring>()

/**
 * Nghe sự kiện giám sát của một chuyến; trả hàm thôi nghe. Chỉ chuyến đang có người nghe mới được giữ lần đọc trước: không ai nghe
 * thì không giữ gì.
 */
export function subscribe(tripId: string, listener: Listener): () => void {
  const set = listeners.get(tripId) ?? new Set<Listener>()
  listeners.set(tripId, set)
  set.add(listener)
  return () => {
    set.delete(listener)
    if (set.size > 0) return
    listeners.delete(tripId)
    lastSeen.delete(tripId)
  }
}

/** Một lần đọc giám sát vừa về: phát sự kiện cho người đang nghe chuyến đó. */
export function publish(monitoring: TripMonitoring) {
  const set = listeners.get(monitoring.tripId)
  if (!set) return
  const events = monitoringEvents(lastSeen.get(monitoring.tripId), monitoring)
  lastSeen.set(monitoring.tripId, monitoring)
  for (const event of events) for (const listener of [...set]) listener(event)
}

/**
 * Lần đọc cả đội xe vừa về: phát cho từng chuyến; chuyến đang có người nghe mà không còn trong danh sách Đang vận chuyển là đã kết
 * thúc.
 */
export function publishFleet(fleet: readonly TripMonitoring[]) {
  const running = new Set(fleet.map((trip) => trip.tripId))
  for (const trip of fleet) publish(trip)
  for (const [tripId, previous] of lastSeen) {
    if (!running.has(tripId) && previous.refreshMs !== null) publish({ ...previous, stops: [], refreshMs: null })
  }
}
