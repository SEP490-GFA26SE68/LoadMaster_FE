import { haversineKm, type GeoPoint } from './haversine'

/**
 * Hằng số của mock tối ưu tuyến (D-76). **Đề xuất FE — chờ nghiệp vụ xác nhận** (PRD v2 mục 17.2): chưa có số nào do nghiệp vụ
 * chốt. Đây là chỗ duy nhất khai chúng; đổi ở đây là đổi cả thứ tự điểm, ETA và mức hạn.
 */
export const ROUTING_CONSTANTS = {
  /** Hệ số đổi khoảng cách đường chim bay sang quãng đường ước lượng. */
  ROAD_FACTOR: 1.3,
  /** Tốc độ trung bình, km/h. */
  AVERAGE_SPEED_KMH: 50,
  /** Thời gian dừng ở mỗi điểm đã qua, phút. */
  SERVICE_MINUTES_PER_STOP: 15,
  /** Ngưỡng "sát hạn": ETA nằm trong khoảng này trước hạn thì là `AT_RISK`, phút. */
  AT_RISK_MARGIN_MINUTES: 30,
  /**
   * Giờ nghỉ bắt buộc của tài xế (FE-BL-04). **Đề xuất FE — chờ nghiệp vụ xác nhận** (PRD v2 mục 17.2): lái liên tục quá chừng này thì
   * phải nghỉ `REST_MINUTES` rồi mới lái tiếp. Dừng ở một điểm giao từ `REST_MINUTES` trở lên cũng tính là đã nghỉ (đặt lại bộ đếm lái
   * liên tục). **Chưa mô hình hoá** giới hạn lái theo ngày, theo tuần.
   */
  MAX_CONTINUOUS_DRIVING_MINUTES: 240,
  /** Thời gian mỗi lần nghỉ bắt buộc, phút. */
  REST_MINUTES: 15,
} as const

/** Ưu tiên của điểm khi yêu cầu giao không khai (D-93: Khẩn 4 · Cao 3 · Bình thường 2 · Thấp 1). */
export const DEFAULT_STOP_PRIORITY = 2

const MS_PER_MINUTE = 60_000
export const SERVICE_MS = ROUTING_CONSTANTS.SERVICE_MINUTES_PER_STOP * MS_PER_MINUTE
export const AT_RISK_MARGIN_MS = ROUTING_CONSTANTS.AT_RISK_MARGIN_MINUTES * MS_PER_MINUTE
export const MAX_DRIVING_MS = ROUTING_CONSTANTS.MAX_CONTINUOUS_DRIVING_MINUTES * MS_PER_MINUTE
export const REST_MS = ROUTING_CONSTANTS.REST_MINUTES * MS_PER_MINUTE

export type DeadlineStatus = 'OK' | 'AT_RISK' | 'MISSED'

export type RouteStopInput = {
  readonly stopId: string
  readonly location: GeoPoint
  /** Hạn giao, ISO 8601. Không có hạn thì điểm không có mức hạn. */
  readonly deadline?: string
  /** Số lớn hơn đi trước khi hai điểm ngang nhau (D-93); mặc định `DEFAULT_STOP_PRIORITY`. */
  readonly priority?: number
}

export type RouteInput = {
  readonly depot: GeoPoint
  /** Giờ xuất phát từ kho, ISO 8601. */
  readonly departureTime: string
  readonly stops: readonly RouteStopInput[]
}

export type RouteStopResult = {
  readonly stopId: string
  /** Giờ đến dự kiến, ISO 8601 (UTC). */
  readonly eta: string
  /** Chỉ có khi điểm có hạn. */
  readonly deadlineStatus?: DeadlineStatus
}

export type RouteResult = {
  readonly orderedStopIds: readonly string[]
  readonly stops: readonly RouteStopResult[]
  /** Điểm `MISSED`, theo thứ tự đi. */
  readonly missedStopIds: readonly string[]
  /** Quãng đường ước lượng kho → điểm cuối (đường chim bay × hệ số đường), làm tròn 0,1 km. */
  readonly totalKm: number
  /** Từ lúc xuất phát tới khi xong điểm cuối (gồm thời gian dừng ở mọi điểm và giờ nghỉ bắt buộc), phút nguyên. */
  readonly totalMinutes: number
  /** Số lần tài xế phải nghỉ bắt buộc trên cả tuyến (FE-BL-04); vắng khi không chặng nào dài tới mức đó. */
  readonly restCount?: number
  /** Tổng thời gian nghỉ bắt buộc, phút — đã nằm trong `totalMinutes`; cùng điều kiện với `restCount`. */
  readonly restMinutes?: number
}

export function parseTime(iso: string): number {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) throw new Error(`Mốc giờ không hợp lệ: ${iso}`)
  return ms
}

