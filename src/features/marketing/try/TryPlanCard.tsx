import type { ReactNode } from 'react'
import { PlanThumbnail } from '@/components/PlanThumbnail'
import { Badge } from '@/components/ui/Badge'
import { PLAN_LABELS, type PlanObjective } from '@/domain/models'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { TryMetric, TryOutcome, TryPlan } from './try-outcome'

const ROW = 'flex items-baseline justify-between gap-3 border-t border-line-soft py-2'
const LABEL = 'm-0 text-small text-ink-2 pointer-coarse:text-body-lg'
const VALUE = 'm-0 flex flex-col items-end gap-1 text-right'
const FIGURE = 'font-mono text-body whitespace-nowrap text-ink-strong tabular-nums pointer-coarse:text-body-lg'
/** Vạch giữ chỗ cho số chưa có (trước lần chạy đầu, trong lúc tính): `aria-hidden`, câu ở cột kết quả nói vì sao chưa có. */
const BAR = 'block h-5 w-14 rounded-sm bg-n-100'
const THUMB = 'h-[132px] rounded-md'

/** Đầu thẻ: chữ cái lớn và mục tiêu của phương án (`runs.objectives`) — `<h4>` để trình đọc màn hình nhảy giữa ba thẻ. */
function PlanHeading({ objective, extra }: { objective: PlanObjective; extra?: ReactNode }) {
  const t = useT()
  const label = PLAN_LABELS[objective]
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <h4 className="m-0 flex items-baseline gap-2">
        <span aria-hidden className="font-display text-h1 leading-none font-bold text-ink-strong font-stretch-112%">{label}</span>
        <span className="sr-only">{t('landingTry.results.plan', { label })}:</span>
        <span className="text-small font-semibold text-balance text-ink-2 pointer-coarse:text-body-lg">{t(`runs.objectives.${objective}`)}</span>
      </h4>
      {extra}
    </div>
  )
}

/** Thẻ giữ chỗ của một phương án trước khi có số: đầu thẻ thật, hình và số là vạch. */
export function TryPlanPlaceholder({ objective, rows }: { objective: PlanObjective; rows: readonly string[] }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-bg p-4">
      <PlanHeading objective={objective} />
      <span aria-hidden className={cn(THUMB, 'block bg-n-100')} />
      <dl className="m-0">
        {rows.map((row) => (
          <div key={row} className={ROW}>
            <dt className={LABEL}>{row}</dt>
            <dd className="m-0"><span aria-hidden className={BAR} /></dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** Một hàng số; số tốt nhất in đậm kèm nhãn xám "Tốt nhất" (trung tính, không tô xanh hay đỏ — như màn So sánh). */
function Row({ label, value, best }: { label: string; value: string; best: boolean }) {
  const t = useT()
  return (
    <div className={ROW}>
      <dt className={LABEL}>{label}</dt>
      <dd className={VALUE}>
        <span className={cn(FIGURE, best ? 'font-semibold' : 'font-normal')}>{value}</span>
        {best ? <Badge shape="tag" className="pointer-coarse:text-body-lg">{t('landingStage.plans.best')}</Badge> : null}
      </dd>
    </div>
  )
}

/**
 * Một phương án của lần thử: chữ cái + mục tiêu, hình đẳng cự SVG dựng từ chỗ xếp thật (màu theo điểm giao), rồi các số của chính kết quả
 * — xếp được / tổng, lấp đầy thể tích, trọng tâm lệch giữa thùng, số kiện dỡ-xếp lại (chỉ khi hàng có từ hai điểm giao), kiện chưa xếp theo
 * loại kèm lý do. Hai mục tiêu chọn trùng một cách xếp thì thẻ nói "Giống hệt phương án …".
 */
export function TryPlanCard({ outcome, plan }: { outcome: TryOutcome; plan: TryPlan }) {
  const t = useT()
  const format = useFormat()
  const best = (metric: TryMetric) => outcome.best[metric]?.has(plan.id) ?? false
  return (
    <div role="group" aria-label={t('landingTry.results.plan', { label: plan.id })} className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-bg p-4">
      <PlanHeading
        objective={plan.objective}
        extra={plan.sameAs ? <Badge shape="tag" className="pointer-coarse:text-body-lg">{t('landingTry.results.sameAs', { label: plan.sameAs })}</Badge> : null}
      />
      <PlanThumbnail
        revisionId={t('landingTry.results.plan', { label: plan.id })}
        request={outcome.request}
        placements={plan.result.placements}
        totalCount={outcome.totalCount}
        className={THUMB}
        // Số "xếp được" nằm ngay hàng dưới: không lặp lại bằng chữ 11 px đè trên hình
        overlays={false}
      />
      <dl className="m-0">
        <Row
          label={t('landingTry.results.placed')}
          value={t('landingTry.results.placedValue', { placed: format.integer(plan.placedCount), total: format.integer(outcome.totalCount) })}
          best={best('placed')}
        />
        <Row label={t('landingTry.results.volume')} value={format.percent(plan.volumePercent)} best={best('volume')} />
        <Row
          label={t('landingTry.results.balance')}
          value={plan.balanceCm === null ? '—' : format.length(plan.balanceCm)}
          best={best('balance')}
        />
        {outcome.multiStop ? (
          <Row
            label={t('landingTry.results.rehandling')}
            value={plan.rehandlingCount === null ? '—' : format.integer(plan.rehandlingCount)}
            best={best('rehandling')}
          />
        ) : null}
      </dl>
      {plan.unplaced.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="m-0 text-small font-semibold text-ink-2 pointer-coarse:text-body-lg">{t('landingTry.results.unplacedTitle')}</p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {plan.unplaced.map((item) => (
              <li key={`${item.kind}-${item.reason}`} className="text-small text-pretty text-ink-2 pointer-coarse:text-body-lg">
                {t('landingTry.results.unplacedRow', {
                  kind: item.kind + 1,
                  count: format.integer(item.count),
                  // Bản thử coi cửa sau là cả mặt cắt lòng thùng: "không lọt cửa" ở đây là kiện lớn hơn mặt cắt đó
                  reason: item.reason === 'DOOR_TOO_SMALL' ? t('landingTry.results.doorTooSmall') : t(`viewer.unplacedReasons.${item.reason}`),
                })}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
