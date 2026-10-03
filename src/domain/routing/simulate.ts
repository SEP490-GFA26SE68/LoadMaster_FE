import { parseTime, ROUTING_CONSTANTS, SERVICE_MS, travelMs } from './eta'
import type { GeoPoint } from './haversine'

/**
 * Vị trí xe mô phỏng (FE-6-08, D-85) — hàm thuần, kết quả là **mô phỏng**, không phải GPS. Xe đi trên đường nối thẳng kho → các điểm
 * theo thứ tự: mỗi chặng mất đúng thời gian của công thức D-76 (đường chim bay × hệ số đường ÷ 50 km/h, `travelMs`), dừng 15 phút ở mỗi
 * điểm, dừng thêm đúng số phút chậm của từng sự cố. Tốc độ và thời gian dừng lấy ở `ROUTING_CONSTANTS`; ở đây chỉ khai nhịp ghi vị trí.
 */
export const SIMULATION_CONSTANTS = {
  /** Một điểm vị trí mỗi chừng này giây mô phỏng. */
  POSITION_INTERVAL_SECONDS: 30,
} as const

export const POSITION_INTERVAL_MS = SIMULATION_CONSTANTS.POSITION_INTERVAL_SECONDS * 1000

export type SimulatedStop = {
  readonly stopId: string
  readonly location: GeoPoint
  /** Tài xế bấm "Đã đến", ISO 8601: từ lúc đó xe đứng ở điểm, dù xe mô phỏng còn trên đường. */
  readonly arrivedAt?: string
  /** Tài xế hoàn tất điểm, ISO 8601: xe rời điểm đúng lúc đó. Vắng thì xe đứng 15 phút rồi đi tiếp. */
  readonly completedAt?: string
}

/** Sự cố làm xe dừng `minutes` phút kể từ `at` (ISO 8601). Sự cố chồng giờ nhau thì nối tiếp: mỗi sự cố tốn đúng số phút của nó. */
export type SimulationDelay = { readonly at: string; readonly minutes: number }

export type SimulationInput = {
  readonly depot: GeoPoint
  /** Giờ xe rời kho thật, ISO 8601. */
  readonly departureTime: string
  /** Các điểm theo thứ tự đi. Xe ở lại điểm cuối của danh sách — muốn xe chờ ở một điểm thì cắt danh sách tại điểm đó. */
  readonly stops: readonly SimulatedStop[]
  readonly delays?: readonly SimulationDelay[]
}

/** Một điểm vị trí, theo `POST /api/driver/location`. */
export type VehicleFix = {
  /** Làm tròn 6 chữ số lẻ (khoảng 0,1 m). */
  readonly lat: number
  readonly lng: number
  /** 50 khi đang chạy, 0 khi đứng. */
  readonly speedKmh: number
  /** Hướng của chặng đang đi (hoặc vừa đi xong), độ nguyên từ bắc theo chiều kim đồng hồ, 0–359. */
  readonly heading: number
  readonly recordedAt: string
}

export type SimulatedVehicle = VehicleFix & {
  /** Điểm xe đang tới hoặc đang đứng; `null` khi tuyến không có điểm, hoặc điểm cuối đã hoàn tất. */
  readonly stopId: string | null
  /** Chỉ có khi xe đang đứng ở `stopId`: giờ đến — giờ tài xế bấm "Đã đến" nếu đã bấm, không thì giờ xe mô phỏng tới nơi. */
  readonly arrivedAt?: string
}

type Pause = { readonly start: number; readonly end: number }

/** Khoảng dừng của các sự cố, theo thứ tự thời gian; khoảng sau bắt đầu khi khoảng trước hết. */
function pausesOf(delays: readonly SimulationDelay[]): Pause[] {
  const pauses: Pause[] = []
  for (const delay of delays.map((item) => ({ at: parseTime(item.at), ms: item.minutes * 60_000 })).filter((item) => item.ms > 0).toSorted((a, b) => a.at - b.at)) {
    const start = Math.max(delay.at, pauses.at(-1)?.end ?? -Infinity)
    pauses.push({ start, end: start + delay.ms })
  }
  return pauses
}

/** Thời gian xe không bị sự cố giữ lại trong khoảng `from` → `to`, ms. */
function activeBetween(from: number, to: number, pauses: readonly Pause[]): number {
  return pauses.reduce((active, pause) => active - Math.max(0, Math.min(to, pause.end) - Math.max(from, pause.start)), to - from)
}