/** Quãng đường ước lượng giữa hai điểm, km (chưa làm tròn). */
export function roadKm(from: GeoPoint, to: GeoPoint): number {
  return haversineKm(from, to) * ROUTING_CONSTANTS.ROAD_FACTOR
}

/** Thời gian chạy một chặng, ms nguyên — mọi phép cộng và so sánh giờ sau đó là số nguyên, không lệch dấu phẩy động. */
export function travelMs(from: GeoPoint, to: GeoPoint): number {
  return Math.round((roadKm(from, to) / ROUTING_CONSTANTS.AVERAGE_SPEED_KMH) * 60 * MS_PER_MINUTE)
}

export type LegSchedule = {
  /** Các đoạn lái liên tục của chặng, ms; sau mỗi đoạn — trừ đoạn cuối — là một lần nghỉ bắt buộc. */
  readonly chunks: readonly number[]
  /** Số lần nghỉ bắt buộc trên chặng. */
  readonly rests: number
  /** Cả chặng gồm giờ nghỉ, ms. */
  readonly totalMs: number
  /** Thời gian lái liên tục đã tích luỹ khi tới cuối chặng, ms. */
  readonly drivenAfterMs: number
}

/**
 * Một chặng chạy `travel` ms khi tài xế đã lái liên tục `drivenBeforeMs`: lái tới đủ `MAX_DRIVING_MS` mà còn đường thì nghỉ
 * `REST_MS`, rồi lái tiếp với bộ đếm về 0. Tới đích đúng lúc đủ giờ lái thì không nghỉ — nghỉ chỉ chen vào khi còn đường phải đi.
 * Nguồn duy nhất của giờ nghỉ cho ETA kế hoạch, ETA trực tiếp và xe mô phỏng.
 */
export function legWithRests(travel: number, drivenBeforeMs = 0): LegSchedule {
  const chunks: number[] = []
  let remaining = travel
  let driven = drivenBeforeMs
  while (remaining > 0) {
    const room = Math.max(0, MAX_DRIVING_MS - driven)
    if (remaining <= room) {
      chunks.push(remaining)
      driven += remaining
      remaining = 0
    } else {
      chunks.push(room)
      remaining -= room
      driven = 0
    }
  }
  const rests = Math.max(0, chunks.length - 1)
  return { chunks, rests, totalMs: travel + rests * REST_MS, drivenAfterMs: driven }
}

/** Bộ đếm lái liên tục sau khi xe dừng `stopMs` ở một điểm: dừng từ `REST_MS` trở lên thì tài xế đã nghỉ đủ, bộ đếm về 0. */
export function drivenAfterStop(drivenMs: number, stopMs: number): number {
  return stopMs >= REST_MS ? 0 : drivenMs
}

/** Mức hạn của một điểm có hạn: `OK` khi ETA ≤ hạn − 30 phút, `AT_RISK` khi ETA ≤ hạn, còn lại `MISSED`. Tham số là epoch ms. */
export function deadlineStatusAt(etaMs: number, deadlineMs: number): DeadlineStatus {
  if (etaMs <= deadlineMs - AT_RISK_MARGIN_MS) return 'OK'
  return etaMs <= deadlineMs ? 'AT_RISK' : 'MISSED'
}

/** Như `deadlineStatusAt`, nhận mốc giờ ISO — dùng lại ở giám sát (ETA tính từ vị trí xe). */
export function deadlineStatus(eta: string, deadline: string): DeadlineStatus {
  return deadlineStatusAt(parseTime(eta), parseTime(deadline))
}

/**
 * ETA cho **đúng thứ tự được đưa vào** (thứ tự do người dùng đặt), không sắp lại: ETA điểm thứ i = giờ xuất phát + tổng thời gian
 * chạy các chặng tới nó + 15 phút cho mỗi điểm đã qua + giờ nghỉ bắt buộc của tài xế trên các chặng dài (`legWithRests`). `orderedStopIds` phải là một hoán vị của các điểm trong `input`.
 */
