import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { dateOnly } from './trip-dates'

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

/** Ngày `YYYY-MM-DD` cộng `days` ngày, vẫn `YYYY-MM-DD` (tính trên lịch, không qua múi giờ). */
function addDays(date: string, days: number): string {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

/**
 * Dòng nhóm của bảng chuyến (`v3.css` `tr.group`): "Thứ Bảy, 26/09 · 1 chuyến", nhãn "Hôm nay" (cyan đặc) hoặc "Ngày mai" (cyan
 * nhạt). Ngày khác năm nay thì in cả năm để không nhầm. Số chuyến đếm trên cả danh sách đã lọc, không riêng trang đang xem.
 */
export function TripDateGroupHeader({ date, today, count, columnCount }: {
  date: string
  today: string
  count: number
  columnCount: number
}) {
  const t = useT()
  const format = useFormat()
  const day = dateOnly(date)
  const shown = date.slice(0, 4) === today.slice(0, 4) ? format.dayMonth(day) : format.date(day)
  const tag = date === today ? 'today' : date === addDays(today, 1) ? 'tomorrow' : null
  return (
    <tr className="h-9">
      <th
        scope="rowgroup"
        colSpan={columnCount}
        className="border-b border-line-soft bg-surface px-3.5 text-left text-fine leading-none font-semibold text-ink-2"
      >
        <span className="flex items-center gap-2">
          {tag ? (
            <span
              className={cn(
                'inline-flex h-5 items-center rounded-sm px-2 text-caption font-semibold',
                tag === 'today' ? 'bg-cyan-400 text-cyan-950' : 'bg-cyan-50 text-cyan-800 shadow-[inset_0_0_0_1px_var(--cyan-200)]',
              )}
            >
              {t(`trips.list.group.${tag}`)}
            </span>
          ) : null}
          <span>{t('trips.list.group.day', { weekday: t(`trips.list.weekdays.${WEEKDAYS[day.getDay()] ?? 'sun'}`), date: shown })}</span>
          <span className="font-normal text-ink-3">{t('trips.list.group.count', { count })}</span>
        </span>
      </th>
    </tr>
  )
}
