/**
 * Ngày giờ của kho theo giờ Việt Nam (UTC+7, không có giờ mùa hè) — seed neo theo ngày (D-44) và bộ lọc nhật ký theo ngày
 * phải cùng một múi giờ dù máy chạy test ở UTC.
 */
const VN_OFFSET_MS = 7 * 60 * 60 * 1000

/** Ngày neo mặc định của seed: ngày chuyến mẫu `TRIP-2026-0914` chạy. Test không truyền `today` thì dùng ngày này. */
export const SEED_ANCHOR_DATE = '2026-09-14'

/** `YYYY-MM-DD` theo giờ Việt Nam của một thời điểm. */
export function vnDate(at: Date): string {
  return new Date(at.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10)
}

/** Giờ `HH:mm` theo giờ Việt Nam của một thời điểm. */
export function vnClock(at: Date): string {
  return new Date(at.getTime() + VN_OFFSET_MS).toISOString().slice(11, 16)
}

/** Ngày `YYYY-MM-DD` cộng `days` (âm là lùi). */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + days)).toISOString().slice(0, 10)
}

/** ISO 8601 (UTC) của giờ `HH:mm` ngày `date` theo giờ Việt Nam. */
export function vnTime(date: string, time: string): string {
  return new Date(Date.parse(`${date}T${time}:00+07:00`)).toISOString()
}

/** Tham số URL của đồng hồ mô phỏng (D-85): `?toc-do=60` là một giây thật bằng một phút của kho. */
export const CLOCK_SPEED_PARAM = 'toc-do'

/** Tua nhanh nhất một giờ mỗi giây: nhanh hơn thì một lần làm mới đã bỏ qua cả chuyến. */
export const MAX_CLOCK_SPEED = 3600

/**
 * Tốc độ đồng hồ đọc từ `location.search`: `?toc-do=<n>` tua nhanh n lần (tối đa `MAX_CLOCK_SPEED`); không có tham số, hoặc giá trị
 * không phải số lớn hơn 1, thì theo giờ thật.
 */
export function clockSpeedFrom(search: string): number {
  const speed = Number(new URLSearchParams(search).get(CLOCK_SPEED_PARAM) ?? '')
  return Number.isFinite(speed) && speed > 1 ? Math.min(speed, MAX_CLOCK_SPEED) : 1
}

/** Đồng hồ mô phỏng của kho (FE-6-08): mọi mốc giờ kho ghi và vị trí xe mô phỏng đọc cùng một đồng hồ này. */
export type SimClock = {
  now(): Date
  speed(): number
  /** Đổi tốc độ từ bây giờ: giờ của kho đi tiếp từ chỗ đang đứng, không nhảy — mốc giờ đã ghi không bao giờ nằm sau mốc ghi sau đó. */
  setSpeed(speed: number): void
}

/**
 * Đồng hồ chạy nhanh `speed` lần so với đồng hồ máy `wall`, bắt đầu **đúng giờ máy** lúc tạo: tạo kho không làm mốc giờ nào nhảy, seed
 * không có sự kiện ở tương lai. Ở tốc độ 1 (mặc định, và mọi test) đồng hồ trả thẳng giờ của `wall` — test tiêm `now` hay giả `Date`
 * thấy đúng giờ mình đặt.
 */
export function createSimClock(wall: () => Date, speed = 1): SimClock {
  let factor = speed
  // Mốc neo: giờ máy và giờ kho tại lần đổi tốc độ gần nhất. Chưa neo thì giờ kho là giờ máy.
  let anchor: { wall: number; sim: number } | null = null
  const simMs = (wallMs: number) => (anchor === null ? wallMs : anchor.sim + Math.round((wallMs - anchor.wall) * factor))
  if (speed !== 1) {
    const startMs = wall().getTime()
    anchor = { wall: startMs, sim: startMs }
  }
  return {
    now: () => (anchor === null ? wall() : new Date(simMs(wall().getTime()))),
    speed: () => factor,
    setSpeed(next) {
      const wallMs = wall().getTime()
      anchor = { wall: wallMs, sim: simMs(wallMs) }
      factor = next
    },
  }
}
