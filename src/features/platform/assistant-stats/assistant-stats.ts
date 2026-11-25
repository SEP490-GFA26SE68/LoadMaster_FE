import { addDays } from '@/lib/mock-db'

/**
 * Luật thuần của màn số đếm xu hướng của trợ lý Lumo `/nen-tang/tro-ly-lumo`: tỉ lệ, ngưỡng "nên xem lại câu soạn sẵn" và khoảng ngày.
 * Không React, không mạng — màn và test cùng đọc ở đây.
 */

/** Năm đường trả lời của trợ lý trang công khai, theo thứ tự của bảng trên màn. */
export const ASSISTANT_ROUTES = ['SMALL_TALK', 'PREPARED', 'ESCALATED', 'MODEL', 'CACHED'] as const
export type AssistantRoute = (typeof ASSISTANT_ROUTES)[number]
export type RouteCounts = Readonly<Record<AssistantRoute, number>>

/** Một chủ đề của bộ câu soạn sẵn; `topicId` `null` là không rõ chủ đề. */
export type TopicStats = { readonly topicId: string | null; readonly total: number; readonly byRoute: RouteCounts }

export type AssistantRouteStats = {
  /** Khoảng ngày máy chủ đã đếm, `YYYY-MM-DD` giờ Việt Nam, gồm cả hai đầu. */
  readonly from: string
  readonly to: string
  readonly total: number
  readonly byRoute: RouteCounts
  /** Nhiều lượt trước, như máy chủ trả. */
  readonly byTopic: readonly TopicStats[]
  /** Mã ngôn ngữ → số lượt; mã nào máy chủ không đếm được thì vắng. */
  readonly byLocale: Readonly<Record<string, number>>
  /** Máy chủ không đọc được nơi lưu bền: số chỉ là phần một máy chủ còn giữ trong bộ nhớ. */
  readonly partial: boolean
}

/** Chủ đề có tỉ lệ hỏi chi tiết từ mức này trở lên… */
export const REVIEW_ESCALATION_RATIO = 0.3
/** …và ít nhất chừng này lượt trả câu soạn sẵn thì nên xem lại câu soạn sẵn — ít lượt hơn thì một hai lần bấm đã đủ làm tỉ lệ cao. */
export const REVIEW_MIN_PREPARED = 5

/** Máy chủ đếm tối đa 90 ngày một lần (gồm hai đầu), mặc định 30 ngày tới hôm nay. */
export const MAX_RANGE_DAYS = 90
export const DEFAULT_RANGE_DAYS = 30
export const QUICK_RANGES = [7, 30, 90] as const

/** `part / whole`, hoặc `null` khi mẫu số là 0 — màn hiện "—" kèm lý do, không chia cho 0. */
export function ratioOf(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null
}

/** Lượt trả lời ngay mà không gọi mô hình: câu xã giao, câu soạn sẵn, câu lấy lại từ bộ nhớ đệm. */
export function answeredWithoutModel(byRoute: RouteCounts): number {
  return byRoute.SMALL_TALK + byRoute.PREPARED + byRoute.CACHED
}

/** Tỉ lệ khách bấm "Hỏi Lumo chi tiết" trên số lượt nhận câu soạn sẵn. */
export function escalationRate(byRoute: RouteCounts): number | null {
  return ratioOf(byRoute.ESCALATED, byRoute.PREPARED)
}

/** Chủ đề khách hay hỏi chi tiết sau câu soạn sẵn: câu soạn sẵn chưa đủ, nên sửa hoặc thêm chủ đề. */
export function needsReview(byRoute: RouteCounts): boolean {
  const rate = escalationRate(byRoute)
  return byRoute.PREPARED >= REVIEW_MIN_PREPARED && rate !== null && rate >= REVIEW_ESCALATION_RATIO
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function isDate(value: string): boolean {
  // Ngày không có thật (30/02) trôi sang ngày khác khi dựng lại
  return ISO_DATE.test(value) && addDays(value, 0) === value
}

/** Số ngày của khoảng, gồm cả hai đầu. */
export function rangeDays(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1
}

/** `days` ngày kết thúc ở `today` (gồm cả hôm nay). */
export function lastDays(today: string, days: number): { readonly from: string; readonly to: string } {
  return { from: addDays(today, -(days - 1)), to: today }
}

export type RangeIssue = 'invalid' | 'order' | 'tooLong'

/** Lý do khoảng ngày không gửi được cho máy chủ, hoặc `null` khi gửi được. */
export function rangeIssue(from: string, to: string): RangeIssue | null {
  if (!isDate(from) || !isDate(to)) return 'invalid'
  if (from > to) return 'order'
  if (rangeDays(from, to) > MAX_RANGE_DAYS) return 'tooLong'
  return null
}
