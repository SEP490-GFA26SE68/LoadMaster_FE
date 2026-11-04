import type { DeadlineStatus } from '@/domain/routing'
import type { LocationSource, Trip, TripMonitoring } from '@/lib/mock-db'

/** Nguồn của giờ đến dự kiến: tuyến đã tối ưu (`PLAN`) hoặc vị trí xe mới nhất — mô phỏng hay GPS thật. */
export type EtaSource = 'PLAN' | LocationSource

/**
 * Giờ đến và hạn giao của điểm đang giao trên màn tài xế (FE-6-09). Mọi giờ đọc từ kho: hạn của điểm (`DeliveryStop.deadline`), giờ đến
 * dự kiến của tuyến đã tối ưu (`Trip.routePlan`) hoặc tính từ vị trí xe (`TripMonitoring`), giờ tài xế bấm "Đã đến".
 */
export type StopTiming = {
  /** Hạn giao của điểm (ISO 8601); vắng là điểm không có hạn. */
  readonly deadline: string | undefined
  /** Đã bấm "Đã đến": giờ đến thật, và có tới kịp hạn không — `null` khi điểm không có hạn. Cùng phép so của báo cáo chuyến. */
  readonly arrival: { readonly at: string; readonly onTime: boolean | null } | undefined
  /**
   * Chưa đến: giờ đến dự kiến, nguồn của nó và mức hạn (chỉ khi điểm có hạn). Vắng khi chuyến chưa tối ưu tuyến — không có giờ đến nào
   * để nói. Đang vận chuyển thì tính từ vị trí xe khi kho đã có, không thì theo tuyến.
   */
  readonly expected: { readonly eta: string; readonly source: EtaSource; readonly status: DeadlineStatus | undefined } | undefined
}

export function stopTiming(
  trip: Pick<Trip, 'stops' | 'routePlan'>,
  stopNumber: number,
  arrivedAt: string | undefined,
  live: Pick<TripMonitoring, 'location' | 'stops'> | undefined,
): StopTiming {
  const stop = trip.stops[stopNumber - 1]
  const deadline = stop?.deadline
  if (arrivedAt !== undefined) {
    const onTime = deadline === undefined ? null : Date.parse(arrivedAt) <= Date.parse(deadline)
    return { deadline, arrival: { at: arrivedAt, onTime }, expected: undefined }
  }
  const planned = trip.routePlan?.stops.find((entry) => entry.stopId === stop?.id)
  if (!planned) return { deadline, arrival: undefined, expected: undefined }
  const fromVehicle = live?.location ? live.stops.find((entry) => entry.stopId === planned.stopId) : undefined
  const expected = fromVehicle && live?.location
    ? { eta: fromVehicle.eta, source: live.location.source, status: fromVehicle.deadlineStatus }
    : { eta: planned.eta, source: 'PLAN' as const, status: planned.deadlineStatus }
  return { deadline, arrival: undefined, expected }
}

/** Giờ của các điểm trong một danh sách điểm của chuyến. */
export type StopListTimings = {
  /** Theo số điểm (vị trí trong `Trip.stops` + 1); chỉ điểm chưa hoàn tất mà có giờ để nói. */
  readonly byStop: ReadonlyMap<number, StopTiming>
  /** Nguồn của các giờ đến dự kiến trong danh sách, không lặp, theo thứ tự điểm — một dòng nguồn cho cả danh sách. */
  readonly sources: readonly EtaSource[]
}

/**
 * Giờ của từng điểm ở hai danh sách điểm của tài xế ("Chuyến của tôi", danh sách điểm ở màn điểm giao), cùng luật với thẻ liên hệ: mỗi điểm
 * chưa hoàn tất là `stopTiming` của nó — đã bấm "Đã đến" thì giờ đến thật, chưa thì giờ đến dự kiến (từ vị trí xe khi `live` có, không thì
 * theo tuyến). Điểm đã hoàn tất không có giờ. Chuyến chưa tối ưu tuyến thì không điểm nào có giờ, kể cả điểm đã đến: danh sách giữ như cũ.
 */
export function stopListTimings(
  trip: Pick<Trip, 'stops' | 'routePlan' | 'delivery'>,
  live: Pick<TripMonitoring, 'location' | 'stops'> | undefined,
): StopListTimings {
  const byStop = new Map<number, StopTiming>()
  const sources: EtaSource[] = []
  if (trip.routePlan === undefined) return { byStop, sources }
  trip.stops.forEach((_, index) => {
    const number = index + 1
    const progress = trip.delivery?.stops.find((entry) => entry.number === number)
    if (progress?.completedAt !== undefined) return
    const timing = stopTiming(trip, number, progress?.arrivedAt, live)
    if (!timing.arrival && !timing.expected) return
    byStop.set(number, timing)
    if (timing.expected && !sources.includes(timing.expected.source)) sources.push(timing.expected.source)
  })
  return { byStop, sources }
}