/** Thời điểm xe đã có đủ `active` ms không bị giữ lại, tính từ `from`. */
function activeEnd(from: number, active: number, pauses: readonly Pause[]): number {
  let cursor = from
  let remaining = active
  for (const pause of pauses) {
    if (remaining === 0 || pause.end <= cursor) continue
    const free = Math.max(0, pause.start - cursor)
    if (remaining <= free) break
    remaining -= free
    cursor = pause.end
  }
  return cursor + remaining
}

const round6 = (value: number) => Math.round(value * 1e6) / 1e6
const toRadians = (degrees: number) => (degrees * Math.PI) / 180

/** Góc phương vị ban đầu từ `from` tới `to`, độ nguyên 0–359. */
function bearing(from: GeoPoint, to: GeoPoint): number {
  const dLng = toRadians(to.lng - from.lng)
  const y = Math.sin(dLng) * Math.cos(toRadians(to.lat))
  const x = Math.cos(toRadians(from.lat)) * Math.sin(toRadians(to.lat)) - Math.sin(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.cos(dLng)
  return (Math.round((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360
}

/**
 * Xe ở đâu lúc `at`. Lịch mặc định: rời kho lúc `departureTime`, chạy từng chặng, đứng 15 phút mỗi điểm, ở lại điểm cuối. Việc tài xế
 * đã làm thắng lịch: "Đã đến" đặt xe tại điểm, "Hoàn tất điểm" là lúc xe rời điểm (điểm hoàn tất trước khi xe mô phỏng tới thì xe được
 * đặt tại điểm rồi đi ngay).
 */
export function simulateVehicle(input: SimulationInput, at: string): SimulatedVehicle {
  const atMs = parseTime(at)
  const pauses = pausesOf(input.delays ?? [])
  const fix = (point: GeoPoint, speedKmh: number, heading: number) => ({ lat: round6(point.lat), lng: round6(point.lng), speedKmh, heading, recordedAt: at })
  const stopped = pauses.some((pause) => pause.start <= atMs && atMs < pause.end)

  let from = input.depot
  let leaveMs = parseTime(input.departureTime)
  let heading = 0
  for (const [index, stop] of input.stops.entries()) {
    const travel = travelMs(from, stop.location)
    if (travel > 0) heading = bearing(from, stop.location)
    if (atMs < leaveMs) return { ...fix(from, 0, heading), stopId: stop.stopId }

    const driverArrivedMs = stop.arrivedAt === undefined ? Infinity : parseTime(stop.arrivedAt)
    const completedMs = stop.completedAt === undefined ? Infinity : parseTime(stop.completedAt)
    const arriveMs = Math.min(activeEnd(leaveMs, travel, pauses), Math.max(leaveMs, Math.min(driverArrivedMs, completedMs)))
    if (atMs < arriveMs) {
      const done = travel === 0 ? 1 : activeBetween(leaveMs, atMs, pauses) / travel
      const point = { lat: from.lat + (stop.location.lat - from.lat) * done, lng: from.lng + (stop.location.lng - from.lng) * done }
      return { ...fix(point, stopped ? 0 : ROUTING_CONSTANTS.AVERAGE_SPEED_KMH, heading), stopId: stop.stopId }
    }

    const isLast = index === input.stops.length - 1
    const departMs = stop.completedAt !== undefined ? Math.max(completedMs, arriveMs) : isLast ? Infinity : activeEnd(arriveMs, SERVICE_MS, pauses)
    if (atMs < departMs) {
      const arrivedMs = driverArrivedMs <= atMs ? driverArrivedMs : arriveMs
      return { ...fix(stop.location, 0, heading), stopId: stop.stopId, arrivedAt: new Date(arrivedMs).toISOString() }
    }
    from = stop.location
    leaveMs = departMs
  }
  return { ...fix(from, 0, heading), stopId: null }
}

/**
 * Mốc giờ của các điểm vị trí: `start`, rồi mỗi 30 giây một điểm, tới `until` (tính cả hai đầu). `fromIndex` bỏ qua các điểm đã ghi
 * (điểm thứ 0 là lúc xuất phát).
 */
export function positionTimes(start: string, until: string, fromIndex = 0): string[] {
  const startMs = parseTime(start)
  const last = Math.floor((parseTime(until) - startMs) / POSITION_INTERVAL_MS)
  const times: string[] = []
  for (let index = Math.max(0, fromIndex); index <= last; index += 1) times.push(new Date(startMs + index * POSITION_INTERVAL_MS).toISOString())
  return times
}
