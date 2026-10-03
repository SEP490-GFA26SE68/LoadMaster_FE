import type { Formatter } from '@/lib/format'
import type { TFunction } from '@/lib/i18n'
import type { TripSubStatus } from '@/types/trip'

/**
 * Chữ của dòng phụ dưới trạng thái chuyến (FE-0-05), một chỗ cho mọi nơi in nó: nhãn `TripSubStatusTag` và cột "Chi tiết trạng thái"
 * của báo cáo .xlsx. Số của tiến độ kho và số xác nhận tay chờ duyệt format theo ngôn ngữ đang chọn.
 */
export function tripSubStatusLabel(sub: TripSubStatus, t: TFunction, format: Formatter): string {
  if (sub.kind === 'loading') return t('status.sub.loading', { recorded: format.integer(sub.recorded), total: format.integer(sub.total) })
  if (sub.kind === 'manualPending') return t('status.sub.manualPending', { count: format.integer(sub.count) })
  return t(`status.sub.${sub.kind}`)
}
