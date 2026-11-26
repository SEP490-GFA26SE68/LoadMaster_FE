import { Box, Copy } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ThumbnailFrame } from '@/components/PlanThumbnail'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { VehicleConfig } from '@/domain/models'
import { computationTime } from '@/features/optimization/computation-time'
import type { LoadPlan } from '@/features/optimization/load-plans-backend-api'
import { planAlgorithmLabel } from '@/features/optimization/server-algorithms'
import { useFormat, useT } from '@/lib/i18n'
import { axleUsage } from './axle-usage'
import { BackendPlanScore } from './BackendPlanScore'
import { bestPlanIds, type BestKey } from './run-plan-best'
import { serverPlanThumbnail } from './server-plan-thumbnail'
import { AxleUsageBars, PlanProfile, planProfile, ScoreBars } from './ServerPlanParts'

/**
 * Thẻ một phương án ở So sánh theo lần chạy bản máy chủ. Sáu hàng cố định (đầu thẻ · hồ sơ · ảnh · chỉ số · điểm · nút Planner) đặt trên
 * lưới con của hàng thẻ từ `lg`, nên hàng của ba thẻ thẳng nhau dù thẻ ngắn dài; hàng không có gì để trống, không vẽ khung rỗng.
 * Phương án trùng cách xếp (`sameAs`) bỏ ảnh và chỉ số, chỉ giữ một câu trỏ tới phương án gốc.
 */
export function BackendRunPlanCard({ plan, plans, sameAs, vehicle, tripParam }: {
  plan: LoadPlan
  plans: readonly LoadPlan[]
  sameAs: LoadPlan | null
  vehicle: VehicleConfig | undefined
  tripParam: string
}) {
  const t = useT()
  const profile = planProfile(plan)
  const label = plan.label ?? `#${plan.id}`
  const sameLabel = sameAs ? (sameAs.label ?? `#${sameAs.id}`) : null
  return (
    <Card data-plan-card={plan.id} data-duplicate={sameAs ? 'true' : undefined} className="flex flex-col gap-3 p-5 lg:row-span-6 lg:grid lg:grid-rows-subgrid">
      <header className="flex flex-col gap-1">
        <h2 className="flex flex-wrap items-center gap-2 font-display text-h3 font-[650] text-ink-strong">
          {plan.label ? t('serverPlans.plans.candidate', { label: plan.label }) : t('serverPlans.plans.unlabeled', { id: plan.id })}
          {plan.approved ? <Badge shape="tag" tone="cyan" dot>{t('serverPlans.plans.approved')}</Badge> : null}
          {plan.duplicateOf ? <Badge shape="tag">{t('landingTry.results.sameAs', { label: plan.duplicateOf })}</Badge> : null}
        </h2>
        {plan.objective ? <p className="text-small text-ink-2">{t(`runs.objectives.${plan.objective}`)}</p> : null}
      </header>
      <div>{profile ? <PlanProfile profile={profile} /> : null}</div>
      {sameLabel === null ? <PlanFigure plan={plan} vehicle={vehicle} label={label} /> : (
        <div data-same-as={sameLabel} className="flex items-start gap-2 rounded-md bg-tint-slate px-3 py-2.5 text-small text-tint-slate-fg">
          <Copy className="mt-0.5 size-4 flex-none" strokeWidth={1.5} aria-hidden />
          <p className="text-pretty">{t('serverRun.compare.sameAs.text', { label: sameLabel })}</p>
        </div>
      )}
      {sameLabel === null ? <PlanMetrics plan={plan} plans={plans} vehicle={vehicle} /> : <div />}
      <div className="flex flex-col gap-3">
        {plan.score ? <ScoreBars score={plan.score} /> : null}
        <BackendPlanScore score={plan.score} planLabel={label} />
      </div>
      <Button variant="secondary" className="mt-auto" asChild>
        <Link to={`/chuyen/${encodeURIComponent(tripParam)}/phuong-an?revision=${encodeURIComponent(plan.id)}`}>
          <Box className="size-4" aria-hidden />{t('serverPlans.plans.openPlanner')}
        </Link>
      </Button>
    </Card>
  )
}

