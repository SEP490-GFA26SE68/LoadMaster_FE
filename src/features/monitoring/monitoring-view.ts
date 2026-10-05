import type { DeadlineStatus } from '@/domain/routing'
import { isActiveException, type TripException, type TripLiveStop, type TripMonitoring } from '@/lib/mock-db'
import type { MonitoringBoard, MonitoringTrip } from './monitoring-api'

/**
 * Phần thuần của màn Giám sát (FE-6-10, FE-6-12): ghép phần ít đổi của chuyến (`MonitoringBoard`) với lần đọc giám sát mới nhất, lọc
 * danh sách, và dựng dòng của tab "Sự cố cần xử lý". Tham số URL là slug tiếng Việt không dấu (D-52).
 */
export const TAB_PARAM = 'tab'
export const ESCALATION_TAB = 'su-co-can-xu-ly'
export const TRIP_PARAM = 'chuyen'
export const LATE_PARAM = 'nguy-co-tre'
export const INCIDENT_PARAM = 'co-su-co'

const RANK: Readonly<Record<DeadlineStatus, number>> = { OK: 0, AT_RISK: 1, MISSED: 2 }

/** Mức hạn xấu nhất trong các điểm chưa hoàn tất có hạn; `null` khi không điểm nào có hạn. */
export function worstDeadline(stops: readonly Pick<TripLiveStop, 'deadlineStatus'>[]): DeadlineStatus | null {
  return stops.reduce<DeadlineStatus | null>((worst, { deadlineStatus }) => {
    if (deadlineStatus === undefined) return worst
    return worst === null || RANK[deadlineStatus] > RANK[worst] ? deadlineStatus : worst
  }, null)
}

/** Một điểm chưa hoàn tất kèm tên của nó. */
export type NamedLiveStop = TripLiveStop & { readonly name: string }

const named = (trip: MonitoringTrip, stop: TripLiveStop): NamedLiveStop => ({ ...stop, name: trip.stops.find((item) => item.id === stop.stopId)?.name ?? '' })

/** Những gì một dòng của danh sách cần biết về chuyến, suy từ lần đọc giám sát mới nhất (`undefined`: chưa đọc xong). */
export type TripSummary = {
  /** Điểm xe đang tới hoặc đang đứng; `null` khi chưa có giờ đến nào (xe chưa có vị trí). */
  readonly next: NamedLiveStop | null
  readonly worst: DeadlineStatus | null
  /** Số sự cố chưa xử lý xong (còn mở hoặc đã chuyển quản lý). */
  readonly activeExceptions: number
  /** Có điểm sát hạn hoặc trễ hạn dự kiến. */
  readonly lateRisk: boolean
}

export function tripSummary(trip: MonitoringTrip, live: TripMonitoring | undefined): TripSummary {
  const [first] = live?.stops ?? []
  const worst = worstDeadline(live?.stops ?? [])
  return {
    next: first ? named(trip, first) : null,
    worst,
    activeExceptions: (live?.exceptions ?? []).filter(isActiveException).length,
    lateRisk: worst === 'AT_RISK' || worst === 'MISSED',
  }
}

export type MonitoringFilter = { readonly late: boolean; readonly incidents: boolean }

/** Chuyến qua bộ lọc: bật cả hai thì chuyến phải vừa có nguy cơ trễ vừa có sự cố. */
export function matchesFilter(summary: TripSummary, filter: MonitoringFilter): boolean {
  return (!filter.late || summary.lateRisk) && (!filter.incidents || summary.activeExceptions > 0)
}

/** Chuyến đang chọn: mã trên URL nếu chuyến đó đang hiện, không thì chuyến đầu danh sách; `null` khi danh sách rỗng. */
export function selectedTripId(visible: readonly MonitoringTrip[], requested: string | null): string | null {
  return visible.find((trip) => trip.tripId === requested)?.tripId ?? visible[0]?.tripId ?? null
}

/** Một dòng của tab "Sự cố cần xử lý": sự cố đã chuyển lên, chuyến của nó, và các điểm chưa giao đáng xem. */
export type EscalationRow = {
  readonly exception: TripException
  readonly trip: MonitoringTrip
  /** Các điểm chưa hoàn tất **có hạn**, theo thứ tự đi; chuyến không có hạn nào thì là điểm kế tiếp. */
  readonly stops: readonly NamedLiveStop[]
}

/** Sự cố đã chuyển quản lý của các chuyến Đang vận chuyển, cũ trước. */
export function escalationRows(board: MonitoringBoard, fleet: readonly TripMonitoring[]): EscalationRow[] {
  const trips = new Map(board.trips.map((trip) => [trip.tripId, trip]))
  return fleet
    .flatMap((live) => {
      const trip = trips.get(live.tripId)
      if (!trip) return []
      const withDeadline = live.stops.filter((stop) => stop.deadline !== undefined)
      const stops = (withDeadline.length > 0 ? withDeadline : live.stops.slice(0, 1)).map((stop) => named(trip, stop))
      return live.exceptions.filter((exception) => exception.status === 'ESCALATED').map((exception) => ({ exception, trip, stops }))
    })
    .toSorted((a, b) => Date.parse(a.exception.reportedAt) - Date.parse(b.exception.reportedAt))
}
