import { Pin } from 'lucide-react'
import { useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { PageHero } from '@/components/PageHero'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { computationTime } from '@/features/optimization/computation-time'
import { packageCodeIndex, type DataWarning } from '@/features/optimization/data-warnings'
import { DataWarningsBanner } from '@/features/optimization/DataWarningsBanner'
import type { LoadPlan, OptimizationJob } from '@/features/optimization/load-plans-backend-api'
import { runAlgorithmLabel } from '@/features/optimization/server-algorithms'
import { useJobPlansQuery, useOptimizationJobQuery, useTripLoadPlansQuery } from '@/features/optimization/useLoadPlansQuery'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { BackendRunPlanCard, Metric } from './BackendRunPlanCard'
import { placedSummary, runPlanCards } from './run-plan-cards'
import { useBackendTripIdQuery } from './useBackendTripQuery'
import { useRunVehiclesQuery } from './useRunVehiclesQuery'

export { bestPlanIds } from './run-plan-best'

/**
 * So sánh phương án khi nhóm `trips` nối backend: các phương án của một lần chạy (`?lan-chay=<mã job>`, không có thì lần chạy mới nhất của
 * chuyến), mỗi phương án một thẻ theo thứ tự A · B · C với đúng chỉ số máy chủ trả (`BackendRunPlanCard`: hồ sơ, ảnh cách xếp từ chỗ xếp
 * thật, chỉ số, thanh tải trục, biểu đồ điểm và "Tính thế nào?"). Không có nút chính: mỗi thẻ mở Planner, duyệt ở đó. Kết quả của máy chủ
 * không mang MOCK RESULT. Cảnh báo dữ liệu của lần chạy (đọc trạng thái job; đọc lỗi thì bỏ qua) nằm trên các thẻ. Xe của phương án
 * (`useRunVehiclesQuery`) đọc lỗi thì chỉ mất ảnh và thanh tải trục, màn vẫn hiện.
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
  const job = useOptimizationJobQuery(jobId === '' ? null : jobId)
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
              : <RunPlans plans={plans.data ?? []} tripParam={tripParam} jobId={jobId} job={job.data} warnings={job.data?.dataWarnings ?? []} />}
      </div>
    </div>
  )
}

/**
 * Thẻ lần chạy (thuật toán của gói, thời gian tính, số kiện xếp được) rồi các thẻ phương án; lần chạy giữ ghim (mọi phương án cùng giữ các
 * kiện đó) có một dòng nói số kiện giữ nguyên chỗ.
 */
function RunPlans({ plans, tripParam, jobId, job, warnings }: {
  plans: readonly LoadPlan[]
  tripParam: string
  jobId: string
  job: OptimizationJob | undefined
  warnings: readonly DataWarning[]
}) {
  const t = useT()
  const vehicles = useRunVehiclesQuery(tripParam, jobId, plans)
  const cards = useMemo(() => runPlanCards(plans), [plans])
  const pinned = plans[0]?.placements.filter((placement) => placement.pinned).length ?? 0
  return (
    <div className="flex flex-col gap-4">
      <DataWarningsBanner warnings={warnings} codes={packageCodeIndex(plans)} />
      <RunCard plans={plans} job={job} />
      {pinned > 0 ? <p data-run-pinned className="flex items-center gap-1.5 text-small text-ink-2"><Pin className="size-4" strokeWidth={1.5} aria-hidden />{t('trips.compare.candidates.pinned', { count: pinned })}</p> : null}
      {plans.some((plan) => plan.score) ? <p data-score-note className="text-small text-pretty text-ink-2">{t('serverPlans.score.noBest')}</p> : null}
      <div className="grid gap-4 lg:grid-cols-3 lg:gap-y-3">
        {cards.map(({ plan, sameAs }) => (
          <BackendRunPlanCard key={plan.id} plan={plan} plans={plans} sameAs={sameAs} vehicle={vehicles.data?.get(plan.id)} tripParam={tripParam} />
        ))}
      </div>
    </div>
  )
}

/** Thẻ lần chạy: mỗi dòng chỉ khi có số — không dòng nào thì không có thẻ. */
function RunCard({ plans, job }: { plans: readonly LoadPlan[]; job: OptimizationJob | undefined }) {
  const t = useT()
  const format = useFormat()
  const runAlgorithm = plans.find((plan) => plan.runAlgorithm !== null)?.runAlgorithm ?? job?.runAlgorithm ?? null
  const computationMs = job?.computationMs ?? null
  const placed = placedSummary(plans)
  const rows = [
    runAlgorithm === null ? null : { key: 'algorithm', label: t('serverPlans.algorithms.runLabel'), value: runAlgorithmLabel(runAlgorithm, t), text: true },
    computationMs === null ? null : { key: 'computation', label: t('serverRun.compare.runComputation'), value: computationTime(computationMs, t, format), text: false },
    placed === null ? null : {
      key: 'placed',
      label: t('serverRun.compare.placed'),
      value: placed.min === placed.max
        ? t('serverRun.compare.placedValue', { placed: format.integer(placed.max), total: format.integer(placed.total) })
        : t('serverRun.compare.placedRange', { min: format.integer(placed.min), max: format.integer(placed.max), total: format.integer(placed.total) }),
      text: false,
    },
  ].filter((row) => row !== null)
  if (rows.length === 0) return null
  return (
    <Card data-run-card className="px-5 py-1">
      <dl className="grid gap-x-8 sm:grid-cols-3">
        {rows.map((row) => <div key={row.key} data-run-row={row.key}><Metric label={row.label} text={row.text} last>{row.value}</Metric></div>)}
      </dl>
    </Card>
  )
}
