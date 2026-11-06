import type { DeadlineStatus } from '@/domain/routing'
import type { EtaSource, StopListTimings, StopTiming } from './stop-timing'

/** Một điểm của chuyến tài xế theo máy chủ (`GET /api/driver/trips/{id}/stops`); mọi mốc giờ là ISO 8601. */
export type ServerTripStop = {
  readonly number: number
  readonly name: string
  readonly address: string
  readonly done: boolean
  readonly packageCount: number
  /** Giờ đến kế hoạch của tuyến. */
  readonly plannedArrival: string | undefined
  readonly plannedStatus: DeadlineStatus | undefined
  /** Giờ tài xế bấm "Đã đến". */
  readonly actualArrival: string | undefined
  /** Hạn của yêu cầu giao của điểm. */
  readonly deadline: string | undefined
  /** Giờ đến dự kiến tính từ vị trí GPS mới nhất của xe (cùng cách tính với màn Giám sát). */
  readonly eta: string | undefined
  readonly etaStatus: DeadlineStatus | undefined
}

export type ServerTripStops = {
  /** Nguồn của vị trí xe mới nhất; `null` khi chưa có vị trí (chuyến chưa xuất phát hoặc điện thoại chưa gửi). */
  readonly location: { readonly source: EtaSource } | null
  /** Lúc nên đọc lại (ms); `null` khi chuyến không còn chạy. */
  readonly refreshMs: number | null
  readonly stops: readonly ServerTripStop[]
}

/**
 * Giờ của một điểm theo máy chủ, cùng dạng với `stopTiming` của kho mẫu: đã đến thì giờ đến thật và có kịp hạn không; chưa đến thì giờ
 * đến dự kiến từ vị trí xe khi máy chủ tính được, không thì giờ đến kế hoạch của tuyến. Không có giờ nào thì `expected` vắng.
 */
export function serverStopTiming(stop: ServerTripStop, location: ServerTripStops['location']): StopTiming {
  const { deadline } = stop
  if (stop.actualArrival !== undefined) {
    const onTime = deadline === undefined ? null : Date.parse(stop.actualArrival) <= Date.parse(deadline)
    return { deadline, arrival: { at: stop.actualArrival, onTime }, expected: undefined }
  }
  if (stop.eta !== undefined && location !== null) {
    return { deadline, arrival: undefined, expected: { eta: stop.eta, source: location.source, status: stop.etaStatus } }
  }
  if (stop.plannedArrival !== undefined) {
    return { deadline, arrival: undefined, expected: { eta: stop.plannedArrival, source: 'PLAN', status: stop.plannedStatus } }
  }
  return { deadline, arrival: undefined, expected: undefined }
}

/** Giờ của các điểm chưa hoàn tất, như `stopListTimings`: điểm đã hoàn tất không có giờ; một dòng nguồn cho cả danh sách. */
export function serverStopListTimings(trip: ServerTripStops): StopListTimings {
  const byStop = new Map<number, StopTiming>()
  const sources: EtaSource[] = []
  for (const stop of trip.stops) {
    if (stop.done) continue
    const timing = serverStopTiming(stop, trip.location)
    if (!timing.arrival && !timing.expected) continue
    byStop.set(stop.number, timing)
    if (timing.expected && !sources.includes(timing.expected.source)) sources.push(timing.expected.source)
  }
  return { byStop, sources }
}