/** Ảnh cách xếp từ chỗ xếp thật của máy chủ; không dựng được thì hàng để trống. */
function PlanFigure({ plan, vehicle, label }: { plan: LoadPlan; vehicle: VehicleConfig | undefined; label: string }) {
  const t = useT()
  const format = useFormat()
  const thumbnail = useMemo(() => serverPlanThumbnail(plan, vehicle), [plan, vehicle])
  if (thumbnail === null) return <div />
  const total = plan.placements.length + plan.unplaced.length
  return (
    <ThumbnailFrame
      thumbnail={thumbnail}
      totalCount={total}
      className="h-[176px] overflow-hidden rounded-md"
      label={t('serverRun.compare.thumbnail', { label, placed: format.integer(plan.placements.length), total: format.integer(total) })}
    />
  )
}

function PlanMetrics({ plan, plans, vehicle }: { plan: LoadPlan; plans: readonly LoadPlan[]; vehicle: VehicleConfig | undefined }) {
  const t = useT()
  const format = useFormat()
  const best = (key: BestKey) => bestPlanIds(plans, key).has(plan.id)
  const usage = axleUsage(plan, vehicle)
  const hasBar = (group: 'front' | 'rear') => usage.some((item) => item.group === group)
  const cog = plan.centerOfGravityCm
  return (
    <div className="flex flex-col gap-3">
      <dl className="flex flex-col border-t border-line-soft">
        {plan.volumePercent === null ? null : <Metric label={t('serverPlans.compare.metrics.volume')} best={best('volume')}>{format.percent(plan.volumePercent)}</Metric>}
        {plan.payloadPercent === null ? null : <Metric label={t('serverPlans.compare.metrics.payload')} best={best('payload')}>{format.percent(plan.payloadPercent)}</Metric>}
        {hasBar('front') || plan.frontAxleLoadKg === null ? null : <Metric label={t('serverPlans.compare.metrics.frontAxle')}>{format.weight(plan.frontAxleLoadKg)}</Metric>}
        {hasBar('rear') || plan.rearAxleLoadKg === null ? null : <Metric label={t('serverPlans.compare.metrics.rearAxle')}>{format.weight(plan.rearAxleLoadKg)}</Metric>}
        {cog === null ? null : <Metric label={t('serverPlans.compare.metrics.cog')}>{[cog.x, cog.y, cog.z].map((value) => format.length(value)).join(' · ')}</Metric>}
        {plan.rehandlingCount === null ? null : <Metric label={t('serverPlans.compare.metrics.rehandling')} best={best('rehandling')}>{format.integer(plan.rehandlingCount)}</Metric>}
        <Metric label={t('serverPlans.compare.metrics.unplaced')} best={best('unplaced')}>{format.integer(plan.unplaced.length)}</Metric>
        {plan.computationMs === null ? null : <Metric label={t('serverPlans.compare.metrics.computation')}>{computationTime(plan.computationMs, t, format)}</Metric>}
        {plan.algorithmName === null ? null : <Metric label={t('serverPlans.compare.metrics.planAlgorithm')} text>{planAlgorithmLabel(plan.algorithmName, t)}</Metric>}
      </dl>
      <AxleUsageBars usage={usage} />
    </div>
  )
}

/** Một dòng chỉ số. `text`: giá trị là chữ (tên thuật toán) — không mono, căn phải, xuống dòng được. `last`: không kẻ dưới. */
export function Metric({ label, best = false, text = false, last = false, children }: {
  label: string
  best?: boolean
  text?: boolean
  last?: boolean
  children: ReactNode
}) {
  const t = useT()
  const value = best ? 'flex items-center gap-2 font-mono font-semibold tabular-nums text-ink-strong' : text ? 'text-right text-ink-1' : 'font-mono tabular-nums text-ink-1'
  return (
    <div className={last ? 'flex items-center justify-between gap-3 py-2 text-small' : 'flex items-center justify-between gap-3 border-b border-line-soft py-2 text-small'}>
      <dt className="shrink-0 text-ink-2">{label}</dt>
      <dd className={value}>
        {best ? <Badge shape="tag">{t('serverPlans.compare.best')}</Badge> : null}
        {children}
      </dd>
    </div>
  )
}
