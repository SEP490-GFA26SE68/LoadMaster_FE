import { useMemo } from 'react'
import type { OptimizationRequest, OptimizationResult } from '@/domain/models'
import { useFormat, useT } from '@/lib/i18n'
import { howEntries, planFacts, type HowMetric } from './how-entries'
import { HowComputed } from './HowComputed'

/**
 * "Tính thế nào?" cho các số của một phương án: dựng từng dòng công thức từ `result.metrics` và xe của chính `request` đã chạy
 * (`planFacts`), theo đúng thứ tự `metrics` — là các số nơi gọi đang hiện. Dùng ở bộ chọn dưới khung 3D mở đầu, thẻ phương án của
 * "Thử với hàng của bạn" và bảng số của `/phuong-an-mau`.
 */
export function PlanHow({ request, result, metrics, subject, tone, note, className }: {
  request: Pick<OptimizationRequest, 'vehicle'>
  result: Pick<OptimizationResult, 'metrics'>
  metrics: readonly HowMetric[]
  subject?: string
  tone?: 'light' | 'dark'
  note?: string
  className?: string
}) {
  const t = useT()
  const format = useFormat()
  const entries = useMemo(() => howEntries(planFacts(request, result), metrics, t, format), [request, result, metrics, t, format])
  return <HowComputed entries={entries} subject={subject} tone={tone} note={note} className={className} />
}
