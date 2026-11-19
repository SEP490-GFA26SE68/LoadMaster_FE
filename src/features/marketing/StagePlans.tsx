import { useId } from 'react'
import { SKY_FOCUS } from '@/components/sky-focus'
import { Badge } from '@/components/ui/Badge'
import { PLAN_LABELS, PLAN_OBJECTIVES, type PlanLabel } from '@/domain/models'
import { useFormat, useT, type MessageKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { LandingPlan } from './landing-plans'
import { STAGE_SURFACE } from './LandingStageParts'
import { FIGURE_LABELS, FIGURE_ORDER, usePlanFigures } from './usePlanFigures'

/** Nút chọn trên nền tối: rê chuột là kính sáng, đang chọn là kính cyan có viền trong; vòng focus `--cyan-300` vẽ vào trong. */
const CHOICE = cn(
  'flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-md px-1.5 py-2 text-center text-sky-text-2',
  'shadow-[inset_0_0_0_1px_var(--border-dark)] transition-colors duration-(--dur-fast) ease-standard hover:bg-sky-glass hover:text-sky-text',
  'aria-pressed:bg-cyan-400/15 aria-pressed:text-sky-text aria-pressed:shadow-[inset_0_0_0_1px_var(--cyan-300)]',
  'forced-colors:aria-pressed:border-b-4 forced-colors:aria-pressed:border-transparent',
  'outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px]', SKY_FOCUS,
)
const LETTER = 'font-display text-h2 leading-7 font-bold text-sky-text font-stretch-112%'
const LABEL = 'text-small text-sky-text-3 pointer-coarse:text-body-lg'
const VALUE = 'font-mono text-body leading-6 whitespace-nowrap text-sky-text tabular-nums pointer-coarse:text-body-lg'
const BAR = 'block h-6 w-12 rounded-sm bg-sky-glass'

/** Một chỉ số: nhãn trên, số dưới, nhãn xám "Tốt nhất" cạnh số tốt nhất (số in đậm hơn) — không tô xanh hay đỏ. Chưa có số: vạch giữ chỗ. */
function FigureCell({ label, value, best }: { label: MessageKey; value?: string; best?: boolean }) {
  const t = useT()
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className={LABEL}>{t(label)}</span>
      {value === undefined ? <span aria-hidden className={BAR} /> : (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn(VALUE, best ? 'font-semibold' : 'font-normal')}>{value}</span>
          {best ? <Badge shape="tag" className="pointer-coarse:text-body-lg">{t('landingStage.plans.best')}</Badge> : null}
        </span>
      )}
    </span>
  )
}

/**
 * Bộ chọn "Một lần chạy, ba phương án" dưới khung 3D: một lần chạy của bộ tối ưu mô phỏng ra ba phương án A · B · C theo ba mục tiêu;
 * ba nút 56 px (`aria-pressed`, tên truy cập "Phương án A — Tối đa thể tích"), chọn một thì khung 3D xếp lại theo nó, và dưới nút là số
 * của phương án đang chọn — mọi số đọc từ chính lần chạy đó. Bảng so cả ba phương án nằm ở chặng điều phối của "Một chuyến hàng".
 * `plans` rỗng: cùng bố cục, chỉ nhãn và vạch giữ chỗ (dải không nhảy khi số hiện ra).
 */
export function StagePlans({ plans, selected, onSelect, total, className }: {
  plans: readonly LandingPlan[] | null
  selected: PlanLabel
  onSelect: (label: PlanLabel) => void
  /** Số kiện của yêu cầu mẫu. */
  total: number
  className?: string
}) {
  const t = useT()
  const format = useFormat()
  const titleId = useId()
  const figures = usePlanFigures(plans)
  const picked = figures?.get(selected)?.filter((figure) => figure.value !== null)

  return (
    <section aria-labelledby={titleId} data-stage-plans={plans ? 'ready' : 'pending'} className={cn(STAGE_SURFACE, 'flex flex-col gap-3 rounded-lg px-4 py-3', className)}>
      <div className="flex flex-col gap-0.5 md:flex-row md:flex-wrap md:items-baseline md:gap-x-3">
        <p id={titleId} className="m-0 text-small font-semibold text-sky-text-2 pointer-coarse:text-body-lg">{t('landingStage.plans.title')}</p>
        <p className="m-0 text-small text-sky-text-3 pointer-coarse:text-body-lg">
          {plans ? t('landingStage.plans.note', { count: format.integer(total) }) : t('landingStage.plans.pending')}
        </p>
      </div>
      <div role={plans ? 'group' : undefined} aria-labelledby={plans ? titleId : undefined} aria-hidden={plans ? undefined : true} className="grid grid-cols-3 gap-2">
        {PLAN_OBJECTIVES.map((objective) => {
          const label = PLAN_LABELS[objective]
          const plan = plans?.find((candidate) => candidate.id === label)
          const body = (
            <>
              <span className={LETTER}>{label}</span>
              <span className="text-small leading-tight font-medium text-balance pointer-coarse:text-body-lg max-[23rem]:text-small">
                {t(`runs.objectives.${objective}`)}
              </span>
            </>
          )
          return plan ? (
            <button key={label} type="button" aria-pressed={label === selected}
              aria-label={t('landingStage.plans.name', { label, objective: t(`runs.objectives.${objective}`) })}
              onClick={() => { if (label !== selected) onSelect(label) }} className={CHOICE}>
              {body}
            </button>
          ) : <div key={label} className={CHOICE}>{body}</div>
        })}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 md:grid-cols-4" data-stage-plan-figures="">
        {(picked ?? FIGURE_ORDER.map((metric) => ({ metric, label: FIGURE_LABELS[metric], value: undefined, best: false }))).map((row) => (
          <FigureCell key={row.metric} label={row.label} value={row.value ?? undefined} best={row.best} />
        ))}
      </div>
    </section>
  )
}
