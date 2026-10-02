import { eq, lt } from '@/domain/geometry'
import { AT_RISK_MARGIN_MS, DEFAULT_STOP_PRIORITY, parseTime, routeEta, SERVICE_MS, travelMs, type RouteInput, type RouteResult, type RouteStopInput } from './eta'
import { haversineKm, type GeoPoint } from './haversine'

type Candidate = {
  readonly stop: RouteStopInput
  /** Vị trí trong danh sách đầu vào: phân xử cuối cùng, để kết quả tất định. */
  readonly index: number
  /** Hạn, epoch ms; không có hạn là `Infinity` (xếp sau mọi điểm có hạn). */
  readonly deadlineMs: number
  readonly priority: number
}

/** Hạn sớm hơn trước, rồi ưu tiên cao hơn (D-93), rồi thứ tự đầu vào. Âm khi `a` đi trước. */
function byDeadlineThenPriority(a: Candidate, b: Candidate): number {
  if (a.deadlineMs !== b.deadlineMs) return a.deadlineMs < b.deadlineMs ? -1 : 1
  if (a.priority !== b.priority) return b.priority - a.priority
  return a.index - b.index
}

/** Điểm gần `from` nhất; cách đều (trong `EPSILON` km) thì hạn sớm hơn, rồi ưu tiên cao hơn, rồi thứ tự đầu vào. */
function nearest(from: GeoPoint, remaining: readonly Candidate[]): Candidate {
  let best: Candidate | undefined
  let bestKm = Infinity
  for (const candidate of remaining) {
    const km = haversineKm(from, candidate.stop.location)
    if (best === undefined || lt(km, bestKm) || (eq(km, bestKm) && byDeadlineThenPriority(candidate, best) < 0)) {
      best = candidate
      bestKm = km
    }
  }
  if (!best) throw new Error('Không còn điểm nào để chọn')
  return best
}

/** Trong các điểm hạn gấp: hạn sớm nhất, rồi ưu tiên cao hơn, rồi gần `from` hơn, rồi thứ tự đầu vào. */
function mostUrgent(from: GeoPoint, urgent: readonly Candidate[]): Candidate | undefined {
  return urgent.reduce<Candidate | undefined>((best, candidate) => {
    if (!best) return candidate
    if (candidate.deadlineMs !== best.deadlineMs || candidate.priority !== best.priority) {
      return byDeadlineThenPriority(candidate, best) < 0 ? candidate : best
    }
    const km = haversineKm(from, candidate.stop.location)
    const bestKm = haversineKm(from, best.stop.location)
    return lt(km, bestKm) || (eq(km, bestKm) && candidate.index < best.index) ? candidate : best
  }, undefined)
}

/**
 * Thứ tự điểm của mock tối ưu tuyến (D-76, issue BE S4b-05): từ kho, mỗi bước đi tới **điểm gần nhất** còn lại. Ngoại lệ — hạn gấp:
 * nếu ghé điểm gần nhất trước làm một điểm có hạn tới nơi **muộn hơn hạn − 30 phút** (không còn `OK`), điểm có hạn đó đi trước; nhiều
 * điểm như thế thì hạn sớm nhất trước, rồi ưu tiên cao hơn (D-93), rồi gần hơn, rồi thứ tự đầu vào. Trả mã điểm theo thứ tự đi.
 */
export function sequenceStops(input: RouteInput): string[] {
  let remaining: Candidate[] = input.stops.map((stop, index) => ({
    stop,
    index,
    deadlineMs: stop.deadline === undefined ? Infinity : parseTime(stop.deadline),
    priority: stop.priority ?? DEFAULT_STOP_PRIORITY,
  }))
  let position = input.depot
  let clockMs = parseTime(input.departureTime)
  const ordered: string[] = []

  while (remaining.length > 0) {
    const near = nearest(position, remaining)
    const nearEtaMs = clockMs + travelMs(position, near.stop.location)
    const urgent = remaining.filter((candidate) => {
      if (candidate.deadlineMs === Infinity) return false
      const etaIfNearFirstMs = candidate === near ? nearEtaMs : nearEtaMs + SERVICE_MS + travelMs(near.stop.location, candidate.stop.location)
      return etaIfNearFirstMs > candidate.deadlineMs - AT_RISK_MARGIN_MS
    })
    const next = mostUrgent(position, urgent) ?? near

    ordered.push(next.stop.stopId)
    clockMs += travelMs(position, next.stop.location) + SERVICE_MS
    position = next.stop.location
    remaining = remaining.filter((candidate) => candidate !== next)
  }
  return ordered
}

/** Mock tối ưu tuyến: sắp thứ tự điểm rồi tính ETA, mức hạn, điểm trễ, tổng quãng đường và thời gian. Kết quả là MOCK RESULT. */
export function optimizeRoute(input: RouteInput): RouteResult {
  return routeEta(input, sequenceStops(input))
}
