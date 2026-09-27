import { useFormat, useT } from '@/lib/i18n'
import { dateOnly, runDateHint, todayInVietnam } from './trip-dates'

/**
 * Chữ của ngày chạy trên form chuyến: gợi ý dưới ô ("Thứ Sáu · ngày mai"), ngày kèm thứ trong thẻ kiểm tra ("Thứ Sáu, 25/09/2026")
 * và ở dòng phụ của đầu màn sửa ("Hôm nay, 24/09/2026"). "Hôm nay" theo giờ Việt Nam như ngày chạy mặc định.
 */
export function useRunDateText() {
  const t = useT()
  const format = useFormat()
  const today = todayInVietnam()
  return {
    hint(date: string): string | undefined {
      const hint = runDateHint(date, today)
      if (!hint) return undefined
      const weekday = t(`trips.create.weekdays.${hint.weekday}`)
      return hint.relative ? t('trips.create.dateHint', { weekday, relative: t(`trips.create.relativeDay.${hint.relative}`) }) : weekday
    },
    /** "Thứ Sáu, 25/09/2026"; `relative` thì "Hôm nay, 24/09/2026" khi ngày chạy là hôm qua / hôm nay / ngày mai. */
    withDay(date: string, { relative = false }: { relative?: boolean } = {}): string | null {
      const hint = runDateHint(date, today)
      if (!hint) return null
      const day = relative && hint.relative
        ? t(`trips.create.relativeDayTitle.${hint.relative}`)
        : t(`trips.create.weekdays.${hint.weekday}`)
      return t('trips.create.dayAndDate', { day, date: format.date(dateOnly(date)) })
    },
  }
}
