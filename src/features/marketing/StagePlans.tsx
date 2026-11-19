import { useId, useMemo } from 'react'
import { PlanThumbnail } from '@/components/PlanThumbnail'
import { SKY_FOCUS } from '@/components/sky-focus'
import { Badge } from '@/components/ui/Badge'
import { PLAN_LABELS, PLAN_OBJECTIVES, type PlanLabel } from '@/domain/models'
import { bestCandidates, type CandidateMetric } from '@/lib/candidate-metrics'
import { useFormat, useT, type MessageKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { LandingPlan } from './landing-plans'
import { LANDING_REQUEST } from './landing-sample.mock'
import { STAGE_SURFACE } from './LandingStageParts'

/** `marked`: có phương án nào được đánh dấu tốt nhất ở chỉ số này — ô của mọi thẻ chừa chỗ cho nhãn để hàng số của ba thẻ thẳng nhau. */
type Figure = { metric: CandidateMetric; label: MessageKey; value: string | null; best: boolean; marked: boolean }

const LABELS = {
  volume: 'landingStage.plans.volume',
  axleGap: 'landingStage.plans.axleGap',
  rehandling: 'landingStage.plans.rehandling',
  unplaced: 'landingStage.plans.unplaced',
} as const satisfies Record<CandidateMetric, MessageKey>
const ORDER = ['volume', 'axleGap', 'rehandling', 'unplaced'] as const satisfies readonly CandidateMetric[]

/** Nút chọn trên nền tối: rê chuột là kính sáng, đang chọn là kính cyan có viền trong; vòng focus `--cyan-300` vẽ vào trong. */
const CHOICE = cn(
  'flex min-w-0 flex-col rounded-md text-left text-sky-text-2 shadow-[inset_0_0_0_1px_var(--border-dark)]',
  'transition-colors duration-(--dur-fast) ease-standard hover:bg-sky-glass hover:text-sky-text',
  'aria-pressed:bg-cyan-400/15 aria-pressed:text-sky-text aria-pressed:shadow-[inset_0_0_0_1px_var(--cyan-300)]',
  'forced-colors:aria-pressed:border-b-4 forced-colors:aria-pressed:border-transparent',
  'outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px]', SKY_FOCUS,
)
const LETTER = 'font-display text-h2 leading-7 font-bold text-sky-text font-stretch-112%'
const LABEL = 'text-small text-sky-text-3 pointer-coarse:text-body-lg'
const VALUE = 'font-mono text-body leading-6 whitespace-nowrap text-sky-text tabular-nums pointer-coarse:text-body-lg'
const BAR = 'block h-6 w-12 rounded-sm bg-sky-glass'
const TAG = 'pointer-coarse:text-body-lg'
/** Chữ của nhãn giữ chỗ: một khoảng trắng không ngắt, đủ cho nhãn cao đúng một dòng mà không có chữ nào để đọc hay để tìm. */
const NBSP = ' '

/** Bốn chỉ số của một phương án; `best`: tốt nhất trong ba (`bestCandidates` — hoà thì mọi phương án hoà, ba bằng nhau thì không ai). */
function useFigures(plans: readonly LandingPlan[] | null) {
  const t = useT()
  const format = useFormat()
  return useMemo(() => {
    if (!plans) return null
    const best = bestCandidates(plans)
    return new Map(plans.map((plan) => {
      const gap = plan.axles.status === 'computed' ? plan.axles.gapPercent : undefined
      const values: Record<CandidateMetric, string | null> = {
        volume: format.percent(plan.volumeUtilizationPercent),
        axleGap: gap === undefined ? null : t('landingStage.plans.axleGapValue', { value: format.decimal(gap) }),
        rehandling: plan.rehandlingCount === undefined ? null : format.integer(plan.rehandlingCount),
        unplaced: format.integer(plan.unplacedCount),
      }
      const figures = ORDER.map((metric): Figure => ({
        metric, label: LABELS[metric], value: values[metric], best: best[metric]?.has(plan.id) ?? false, marked: (best[metric]?.size ?? 0) > 0,
      }))
      return [plan.id, figures.filter((figure) => figure.value !== null)] as const
    }))
  }, [plans, t, format])
}

/**
 * Một chỉ số: nhãn trên, số dưới, nhãn xám "Tốt nhất" dưới số tốt nhất (số in đậm hơn) — không tô xanh hay đỏ. `reserve`: ô không được
 * đánh dấu vẫn chừa đúng chỗ của nhãn (ẩn, không đọc) để ba thẻ cùng hàng. Chưa có số: vạch giữ chỗ.
 */
function FigureCell({ label, value, best, reserve }: { label: MessageKey; value?: string | null; best?: boolean; reserve?: boolean }) {
  const t = useT()
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className={LABEL}>{t(label)}</span>
      {value === undefined ? <span aria-hidden className={BAR} /> : (
        <span className="flex flex-col items-start gap-1">
          <span className={cn(VALUE, best ? 'font-semibold' : 'font-normal')}>{value}</span>
          {best ? <Badge shape="tag" className={TAG}>{t('landingStage.plans.best')}</Badge> : null}
          {!best && reserve ? <Badge shape="tag" aria-hidden className={cn(TAG, 'invisible')}>{NBSP}</Badge> : null}
        </span>
      )}
    </span>
  )
}