export function routeEta(input: RouteInput, orderedStopIds: readonly string[]): RouteResult {
  const byId = new Map(input.stops.map((stop) => [stop.stopId, stop]))
  if (byId.size !== input.stops.length) throw new Error('Mã điểm giao bị trùng')
  if (orderedStopIds.length !== byId.size || new Set(orderedStopIds).size !== byId.size) {
    throw new Error('Thứ tự điểm phải gồm đúng một lần mỗi điểm của chuyến')
  }

  const departureMs = parseTime(input.departureTime)
  let position = input.depot
  let clockMs = departureMs
  let km = 0
  let driven = 0
  let restCount = 0
  const stops: RouteStopResult[] = []
  for (const stopId of orderedStopIds) {
    const stop = byId.get(stopId)
    if (!stop) throw new Error(`Điểm ${stopId} không thuộc chuyến`)
    km += roadKm(position, stop.location)
    const leg = legWithRests(travelMs(position, stop.location), driven)
    const etaMs = clockMs + leg.totalMs
    const eta = new Date(etaMs).toISOString()
    stops.push(stop.deadline === undefined ? { stopId, eta } : { stopId, eta, deadlineStatus: deadlineStatusAt(etaMs, parseTime(stop.deadline)) })
    restCount += leg.rests
    driven = drivenAfterStop(leg.drivenAfterMs, SERVICE_MS)
    clockMs = etaMs + SERVICE_MS
    position = stop.location
  }

  return {
    orderedStopIds: [...orderedStopIds],
    stops,
    missedStopIds: stops.filter((stop) => stop.deadlineStatus === 'MISSED').map((stop) => stop.stopId),
    totalKm: Math.round(km * 10) / 10,
    totalMinutes: Math.round((clockMs - departureMs) / MS_PER_MINUTE),
    ...(restCount === 0 ? {} : { restCount, restMinutes: restCount * ROUTING_CONSTANTS.REST_MINUTES }),
  }
}

/** Điểm chưa hoàn tất của chuyến đang chạy. `arrivedAt` chỉ có nghĩa ở điểm đầu danh sách: xe đang đứng ở đó từ lúc ấy (ISO 8601). */
export type LiveEtaStop = RouteStopInput & { readonly arrivedAt?: string }

export type LiveEtaInput = {
  /** Vị trí xe — mô phỏng hay GPS thật đều chỉ tính từ đây. */
  readonly position: GeoPoint
  /** Thời điểm của vị trí, ISO 8601. */
  readonly at: string
  /** Các điểm chưa hoàn tất, theo thứ tự đi. */
  readonly stops: readonly LiveEtaStop[]
  /** Thời gian tài xế đã lái liên tục tới `at`, ms (FE-BL-04). Vắng là 0: vị trí GPS thật không cho biết điều này. */
  readonly drivenMs?: number
  /** Xe đang nghỉ bắt buộc tại `position` tới lúc này (ISO 8601); sau đó bộ đếm lái liên tục về 0. */
  readonly restEndsAt?: string
}

export type LiveStopEta = RouteStopResult & {
  /** Xe đã tới điểm: `eta` là giờ đến. */
  readonly arrived?: true
}

/**
 * ETA trực tiếp của các điểm chưa hoàn tất (FE-6-09, PRD v2 mục 8.6) — cùng công thức D-76, tính **từ vị trí xe**: điểm kế tiếp =
 * thời điểm của vị trí + thời gian chạy từ vị trí tới điểm; mỗi điểm sau cộng 15 phút dừng và thời gian chạy chặng đó. Xe đang đứng ở
 * điểm đầu thì giờ đến của điểm đó là giờ đến thật, và xe rời điểm sau 15 phút kể từ lúc đến — đã đứng quá 15 phút thì tính từ bây giờ.
 * **Không** có tham số phút chậm của sự cố: sự cố làm xe đứng lại, ETA tự dời theo vị trí. Giờ nghỉ bắt buộc (FE-BL-04) thì có: tính từ
 * bộ đếm lái liên tục của xe (`drivenMs`) và, khi xe đang nghỉ, từ lúc nghỉ xong (`restEndsAt`) — để xe mô phỏng không tới điểm sớm hơn ETA.
 */
export function liveEta({ position, at, stops, drivenMs = 0, restEndsAt }: LiveEtaInput): LiveStopEta[] {
  const nowMs = parseTime(at)
  const restEndMs = restEndsAt === undefined ? -Infinity : parseTime(restEndsAt)
  const resting = restEndMs > nowMs
  let from = position
  let leaveMs = resting ? restEndMs : nowMs
  let driven = resting ? 0 : drivenMs
  return stops.map((stop, index) => {
    const arrivedMs = index === 0 && stop.arrivedAt !== undefined ? parseTime(stop.arrivedAt) : undefined
    let etaMs: number
    if (arrivedMs === undefined) {
      const leg = legWithRests(travelMs(from, stop.location), driven)
      etaMs = leaveMs + leg.totalMs
      leaveMs = etaMs + SERVICE_MS
      driven = drivenAfterStop(leg.drivenAfterMs, SERVICE_MS)
    } else {
      etaMs = arrivedMs
      leaveMs = Math.max(arrivedMs + SERVICE_MS, nowMs)
      driven = drivenAfterStop(driven, leaveMs - arrivedMs)
    }
    from = stop.location
    return {
      stopId: stop.stopId,
      eta: new Date(etaMs).toISOString(),
      ...(stop.deadline === undefined ? {} : { deadlineStatus: deadlineStatusAt(etaMs, parseTime(stop.deadline)) }),
      ...(arrivedMs === undefined ? {} : { arrived: true as const }),
    }
  })
}
