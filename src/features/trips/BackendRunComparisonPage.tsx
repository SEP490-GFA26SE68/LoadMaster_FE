import { Box, Pin } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { PageHero } from '@/components/PageHero'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import type { LoadPlan } from '@/features/optimization/load-plans-backend-api'
import { planAlgorithmLabel, runAlgorithmLabel } from '@/features/optimization/server-algorithms'
import { useJobPlansQuery, useTripLoadPlansQuery } from '@/features/optimization/useLoadPlansQuery'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { useBackendTripIdQuery } from './useBackendTripQuery'

type BestKey = 'volume' | 'payload' | 'rehandling' | 'unplaced'

const BEST: Readonly<Record<BestKey, { value: (plan: LoadPlan) => number | null; higher: boolean }>> = {
  volume: { value: (plan) => plan.volumePercent, higher: true },
  payload: { value: (plan) => plan.payloadPercent, higher: true },
  rehandling: { value: (plan) => plan.rehandlingCount, higher: false },
  unplaced: { value: (plan) => plan.unplaced.length, higher: false },
}

/**
 * Phương án có giá trị tốt nhất của một chỉ số: chỉ khi mọi phương án có số và không bằng nhau hết; hoà thì mọi phương án hoà. Đánh dấu
 * trung tính (in đậm + nhãn "Tốt nhất"), như màn so sánh của kho mẫu.
 */
export function bestPlanIds(plans: readonly LoadPlan[], key: BestKey): ReadonlySet<string> {
  const { value, higher } = BEST[key]
  const values = plans.map(value)
  if (plans.length < 2 || values.some((item) => item === null)) return new Set()
  const numbers = values as number[]
  const best = higher ? Math.max(...numbers) : Math.min(...numbers)
  if (numbers.every((item) => item === best)) return new Set()
  return new Set(plans.filter((_, index) => numbers[index] === best).map((plan) => plan.id))
}

/**
 * So sánh phương án khi nhóm `trips` nối backend: các phương án của một lần chạy (`?lan-chay=<mã job>`, không có thì lần chạy mới nhất của
 * chuyến), mỗi phương án một thẻ theo thứ tự A · B · C với đúng chỉ số máy chủ trả. Không có nút chính: mỗi thẻ mở Planner, duyệt ở đó.
 * Kết quả của máy chủ không mang MOCK RESULT.
 */
export function BackendRunComparisonPage() {
  const { tripId: tripParam = '' } = useParams()
  const [searchParams] = useSearchParams()
  const runId = searchParams.get('lan-chay')
  const t = useT()
  const resolved = useBackendTripIdQuery(tripParam, runId === null)
  const latest = useTripLoadPlansQuery(runId === null ? (resolved.data ?? '') : '')
  const jobId = runId ?? latest.data?.plans.findLast((plan) => plan.jobId !== null)?.jobId ?? ''
  const plans = useJobPlansQuery(tripParam, jobId)
  const loading = (runId === null && (resolved.isPending || latest.isPending)) || (jobId !== '' && plans.isPending)
  const error = resolved.error ?? latest.error ?? plans.error
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <PageHero
        title={t('serverPlans.compare.title')}
        crumbs={[{ label: t('nav.trips'), to: '/chuyen' }, { label: tripParam, to: `/chuyen/${encodeURIComponent(tripParam)}`, mono: true }]}
        description={t('serverPlans.compare.description')}
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-shell py-6">
        {loading ? <div role="status" className="grid place-items-center py-12"><Spinner /></div>
          : error ? <p role="alert" className="text-body text-danger">{dataErrorMessage(error, t)}</p>
            : (plans.data ?? []).length === 0 ? <p className="text-body text-ink-2">{t('serverPlans.compare.empty')}</p>
              : <RunPlans plans={plans.data ?? []} tripParam={tripParam} />}
      </div>
    </div>
  )
}

/**
 * Thẻ lần chạy (thuật toán của gói — hạng máy chủ ghi cho job) rồi ba thẻ phương án; lần chạy giữ ghim (mọi phương án cùng giữ các kiện
 * đó) có một dòng nói số kiện giữ nguyên chỗ.
 */
