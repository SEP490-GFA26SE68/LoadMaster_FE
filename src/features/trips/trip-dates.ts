import { addDays, vnDate } from '@/lib/mock-db'

/**
 * Ngày chạy `YYYY-MM-DD` thành mốc nửa đêm **giờ máy** để `format.date` in đúng ngày đó ở mọi múi giờ. `new Date('2026-09-14')` là
 * nửa đêm UTC: máy ở múi giờ âm in ra 13/09.
 */
export function dateOnly(date: string): Date {
  return new Date(`${date}T00:00:00`)
}

/** Hôm nay theo giờ Việt Nam, `YYYY-MM-DD`: ngày chạy mặc định của chuyến mới. */
export function todayInVietnam(): string {
  return vnDate(new Date())
}

export const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
export type Weekday = (typeof WEEKDAYS)[number]
export type RelativeDay = 'yesterday' | 'today' | 'tomorrow'

/**
 * Gợi ý dưới ô ngày chạy ("Thứ Sáu · ngày mai", V2.3 TaoChuyen.jpg): thứ trong tuần và, khi ngày chạy là hôm qua / hôm nay / ngày
 * mai theo giờ Việt Nam, từ chỉ ngày tương đối. Trả mã, component dịch. Ngày không hợp lệ thì `null`.
 */
export function runDateHint(date: string, today: string): { weekday: Weekday; relative: RelativeDay | null } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const [year, month, day] = date.split('-').map(Number)
  const at = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1))
  if (Number.isNaN(at.getTime())) return null
  const weekday = WEEKDAYS[at.getUTCDay()]
  if (!weekday) return null
  const relative: RelativeDay | null = date === today ? 'today'
    : date === addDays(today, 1) ? 'tomorrow'
      : date === addDays(today, -1) ? 'yesterday'
        : null
  return { weekday, relative }
}
