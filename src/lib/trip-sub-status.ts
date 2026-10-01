import type { Formatter } from '@/lib/format'
import type { TFunction } from '@/lib/i18n'
import type { TripSubStatus } from '@/types/trip'

/**
 * Chữ của dòng phụ dưới trạng thái chuyến (FE-0-05), một chỗ cho mọi nơi in nó: nhãn `TripSubStatusTag` và cột "Chi tiết trạng thái"
 * của báo cáo .xlsx. Số của tiến độ kho format theo ngôn ngữ đang chọn.
 */
export function tripSubStatusLabel(sub: TripSubStatus, t: TFunction, format: Formatter): string {
  return sub.kind === 'loading'
    ? t('status.sub.loading', { recorded: format.integer(sub.recorded), total: format.integer(sub.total) })
    : t(`status.sub.${sub.kind}`)
}
