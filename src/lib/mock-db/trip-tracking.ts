import { liveEta, simulateVehicle, type GeoPoint, type SimulatedVehicle, type SimulationDelay, type SimulationInput } from '@/domain/routing'
import { stopsWithoutCoordinates } from './trip-route'
import type { TripLiveStop } from './tracking-model'
import type { DeliveryStop, StopProgress, Trip } from './types'

/**
 * Vị trí xe và ETA trực tiếp của một chuyến (FE-6-08, FE-6-09) — hàm thuần nối chuyến với `@/domain/routing`. Mọi hàm nhận một thời
 * điểm `at` và trả kết quả **như lúc đó**: việc tài xế làm sau `at` chưa xảy ra. Nhờ vậy kho ghi bù các điểm vị trí của quãng không ai
 * đọc mà vẫn ra đúng lịch sử.
 */

type Tracked = Pick<Trip, 'stops' | 'depot' | 'delivery'>

const pointOf = (stop: DeliveryStop): GeoPoint => {
  if (stop.lat === undefined || stop.lng === undefined) throw new Error(`Điểm giao ${stop.id} chưa có toạ độ`)
  return { lat: stop.lat, lng: stop.lng }
}

/** Biết được xe ở đâu: xe đã xuất phát, chuyến có điểm giao và mọi điểm có toạ độ. */
export function isTrackable(trip: Tracked): boolean {
  return trip.delivery !== undefined && trip.stops.length > 0 && stopsWithoutCoordinates(trip.stops).length === 0
}

const progressOf = (trip: Tracked, index: number): StopProgress | undefined => trip.delivery?.stops.find((stop) => stop.number === index + 1)

/**
 * Đầu vào của xe mô phỏng: rời kho lúc tài xế bấm xuất phát, đi các điểm theo thứ tự của chuyến. Danh sách **cắt tại điểm chưa hoàn tất
 * đầu tiên**: xe tới đó thì đứng chờ tài xế hoàn tất điểm, không tự đi tiếp sau 15 phút. `delays` là sự cố cấp chuyến (FE-6-11).
 */
export function simulationOf(trip: Tracked, delays: readonly SimulationDelay[] = []): SimulationInput | null {
  if (!isTrackable(trip) || !trip.delivery) return null
  const firstOpen = trip.stops.findIndex((_, index) => progressOf(trip, index)?.completedAt === undefined)
  const driven = firstOpen === -1 ? trip.stops : trip.stops.slice(0, firstOpen + 1)
  return {
    depot: { lat: trip.depot.lat, lng: trip.depot.lng },
    departureTime: trip.delivery.startedAt,
    stops: driven.map((stop, index) => {
      const progress = progressOf(trip, index)
      return {
        stopId: stop.id,
        location: pointOf(stop),
        ...(progress?.arrivedAt === undefined ? {} : { arrivedAt: progress.arrivedAt }),
        ...(progress?.completedAt === undefined ? {} : { completedAt: progress.completedAt }),
      }
    }),
    delays,
  }
}

/**
 * ETA trực tiếp của các điểm chưa hoàn tất lúc `at`, tính từ `position`. `arrivedAt`: xe đang đứng ở điểm chưa hoàn tất đầu tiên từ
 * lúc đó — với GPS thật là giờ tài xế bấm "Đã đến", với xe mô phỏng là giờ nó tới nơi.
 */
export function liveStops(trip: Tracked, position: GeoPoint, at: string, arrivedAt?: string): TripLiveStop[] {
  const atMs = Date.parse(at)
  const open = trip.stops
    .map((stop, index) => ({ stop, number: index + 1, completedAt: progressOf(trip, index)?.completedAt }))
    .filter(({ completedAt }) => completedAt === undefined || Date.parse(completedAt) > atMs)
  const etas = liveEta({
    position,
    at,
    stops: open.map(({ stop }, index) => ({
      stopId: stop.id,
      location: pointOf(stop),
      ...(stop.deadline === undefined ? {} : { deadline: stop.deadline }),
      ...(index === 0 && arrivedAt !== undefined ? { arrivedAt } : {}),
    })),
  })
  return etas.map((eta, index) => {
    const { stop, number } = open[index] ?? {}
    return { ...eta, number: number ?? 0, ...(stop?.deadline === undefined ? {} : { deadline: stop.deadline }) }
  })
}

/** Giờ tài xế bấm "Đã đến" ở điểm chưa hoàn tất đầu tiên, nếu đã bấm trước `at`. */
export function driverArrivedAt(trip: Tracked, at: string): string | undefined {
  const atMs = Date.parse(at)
  const current = trip.delivery?.stops.find((stop) => stop.completedAt === undefined || Date.parse(stop.completedAt) > atMs)
  return current?.arrivedAt !== undefined && Date.parse(current.arrivedAt) <= atMs ? current.arrivedAt : undefined
}

/** Xe mô phỏng lúc `at` và ETA trực tiếp tính từ vị trí đó; `null` khi chuyến chưa xuất phát hoặc còn điểm chưa có toạ độ. */
export function simulatedSnapshot(trip: Tracked, at: string, delays: readonly SimulationDelay[] = []): { vehicle: SimulatedVehicle; stops: TripLiveStop[] } | null {
  const input = simulationOf(trip, delays)
  if (!input) return null
  const vehicle = simulateVehicle(input, at)
  return { vehicle, stops: liveStops(trip, vehicle, at, vehicle.arrivedAt) }
}
