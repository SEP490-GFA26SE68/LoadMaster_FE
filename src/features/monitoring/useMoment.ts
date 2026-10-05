import { useFormat, useT } from '@/lib/i18n'

/** Hàm đọc một mốc ISO thành "giờ ngày" theo ngôn ngữ đang chọn — mọi mốc giờ của màn Giám sát viết cùng một kiểu. */
export function useMoment(): (iso: string) => string {
  const t = useT()
  const format = useFormat()
  return (iso) => t('monitoring.moment', { time: format.time(iso), date: format.dayMonth(iso) })
}
