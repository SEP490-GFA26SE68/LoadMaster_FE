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