function RunPlans({ plans, tripParam }: { plans: readonly LoadPlan[]; tripParam: string }) {
  const t = useT()
  const pinned = plans[0]?.placements.filter((placement) => placement.pinned).length ?? 0
  const runAlgorithm = plans.find((plan) => plan.runAlgorithm !== null)?.runAlgorithm ?? null
  return (
    <div className="flex flex-col gap-4">
      {runAlgorithm === null ? null : (
        <Card data-run-card className="px-5 py-1">
          <dl><Metric label={t('serverPlans.algorithms.runLabel')} last>{runAlgorithmLabel(runAlgorithm, t)}</Metric></dl>
        </Card>
      )}
      {pinned > 0 ? <p data-run-pinned className="flex items-center gap-1.5 text-small text-ink-2"><Pin className="size-4" strokeWidth={1.5} aria-hidden />{t('trips.compare.candidates.pinned', { count: pinned })}</p> : null}
      <div className="grid gap-4 lg:grid-cols-3">{plans.map((plan) => <PlanCard key={plan.id} plan={plan} plans={plans} tripParam={tripParam} />)}</div>
    </div>
  )
}

function PlanCard({ plan, plans, tripParam }: { plan: LoadPlan; plans: readonly LoadPlan[]; tripParam: string }) {
  const t = useT()
  const format = useFormat()
  const best = (key: BestKey) => bestPlanIds(plans, key).has(plan.id)
  const cog = plan.centerOfGravityCm
  return (
    <Card className="flex flex-col gap-3 p-5">
      <header className="flex flex-col gap-1">
        <h2 className="flex flex-wrap items-center gap-2 font-display text-h3 font-[650] text-ink-strong">
          {plan.label ? t('serverPlans.plans.candidate', { label: plan.label }) : t('serverPlans.plans.unlabeled', { id: plan.id })}
          {plan.approved ? <Badge shape="tag" tone="cyan" dot>{t('serverPlans.plans.approved')}</Badge> : null}
        </h2>
        {plan.objective ? <p className="text-small text-ink-2">{t(`runs.objectives.${plan.objective}`)}</p> : null}
      </header>
      <dl className="flex flex-col border-t border-line-soft">
        {plan.volumePercent === null ? null : <Metric label={t('serverPlans.compare.metrics.volume')} best={best('volume')}>{format.percent(plan.volumePercent)}</Metric>}
        {plan.payloadPercent === null ? null : <Metric label={t('serverPlans.compare.metrics.payload')} best={best('payload')}>{format.percent(plan.payloadPercent)}</Metric>}
        {plan.frontAxleLoadKg === null ? null : <Metric label={t('serverPlans.compare.metrics.frontAxle')}>{format.weight(plan.frontAxleLoadKg)}</Metric>}
        {plan.rearAxleLoadKg === null ? null : <Metric label={t('serverPlans.compare.metrics.rearAxle')}>{format.weight(plan.rearAxleLoadKg)}</Metric>}
        {cog === null ? null : <Metric label={t('serverPlans.compare.metrics.cog')}>{[cog.x, cog.y, cog.z].map((value) => format.length(value)).join(' · ')}</Metric>}
        {plan.rehandlingCount === null ? null : <Metric label={t('serverPlans.compare.metrics.rehandling')} best={best('rehandling')}>{format.integer(plan.rehandlingCount)}</Metric>}
        <Metric label={t('serverPlans.compare.metrics.unplaced')} best={best('unplaced')}>{format.integer(plan.unplaced.length)}</Metric>
        {plan.computationMs === null ? null : <Metric label={t('serverPlans.compare.metrics.computation')}>{t('serverPlans.job.computationValue', { ms: format.integer(plan.computationMs) })}</Metric>}
        {plan.algorithmName === null ? null : <Metric label={t('serverPlans.compare.metrics.planAlgorithm')} text>{planAlgorithmLabel(plan.algorithmName, t)}</Metric>}
      </dl>
      <Button variant="secondary" className="mt-auto" asChild>
        <Link to={`/chuyen/${encodeURIComponent(tripParam)}/phuong-an?revision=${encodeURIComponent(plan.id)}`}>
          <Box className="size-4" aria-hidden />{t('serverPlans.plans.openPlanner')}
        </Link>
      </Button>
    </Card>
  )
}

/** Một dòng chỉ số. `text`: giá trị là chữ (tên thuật toán) — không mono, căn phải, xuống dòng được. `last`: không kẻ dưới. */
function Metric({ label, best = false, text = false, last = false, children }: {
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
