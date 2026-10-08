import { drivenAfterStop, legWithRests, parseTime, REST_MS, ROUTING_CONSTANTS, SERVICE_MS, travelMs, type LegSchedule } from './eta'
import type { GeoPoint } from './haversine'

/**
 * Vị trí xe mô phỏng (FE-6-08, D-85) — hàm thuần, kết quả là **mô phỏng**, không phải GPS. Xe đi trên đường nối thẳng kho → các điểm
 * theo thứ tự: mỗi chặng mất đúng thời gian của công thức D-76 (đường chim bay × hệ số đường ÷ 50 km/h, `travelMs`), dừng 15 phút ở mỗi
 * điểm, dừng thêm đúng số phút chậm của từng sự cố và đứng nghỉ đúng giờ nghỉ bắt buộc mà ETA đã cộng (FE-BL-04, `legWithRests`: nghỉ không
 * phải sự cố, không cộng vào phút chậm). Tốc độ và thời gian dừng lấy ở `ROUTING_CONSTANTS`; ở đây chỉ khai nhịp ghi vị trí.
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
  /** Thời gian tài xế đã lái liên tục tới lúc này, ms (FE-BL-04): đầu vào của `liveEta` để ETA tính từ vị trí vẫn cộng đúng giờ nghỉ. */
  readonly drivenMs: number
  /** Chỉ có khi xe đang đứng nghỉ bắt buộc giữa đường: giờ nghỉ xong, ISO 8601. */
  readonly restEndsAt?: string
}

type Pause = { readonly start: number; readonly end: number }

/** Khoảng dừng của các sự cố, theo thứ tự thời gian; khoảng sau bắt đầu khi khoảng trước hết. */
function pausesOf(delays: readonly SimulationDelay[]): Pause[] {
  const pauses: Pause[] = []
  for (const delay of delays.map((item) => ({ at: parseTime(item.at), ms: Math.round(item.minutes * 60_000) })).filter((item) => item.ms > 0).toSorted((a, b) => a.at - b.at)) {
    const start = Math.max(delay.at, pauses.at(-1)?.end ?? -Infinity)
    pauses.push({ start, end: start + delay.ms })
  }
  return pauses
}

/**
 * Các khoảng dừng sau khi điều phối chọn tuyến khác lúc `at` (FE-6-11): khoảng đã qua giữ nguyên, khoảng đang giữ xe bị cắt tại `at`,
 * khoảng chưa tới thì bỏ; rồi xe đứng thêm `extraMs` — phần đường vòng chậm hơn đường nối thẳng. Vị trí xe trước `at` không đổi.
 */
export function delaysAfterReroute(delays: readonly SimulationDelay[], at: string, extraMs: number): SimulationDelay[] {
  const atMs = parseTime(at)
  const kept = pausesOf(delays)
    .filter((pause) => pause.start < atMs)
    .map((pause) => ({ at: new Date(pause.start).toISOString(), minutes: (Math.min(pause.end, atMs) - pause.start) / 60_000 }))
  return extraMs > 0 ? [...kept, { at, minutes: extraMs / 60_000 }] : kept
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

type LegSegment = {
  /** Lúc bắt đầu đoạn lái, epoch ms. */
  readonly start: number
  /** Lúc hết đoạn lái (đã tính các khoảng giữ của sự cố), epoch ms. */
  readonly driveEnd: number
  /** Giờ nghỉ bắt buộc sau đoạn này xong lúc nào; vắng ở đoạn cuối của chặng. */
  readonly restEnd?: number
  /** Thời gian lái đã đi trên chặng trước đoạn này, ms. */
  readonly activeBefore: number
  /** Độ dài đoạn lái, ms. */
  readonly chunk: number
  /** Bộ đếm lái liên tục lúc bắt đầu đoạn, ms. */
  readonly drivenStart: number
}

/** Lịch của một chặng: các đoạn lái xen với giờ nghỉ bắt buộc, mỗi đoạn lái chịu các khoảng giữ của sự cố (`pauses`). */
function legSegments(leaveMs: number, leg: LegSchedule, drivenBefore: number, pauses: readonly Pause[]): LegSegment[] {
  const segments: LegSegment[] = []
  let cursor = leaveMs
  let activeBefore = 0
  for (const [index, chunk] of leg.chunks.entries()) {
    const driveEnd = activeEnd(cursor, chunk, pauses)
    const restEnd = index === leg.chunks.length - 1 ? undefined : driveEnd + REST_MS
    segments.push({ start: cursor, driveEnd, ...(restEnd === undefined ? {} : { restEnd }), activeBefore, chunk, drivenStart: index === 0 ? drivenBefore : 0 })
    activeBefore += chunk
    cursor = restEnd ?? driveEnd
  }
  return segments
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
  let driven = 0
  for (const [index, stop] of input.stops.entries()) {
    const travel = travelMs(from, stop.location)
    if (travel > 0) heading = bearing(from, stop.location)
    if (atMs < leaveMs) return { ...fix(from, 0, heading), stopId: stop.stopId, drivenMs: driven }

    const leg = legWithRests(travel, driven)
    const segments = legSegments(leaveMs, leg, driven, pauses)
    const driverArrivedMs = stop.arrivedAt === undefined ? Infinity : parseTime(stop.arrivedAt)
    const completedMs = stop.completedAt === undefined ? Infinity : parseTime(stop.completedAt)
    const arriveMs = Math.min(segments.at(-1)?.driveEnd ?? leaveMs, Math.max(leaveMs, Math.min(driverArrivedMs, completedMs)))
    if (atMs < arriveMs) {
      const pointAt = (done: number) => ({ lat: from.lat + (stop.location.lat - from.lat) * done, lng: from.lng + (stop.location.lng - from.lng) * done })
      for (const segment of segments) {
        if (atMs < segment.driveEnd) {
          const moved = activeBetween(segment.start, atMs, pauses)
          return { ...fix(pointAt((segment.activeBefore + moved) / travel), stopped ? 0 : ROUTING_CONSTANTS.AVERAGE_SPEED_KMH, heading), stopId: stop.stopId, drivenMs: segment.drivenStart + moved }
        }
        if (segment.restEnd !== undefined && atMs < segment.restEnd) {
          return { ...fix(pointAt((segment.activeBefore + segment.chunk) / travel), 0, heading), stopId: stop.stopId, drivenMs: segment.drivenStart + segment.chunk, restEndsAt: new Date(segment.restEnd).toISOString() }
        }
      }
    }

    const isLast = index === input.stops.length - 1
    const departMs = stop.completedAt !== undefined ? Math.max(completedMs, arriveMs) : isLast ? Infinity : activeEnd(arriveMs, SERVICE_MS, pauses)
    if (atMs < departMs) {
      const arrivedMs = driverArrivedMs <= atMs ? driverArrivedMs : arriveMs
      return { ...fix(stop.location, 0, heading), stopId: stop.stopId, arrivedAt: new Date(arrivedMs).toISOString(), drivenMs: leg.drivenAfterMs }
    }
    from = stop.location
    leaveMs = departMs
    driven = drivenAfterStop(leg.drivenAfterMs, departMs - arriveMs)
  }
  return { ...fix(from, 0, heading), stopId: null, drivenMs: driven }
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
