import { Box, Columns2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import type { LoadPlan } from './load-plan-dto'
import { planAlgorithmLabel, runAlgorithmLabel } from './server-algorithms'
import { useTripLoadPlansQuery } from './useLoadPlansQuery'

type Run = { readonly jobId: string | null; readonly plans: readonly LoadPlan[] }

/** Nhóm phương án theo lần chạy (cùng job), lần chạy mới nhất trước; máy chủ trả phương án cũ trước mới sau. */
export function runsOf(plans: readonly LoadPlan[]): Run[] {
  const runs: { jobId: string | null; plans: LoadPlan[] }[] = []
  for (const plan of plans) {
    const run = plan.jobId === null ? undefined : runs.find((item) => item.jobId === plan.jobId)
    if (run) run.plans.push(plan)
    else runs.push({ jobId: plan.jobId, plans: [plan] })
  }
  const rank = (plan: LoadPlan) => (plan.label === null ? 3 : 'ABC'.indexOf(plan.label))
  return runs.reverse().map((run) => ({ jobId: run.jobId, plans: run.plans.toSorted((a, b) => rank(a) - rank(b)) }))
}

/**
 * Thẻ "Phương án xếp hàng" của chuyến bản máy chủ (`GET /api/trips/{id}/load-plans`): mỗi lần chạy một nhóm, mỗi phương án một dòng —
 * nhãn A · B · C và mục tiêu, thể tích, tải trọng, kiện chưa xếp (chỉ số máy chủ trả), "Đã duyệt", "Mở trong Planner"; nhóm có liên kết
 * So sánh. Không mang MOCK RESULT. `tripId` là mã số của máy chủ, `tripCode` là mã trên URL. `action` đặt ở đầu thẻ. `showAlgorithms`
 * (chỉ Thiết lập tối ưu — màn được dùng từ vựng thuật toán): mỗi lần chạy ghi thuật toán của gói, mỗi phương án ghi thuật toán đã tạo ra nó.
 */
export function BackendLoadPlansCard({ tripId, tripCode, action, showAlgorithms = false }: {
  tripId: string
  tripCode: string
  action?: ReactNode
  showAlgorithms?: boolean
}) {
  const t = useT()
  const query = useTripLoadPlansQuery(tripId)
  const runs = runsOf(query.data?.plans ?? [])
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{t('serverPlans.plans.title')}</CardTitle>
        {action}
      </CardHeader>
      <div className="flex flex-col gap-4 px-5 pb-5">
        {query.isPending ? <Spinner /> : null}
        {query.isError ? <p role="alert" className="text-small text-danger">{dataErrorMessage(query.error, t)}</p> : null}
        {query.isSuccess && runs.length === 0 ? <p className="text-small text-ink-3">{t('serverPlans.plans.empty')}</p> : null}
        {runs.map((run) => <RunSection key={run.jobId ?? run.plans[0]?.id} run={run} tripCode={tripCode} showAlgorithms={showAlgorithms} />)}
      </div>
    </Card>
  )
}

function RunSection({ run, tripCode, showAlgorithms }: { run: Run; tripCode: string; showAlgorithms: boolean }) {
  const t = useT()
  const runAlgorithm = showAlgorithms ? (run.plans.find((plan) => plan.runAlgorithm !== null)?.runAlgorithm ?? null) : null
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <h3 className="font-mono text-caption text-ink-2">{t('serverPlans.plans.run', { id: run.jobId?.slice(0, 8) ?? '—' })}</h3>
          {runAlgorithm === null ? null : (
            <span data-run-algorithm className="text-small text-ink-2">{t('serverPlans.plans.runAlgorithm', { name: runAlgorithmLabel(runAlgorithm, t) })}</span>
          )}
        </div>
        {run.jobId && run.plans.length > 1 ? (
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/chuyen/${encodeURIComponent(tripCode)}/so-sanh?lan-chay=${encodeURIComponent(run.jobId)}`}>
              <Columns2 className="size-4" aria-hidden />{t('serverPlans.plans.compare')}
            </Link>
          </Button>
        ) : null}
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {run.plans.map((plan) => <PlanRow key={plan.id} plan={plan} tripCode={tripCode} showAlgorithm={showAlgorithms} />)}
      </ul>
    </section>
  )
}

function PlanRow({ plan, tripCode, showAlgorithm }: { plan: LoadPlan; tripCode: string; showAlgorithm: boolean }) {
  const t = useT()
  const format = useFormat()
  const name = plan.label ? t('serverPlans.plans.candidate', { label: plan.label }) : t('serverPlans.plans.unlabeled', { id: plan.id })
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line-soft pt-2 first:border-t-0 first:pt-0">
      <div className="flex min-w-40 flex-1 flex-col">
        <span className="flex flex-wrap items-center gap-2 font-medium text-ink-1">
          {name}
          {plan.approved ? <Badge shape="tag" tone="cyan" dot>{t('serverPlans.plans.approved')}</Badge> : null}
        </span>
        {plan.objective ? <span className="text-small text-ink-3">{t(`runs.objectives.${plan.objective}`)}</span> : null}
        {plan.approved && plan.approvedByName ? <span className="text-small text-ink-3">{t('serverPlans.plans.approvedBy', { name: plan.approvedByName })}</span> : null}
        {showAlgorithm && plan.algorithmName ? (
          <span data-plan-algorithm className="text-small text-ink-3">{t('serverPlans.plans.planAlgorithm', { name: planAlgorithmLabel(plan.algorithmName, t) })}</span>
        ) : null}
      </div>
      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-small">
        {plan.volumePercent === null ? null : (
          <div className="flex gap-1"><dt className="text-ink-3">{t('serverPlans.plans.volume')}</dt><dd className="font-mono tabular-nums">{format.percent(plan.volumePercent)}</dd></div>
        )}
        {plan.payloadPercent === null ? null : (
          <div className="flex gap-1"><dt className="text-ink-3">{t('serverPlans.plans.payload')}</dt><dd className="font-mono tabular-nums">{format.percent(plan.payloadPercent)}</dd></div>
        )}
        {plan.unplaced.length > 0 ? <dd className="text-warning">{t('serverPlans.plans.unplaced', { count: plan.unplaced.length })}</dd> : null}
      </dl>
      <Button variant="secondary" size="sm" asChild>
        <Link to={`/chuyen/${encodeURIComponent(tripCode)}/phuong-an?revision=${encodeURIComponent(plan.id)}`}>
          <Box className="size-4" aria-hidden />{t('serverPlans.plans.openPlanner')}
        </Link>
      </Button>
    </li>
  )
}