/**
 * Bộ chọn "Một lần chạy, ba phương án" dưới khung 3D: một lần chạy của bộ tối ưu mô phỏng ra ba phương án A · B · C theo ba mục tiêu,
 * mọi số đọc từ chính lần chạy đó — phương án giống nhau ở chỉ số nào thì hiện đúng như vậy. Chọn một phương án (nút `aria-pressed`, tên
 * truy cập "Phương án A — Tối đa thể tích", số là mô tả) thì khung 3D xếp lại theo nó. `cards`: ba thẻ cạnh nhau, mỗi thẻ ảnh thu nhỏ đẳng
 * cự và bốn chỉ số. `segmented` (điện thoại): ba nút 56 px, số của phương án đang chọn nằm dưới. `plans` rỗng: cùng bố cục, chỉ nhãn và
 * vạch giữ chỗ (dải không nhảy khi số hiện ra).
 */
export function StagePlans({ plans, selected, onSelect, layout, total, className }: {
  plans: readonly LandingPlan[] | null
  selected: PlanLabel
  onSelect: (label: PlanLabel) => void
  layout: 'cards' | 'segmented'
  /** Số kiện của yêu cầu mẫu. */
  total: number
  className?: string
}) {
  const t = useT()
  const format = useFormat()
  const titleId = useId()
  const baseId = useId()
  const figures = useFigures(plans)
  const segmented = layout === 'segmented'
  const nameOf = (label: PlanLabel, objective: (typeof PLAN_OBJECTIVES)[number]) =>
    t('landingStage.plans.name', { label, objective: t(`runs.objectives.${objective}`) })
  const picked = figures?.get(selected)

  return (
    <section aria-labelledby={titleId} data-stage-plans={plans ? 'ready' : 'pending'} className={cn(STAGE_SURFACE, 'flex flex-col gap-3 rounded-lg px-4 py-3', className)}>
      <div className="flex flex-col gap-0.5 md:flex-row md:flex-wrap md:items-baseline md:gap-x-3">
        <p id={titleId} className="m-0 text-small font-semibold text-sky-text-2 pointer-coarse:text-body-lg">{t('landingStage.plans.title')}</p>
        <p className="m-0 text-small text-sky-text-3 pointer-coarse:text-body-lg">
          {plans ? t('landingStage.plans.note', { count: format.integer(total) }) : t('landingStage.plans.pending')}
        </p>
      </div>
      <div role={plans ? 'group' : undefined} aria-labelledby={plans ? titleId : undefined} aria-hidden={plans ? undefined : true}
        className={cn('grid grid-cols-3', segmented ? 'gap-2' : 'gap-3')}>
        {PLAN_OBJECTIVES.map((objective) => {
          const label = PLAN_LABELS[objective]
          const plan = plans?.find((candidate) => candidate.id === label)
          const rows = figures?.get(label)
          const descriptionId = `${baseId}-${label}`
          const head = (
            <span className={cn('flex min-w-0 flex-col', segmented ? 'items-center gap-0.5 text-center' : 'gap-0.5')}>
              <span className={LETTER}>{label}</span>
              <span className={cn('text-small leading-tight font-medium text-balance pointer-coarse:text-body-lg', segmented && 'max-[23rem]:text-small')}>
                {t(`runs.objectives.${objective}`)}
              </span>
            </span>
          )
          const body = segmented ? head : (
            <>
              {head}
              {plan
                ? <span aria-hidden className="block overflow-hidden rounded-sm"><PlanThumbnail revisionId={label} request={LANDING_REQUEST} placements={plan.result.placements} totalCount={total} overlays={false} className="h-24 min-[90rem]:h-28" /></span>
                : <span aria-hidden className="block h-24 rounded-sm bg-canvas-1 min-[90rem]:h-28" />}
              <span id={descriptionId} className="grid grid-cols-1 gap-x-3 gap-y-2 min-[90rem]:grid-cols-2">
                {(rows ?? ORDER.map((metric) => ({ metric, label: LABELS[metric], value: undefined, best: false, marked: false }))).map((row) => (
                  <FigureCell key={row.metric} label={row.label} value={row.value} best={row.best} reserve={row.marked} />
                ))}
              </span>
            </>
          )
          const box = cn(CHOICE, segmented ? 'min-h-14 justify-center px-1.5 py-2' : 'gap-3 p-3')
          return plan ? (
            <button key={label} type="button" aria-pressed={label === selected} aria-label={nameOf(label, objective)}
              aria-describedby={segmented ? undefined : descriptionId} onClick={() => { if (label !== selected) onSelect(label) }} className={box}>
              {body}
            </button>
          ) : <div key={label} className={box}>{body}</div>
        })}
      </div>
      {segmented ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-2.5" data-stage-plan-figures="">
          {(picked ?? ORDER.map((metric) => ({ metric, label: LABELS[metric], value: undefined, best: false, marked: false }))).map((row) => (
            <FigureCell key={row.metric} label={row.label} value={row.value} best={row.best} />
          ))}
        </div>
      ) : null}
    </section>
  )
}
