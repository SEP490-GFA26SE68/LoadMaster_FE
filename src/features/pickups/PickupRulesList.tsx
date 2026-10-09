import { CircleCheck, CircleX } from 'lucide-react'
import type { PickupRuleResult } from '@/domain/pickup'
import { Badge } from '@/components/ui/Badge'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { ruleText } from './pickup-rule-text'

/**
 * Mười luật nhận hàng dọc đường Đạt / Không đạt (FE-7-03, D-88). Mỗi dòng: icon, tên luật, chip Đạt / Không đạt (chữ, không chỉ màu) và
 * câu lý do dựng từ mã + tham số của kho. Luật 4–7 và 10 đọc kết quả xếp kiện nhận vào vùng trống (FE-BL-01), không còn là ước lượng. `touch`: chữ 16 px cho màn tài xế.
 */
export function PickupRulesList({ results, stopLabel, touch = false, className }: {
  results: readonly PickupRuleResult[]
  /** Nhãn của một điểm theo mã điểm của chuyến, cho luật 2. */
  stopLabel: (stopId: string) => string
  touch?: boolean
  className?: string
}) {
  const t = useT()
  const format = useFormat()
  return (
    <ol aria-label={t('pickups.rules.title')} className={cn('m-0 flex list-none flex-col divide-y divide-line-soft rounded-md border border-border p-0', className)}>
      {results.map((result) => (
        <li key={result.rule} data-rule={result.rule} data-passed={result.passed} className={cn('flex items-start gap-3 px-3.5 py-2.5', touch && 'py-3')}>
          {result.passed
            ? <CircleCheck aria-hidden className="mt-0.5 size-4.5 flex-none text-success" strokeWidth={1.75} />
            : <CircleX aria-hidden className="mt-0.5 size-4.5 flex-none text-danger" strokeWidth={1.75} />}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className={cn('font-semibold text-ink-strong', touch ? 'text-body-lg' : 'text-body')}>
                <span className="font-mono tabular-nums">{result.rule}.</span> {t(`pickups.rules.names.${result.rule}`)}
              </span>
              <Badge shape="tag" tone={result.passed ? 'success' : 'danger'}>{result.passed ? t('pickups.rules.pass') : t('pickups.rules.fail')}</Badge>
            </div>
            <span className={cn('text-ink-2', touch ? 'text-body-lg' : 'text-small')}>{ruleText(result, { t, format, stopLabel })}</span>
          </div>
        </li>
      ))}
    </ol>
  )
}
