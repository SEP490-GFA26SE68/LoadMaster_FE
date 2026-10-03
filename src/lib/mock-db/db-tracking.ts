import { POSITION_INTERVAL_MS, positionTimes, type DeadlineStatus } from '@/domain/routing'
import type { TrackingDb } from './db-api-tracking'
import type { DbContext } from './db-context'
import { MockDbError } from './errors'
import { isValidCoordinate } from './requirement-model'
import { MAX_LOCATION_POINTS, type EtaRiskStatus, type LocationPoint, type TripLiveStop, type TripMonitoring, type TripTracking } from './tracking-model'
import { driverArrivedAt, isTrackable, liveStops, simulatedSnapshot } from './trip-tracking'
import type { Trip } from './types'

/** Màn đang mở làm mới nhiều nhất một lần mỗi giây, dù đồng hồ tua nhanh tới đâu (PRD v2 mục 8.6). */
const MIN_REFRESH_MS = 1000

/** Mất tín hiệu GPS thật quá ba nhịp ghi vị trí thì xe mô phỏng ghi tiếp. */
const GPS_SIGNAL_TIMEOUT_MS = 3 * POSITION_INTERVAL_MS

const RANK: Readonly<Record<DeadlineStatus, number>> = { OK: 0, AT_RISK: 1, MISSED: 2 }

/**
 * Vị trí xe và ETA trực tiếp (FE-6-08, FE-6-09, D-85). Kho **không chạy đồng hồ hẹn giờ nào**: mỗi lần có người đọc, nó ghi bù các
 * điểm vị trí mô phỏng từ điểm đã ghi gần nhất tới giờ hiện tại của kho — một điểm mỗi 30 giây mô phỏng kể từ lúc xuất phát, mỗi điểm
 * tính như lúc đó (`trip-tracking.ts`) nên kết quả không phụ thuộc lúc nào có người đọc. Sau mỗi điểm vị trí, ETA của các điểm chưa
 * hoàn tất tính lại từ vị trí; mức hạn của một điểm **xấu đi** (kịp hạn → sát hạn → trễ hạn dự kiến) thì kho ghi một sự kiện
 * `delivery.etaRisk` của hệ thống — một lần cho mỗi lần chuyển. Mức hạn khởi đầu là mức của tuyến đã tối ưu: điểm đã trễ hạn từ lúc
 * lập kế hoạch không báo lại.
 */
