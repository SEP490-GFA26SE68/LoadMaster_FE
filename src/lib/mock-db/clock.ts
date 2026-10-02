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
