import { expandPackages } from '@/domain/cargo'
import type { Formatter } from '@/lib/format'
import type { TFunction } from '@/lib/i18n'
import type { Trip } from '@/lib/mock-db'

/**
 * Chữ của báo cáo chuyến (LM-104): thời lượng giữa hai mốc đã ghi, khoảng giờ, tên kiện theo mã instance. Thời lượng làm tròn tới phút;
 * thiếu mốc thì "—" chứ không đoán (báo cáo không bịa số).
 */
export function formatDuration(ms: number | null, t: TFunction, format: Formatter): string {
  if (ms === null || ms < 0) return t('tripReport.duration.none')
  const total = Math.round(ms / 60_000)
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  if (hours === 0) return t('tripReport.duration.minutes', { minutes: format.integer(minutes) })
  if (minutes === 0) return t('tripReport.duration.hours', { hours: format.integer(hours) })
  return t('tripReport.duration.hoursMinutes', { hours: format.integer(hours), minutes: format.integer(minutes) })
}

/** "07:10 – 08:25 · 07/09/2026"; thiếu một mốc thì câu nói chưa đủ mốc. */
export function formatTimeRange(start: string | null, end: string | null, t: TFunction, format: Formatter): string {
  if (start === null || end === null) return t('tripReport.kpi.noTime')
  return t('tripReport.kpi.timeRange', { start: format.time(start), end: format.time(end), date: format.date(start) })
}

/** Tên dòng kiện của một instance (`PKG-003-12` → tên của `PKG-003`). */
export function packageNames(packages: Trip['packages']): (instanceId: string) => string {
  const { packageIdByInstanceId } = expandPackages(packages)
  const names = new Map(packages.map((pkg) => [pkg.id, pkg.name]))
  return (instanceId) => names.get(packageIdByInstanceId.get(instanceId) ?? '') ?? ''
}