export function trackingMethods(ctx: DbContext): TrackingDb {
  const { tracking } = ctx.state

  function trackingOf(trip: Trip): TripTracking {
    let record = tracking.get(trip.id)
    if (!record) {
      const planned = (trip.routePlan?.stops ?? []).flatMap((stop) => (stop.deadlineStatus === undefined ? [] : [[stop.stopId, stop.deadlineStatus] as const]))
      record = { points: [], nextSlot: 0, statuses: Object.fromEntries(planned), live: [], alerts: [], gpsUntilMs: -Infinity }
      tracking.set(trip.id, record)
    }
    return record
  }

  /** Ghi một điểm vị trí và ETA tính từ nó; chuyến còn đang chạy thì báo điểm có mức hạn xấu đi. */
  function record(trip: Trip, state: TripTracking, point: LocationPoint, live: TripLiveStop[]) {
    state.points.push(point)
    if (state.points.length > MAX_LOCATION_POINTS) state.points.splice(0, state.points.length - MAX_LOCATION_POINTS)
    state.live = live
    for (const stop of live) {
      if (stop.deadlineStatus === undefined || stop.deadline === undefined) continue
      const before = state.statuses[stop.stopId] ?? 'OK'
      state.statuses[stop.stopId] = stop.deadlineStatus
      if (trip.phase !== 'delivering' || RANK[stop.deadlineStatus] <= RANK[before]) continue
      const status: EtaRiskStatus = stop.deadlineStatus === 'MISSED' ? 'MISSED' : 'AT_RISK'
      const event = ctx.logSystem('delivery.etaRisk', { type: 'trip', id: trip.id }, { stopNumber: stop.number, deadlineStatus: status, eta: stop.eta, deadline: stop.deadline }, trip.companyId)
      state.alerts.push({ eventId: event.id, at: event.at, tripId: trip.id, stopId: stop.stopId, stopNumber: stop.number, status, eta: stop.eta, deadline: stop.deadline })
    }
  }

  /**
   * Ghi bù điểm vị trí mô phỏng tới giờ hiện tại của kho (hoặc tới lúc chuyến kết thúc). `null` khi xe chưa xuất phát. Tuyến còn điểm
   * chưa có toạ độ thì không mô phỏng được: chỉ có các điểm GPS thật, nếu có.
   */
  function advance(trip: Trip): TripTracking | null {
    if (!trip.delivery) return null
    const state = trackingOf(trip)
    const nowMs = Date.parse(ctx.nowIso())
    const endMs = Math.min(nowMs, Date.parse(trip.delivery.completedAt ?? trip.cancellation?.at ?? ctx.nowIso()))
    const lastSlot = Math.floor((endMs - Date.parse(trip.delivery.startedAt)) / POSITION_INTERVAL_MS)
    // Quãng dài không ai đọc: chỉ các điểm còn nằm trong lịch sử mới cần ghi
    const from = Math.max(state.nextSlot, lastSlot - MAX_LOCATION_POINTS + 1)
    for (const at of isTrackable(trip) ? positionTimes(trip.delivery.startedAt, new Date(endMs).toISOString(), from) : []) {
      if (Date.parse(at) < state.gpsUntilMs) continue
      const snapshot = simulatedSnapshot(trip, at)
      if (!snapshot) break
      const { lat, lng, speedKmh, heading, recordedAt } = snapshot.vehicle
      record(trip, state, { lat, lng, speedKmh, heading, recordedAt, source: 'SIMULATED' }, snapshot.stops)
    }
    state.nextSlot = Math.max(state.nextSlot, lastSlot + 1)
    return state
  }

  function monitoringOf(trip: Trip): TripMonitoring {
    const state = advance(trip)
    const base = { tripId: trip.id, location: state?.points.at(-1) ?? null, alerts: state?.alerts ?? [], isMockResult: true as const }
    if (!state || !trip.delivery || trip.phase !== 'delivering') return { ...base, stops: [], refreshMs: null }
    const done = new Set(trip.delivery.stops.filter((stop) => stop.completedAt !== undefined).map((stop) => stop.number))
    // Thời gian thật tới điểm vị trí kế tiếp: khoảng giờ của kho chia cho tốc độ đồng hồ
    const nextPointMs = Date.parse(trip.delivery.startedAt) + state.nextSlot * POSITION_INTERVAL_MS
    const waitMs = (nextPointMs - Date.parse(ctx.nowIso())) / ctx.clockSpeed()
    return {
      ...base,
      // Điểm tài xế vừa hoàn tất sau điểm vị trí gần nhất không còn là điểm chưa xong
      stops: state.live.filter((stop) => !done.has(stop.number)),
      refreshMs: Math.max(MIN_REFRESH_MS, Math.ceil(waitMs)),
    }
  }

  return {
    postDriverLocation: (tripId, input) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.own(tripId)
        if (trip.phase !== 'delivering') throw new MockDbError('TRIP_PHASE_INVALID', { tripId, phase: trip.phase })
        if (!isValidCoordinate(input.lat, input.lng)) throw new MockDbError('LOCATION_INVALID', { field: 'coordinates' })
        const { speedKmh = 0, heading = 0 } = input
        if (!Number.isFinite(speedKmh) || speedKmh < 0) throw new MockDbError('LOCATION_INVALID', { field: 'speedKmh' })
        if (!Number.isFinite(heading) || heading < 0 || heading >= 360) throw new MockDbError('LOCATION_INVALID', { field: 'heading' })
        // Xe mô phỏng ghi tới giờ hiện tại trước, rồi nhường cho GPS thật
        const state = advance(trip) ?? trackingOf(trip)
        const at = ctx.nowIso()
        const point: LocationPoint = { lat: input.lat, lng: input.lng, speedKmh, heading, recordedAt: at, source: 'GPS' }
        state.gpsUntilMs = Date.parse(at) + GPS_SIGNAL_TIMEOUT_MS
        record(trip, state, point, isTrackable(trip) ? liveStops(trip, point, at, driverArrivedAt(trip, at)) : [])
        return point
      }),
    getLatestLocation: (tripId) => ctx.respond(() => advance(ctx.scope.trips.read(tripId))?.points.at(-1) ?? null),
    getLocationHistory: (tripId) => ctx.respond(() => advance(ctx.scope.trips.read(tripId))?.points ?? []),
    getTripMonitoring: (tripId) => ctx.respond(() => monitoringOf(ctx.scope.trips.read(tripId))),
    listTripMonitoring: () => ctx.respond(() => ctx.scope.trips.list().filter((trip) => trip.phase === 'delivering').map(monitoringOf)),
  }
}
