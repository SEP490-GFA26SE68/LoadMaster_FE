import { useQuery } from '@tanstack/react-query'
import { Box } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { PageHero } from '@/components/PageHero'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import type { LoadPlan } from '@/features/optimization/load-plan-dto'
import { useJobPlansQuery, useTripLoadPlansQuery } from '@/features/optimization/useLoadPlansQuery'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { resolveBackendTripId } from './trips-api'

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
  const resolved = useQuery({ queryKey: ['trips', tripParam, 'backend-id'], queryFn: () => resolveBackendTripId(tripParam), staleTime: Infinity, enabled: runId === null })
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
              : <div className="grid gap-4 lg:grid-cols-3">{(plans.data ?? []).map((plan) => <PlanCard key={plan.id} plan={plan} plans={plans.data ?? []} tripParam={tripParam} />)}</div>}
      </div>
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
        {plan.algorithmName === null ? null : <Metric label={t('serverPlans.compare.metrics.algorithm')}>{plan.algorithmName}</Metric>}
      </dl>
      <Button variant="secondary" className="mt-auto" asChild>
        <Link to={`/chuyen/${encodeURIComponent(tripParam)}/phuong-an?revision=${encodeURIComponent(plan.id)}`}>
          <Box className="size-4" aria-hidden />{t('serverPlans.plans.openPlanner')}
        </Link>
      </Button>
    </Card>
  )
}

function Metric({ label, best = false, children }: { label: string; best?: boolean; children: ReactNode }) {
  const t = useT()
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line-soft py-2 text-small">
      <dt className="text-ink-2">{label}</dt>
      <dd className={best ? 'flex items-center gap-2 font-mono font-semibold tabular-nums text-ink-strong' : 'font-mono tabular-nums text-ink-1'}>
        {best ? <Badge shape="tag">{t('serverPlans.compare.best')}</Badge> : null}
        {children}
      </dd>
    </div>
  )
}
