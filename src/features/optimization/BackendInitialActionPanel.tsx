import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Banner } from '@/components/Banner'
import { useCurrentUser } from '@/features/auth/AuthProvider'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { fetchBackendLoadPlans, fetchBackendOptimizationJob } from './backend-optimization-api'
import { canFetchOptimizationPlans, getBackendJobStatusKey } from './backend-job-status'
import { optimizationJobOf, type OptimizationJob } from './load-plan-dto'
import { isOptimizationTerminal, type OptimizationActionScope } from './initial-optimization-action'
import { useInitialOptimizationAction } from './useInitialOptimizationAction'

type Props = {
  tripId: string
  disabledReason?: string | null
  keepPinsFromPlanId?: string
  onJobChange?: (id: string, job: OptimizationJob | null, hasPlans: boolean, error?: unknown) => void
}

/** Shared by the trip setup and scoped independently across user/company/trip switches. */
export function BackendInitialActionPanel(props: Props) {
  const user = useCurrentUser()
  const t = useT()
  if (!user.companyId) return <p role="alert">{t('optimization.backend.action.accountRequired')}</p>
  const scope = { userId: user.id, companyId: user.companyId, tripId: props.tripId }
  return <ActionPanel key={JSON.stringify(scope)} {...props} scope={scope} />
}

function ActionPanel({ scope, disabledReason, keepPinsFromPlanId, onJobChange }: Props & { scope: OptimizationActionScope }) {
  const t = useT()
  const initial = useInitialOptimizationAction(scope)
  const jobId = initial.action?.jobId ?? null
  const key = ['backend', scope.userId, scope.companyId] as const
  const job = useQuery({
    queryKey: [...key, 'optimization-job', jobId],
    enabled: jobId !== null,
    retry: false,
    queryFn: async () => {
      const dto = await fetchBackendOptimizationJob(jobId!)
      if (!dto || typeof dto.status !== 'string') throw new Error('OPTIMIZATION_RESPONSE_UNKNOWN')
      const receivedId = dto.jobId ?? dto.job_uuid ?? dto.job_id
      if (receivedId !== undefined && receivedId !== jobId) throw new Error('OPTIMIZATION_RESPONSE_UNKNOWN')
      return { ...optimizationJobOf({ ...dto, jobId: receivedId ?? jobId!, status: dto.status }), creditStatus: dto.creditStatus, failureCode: dto.failureCode }
    },
    refetchInterval: query => query.state.status === 'error' || isOptimizationTerminal(query.state.data?.status) ? false : 2000,
    refetchIntervalInBackground: false,
  })
  const plans = useQuery({
    queryKey: [...key, 'optimization-plans', jobId],
    enabled: jobId !== null && canFetchOptimizationPlans(job.data?.status),
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: () => fetchBackendLoadPlans(jobId!),
  })
  const terminal = job.data !== undefined && isOptimizationTerminal(job.data.status)
  const resolved = terminal ? jobId : null
  const mayStart = !disabledReason && !initial.isPending && initial.notice !== 'storage'
    && (!initial.action || (jobId !== null && resolved === jobId))

  useEffect(() => {
    if (jobId !== null) onJobChange?.(jobId, job.data ?? null, (plans.data?.length ?? 0) > 0, job.error ?? plans.error)
  }, [jobId, job.data, job.error, plans.data, plans.error, onJobChange])

  return <section className="flex flex-col gap-3" aria-label={t('optimization.title')}>
    <div className="flex flex-wrap gap-3">
      <Button disabled={!mayStart} loading={initial.isPending}
        onClick={() => initial.handleStartNew(resolved, keepPinsFromPlanId)}>
        {t('optimization.backend.runNew')}
      </Button>
      {initial.action && !jobId && initial.notice !== 'storage' ? (
        <Button variant="secondary" disabled={initial.isPending} onClick={initial.handleRetry}>
          {t('optimization.backend.action.retry')}
        </Button>
      ) : null}
      {jobId ? <Button variant="secondary" onClick={() => void job.refetch()}>
        {t('optimization.backend.action.checkStatus')}
      </Button> : null}
    </div>
    {initial.notice ? <Banner tone="warning">{t(`optimization.backend.action.${initial.notice}`)}</Banner> : null}
    {initial.notice !== 'rejected' && job.data?.failureCode === 'PACKING_PROFILE_ORIENTATION_INVALID'
      ? <Banner tone="warning">{t('optimization.backend.action.rejected')}</Banner> : null}
    {job.isError ? <p role="alert">{dataErrorMessage(job.error, t)}</p> : null}
    {jobId && !terminal && !job.isError ? <p role="status">{t('optimization.backend.running')}</p> : null}
    {job.data ? <p>{t(getBackendJobStatusKey(job.data.status))}</p> : null}
    {job.data?.creditStatus === 'REFUND_PENDING' ? <p role="status">{t('optimization.backend.action.refundPending')}</p> : null}
    {job.data?.creditStatus === 'REFUNDED' ? <p role="status">{t('optimization.backend.action.refunded')}</p> : null}
    {plans.isError ? <p role="alert">{t('optimization.backend.plansFailed')}</p> : null}
    {plans.data?.map(plan => <div key={plan.id}>
      <span>{plan.plan_name ?? plan.planName ?? plan.candidateLabel ?? String(plan.id)}</span>
      {typeof plan.packed_items_count === 'number' ? <span> · {plan.packed_items_count}</span> : null}
    </div>)}
  </section>
}
