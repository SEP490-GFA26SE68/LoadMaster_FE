import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { useCurrentUser } from '@/features/auth/AuthProvider'
import { fetchBackendTripDetail, fetchTripVehicleConfig } from '@/features/trips/trips-api'
import { fetchPackage } from '@/features/package-pool/packages-api'
import { adaptBackendScene, adaptBackendVehicle } from '@/features/viewer3d/backend-scene-adapter'
import { BackendLoadPlanViewer } from '@/features/viewer3d/BackendLoadPlanViewer'
import { useT } from '@/lib/i18n'
import { fetchBackendOptimizationJob, fetchBackendLoadPlans } from './optimization-api'
import { isOptimizationTerminal, type OptimizationActionScope } from './initial-optimization-action'
import { canFetchOptimizationPlans, getBackendJobStatusKey } from './backend-job-status'
import { useInitialOptimizationAction } from './useInitialOptimizationAction'

export function BackendOptimizationSetupPage({ tripId }: { tripId: string }) {
  const user = useCurrentUser()
  const t = useT()
  if (!user.companyId) return <p role="alert">{t('optimization.backend.action.accountRequired')}</p>
  const scope = { userId: user.id, companyId: user.companyId, tripId }
  return <BackendOptimizationSession key={JSON.stringify(scope)} tripId={tripId} scope={scope} />
}

function BackendOptimizationSession({
  tripId, scope,
}: {
  tripId: string
  scope: OptimizationActionScope
}) {
  const t = useT()
  const createJob = useInitialOptimizationAction(scope)
  const jobId = createJob.action?.jobId ?? null
  const statusQuery = useQuery({
    queryKey: ['backend', scope.userId, scope.companyId, 'optimization-job', jobId],
    queryFn: () => fetchBackendOptimizationJob(jobId!),
    enabled: jobId !== null,
    refetchInterval: (query) => {
      if (query.state.status === 'error') {
        return false
      }
      const status = query.state.data?.status?.toUpperCase()
      if (isOptimizationTerminal(status)) {
        return false
      }
      return 2000
    },
  })
  const jobStatus = statusQuery.data?.status?.toUpperCase()
  const jobHasPossiblePlan = canFetchOptimizationPlans(jobStatus)
  const jobFailed =
    jobStatus === 'FAILED' ||
    jobStatus === 'CANCELLED'
  const resolvedJobId = isOptimizationTerminal(jobStatus) ? jobId : null
  const canStartNew = !createJob.action || resolvedJobId !== null
  const actionNotice = createJob.notice === 'uncertain' && resolvedJobId ? null : createJob.notice
  const plansQuery = useQuery({
    queryKey: ['backend', scope.userId, scope.companyId, 'optimization-plans', tripId, jobId],
    queryFn: () => fetchBackendLoadPlans(jobId!),
    enabled: jobId !== null && jobHasPossiblePlan,
  })
  const sceneQuery = useQuery({
    queryKey: ['backend', scope.userId, scope.companyId, 'optimization-scene', tripId, jobId],
    enabled: jobId !== null && plansQuery.isSuccess && plansQuery.data.length > 0,
    queryFn: async () => {
      const plan = plansQuery.data?.[0]
      if (!plan) {
        throw new Error('No load plan found')
      }
      const [tripDetail, vehicleConfigResponse, packages] =
        await Promise.all([
          fetchBackendTripDetail(tripId),
          fetchTripVehicleConfig(tripId),
          Promise.all(
            plan.placements.map((placement) =>
              fetchPackage(String(placement.package_id)),
            ),
          ),
        ])
      if (
        String(vehicleConfigResponse.vehicleId) !==
        String(tripDetail.trip.vehicleId)
      ) {
        throw new Error('Trip vehicle configuration mismatch')
      }
      const vehicleConfig = adaptBackendVehicle(
        vehicleConfigResponse,
      )
      return adaptBackendScene(
        tripId,
        tripDetail,
        vehicleConfig,
        plan,
        packages,
      )
    },
  })
  const plans = plansQuery.data ?? []
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4 px-shell py-6">
      <Button variant="secondary" asChild>
        <Link to={`/chuyen/${encodeURIComponent(tripId)}`}>
          {t('optimization.back')}
        </Link>
      </Button>
      <Card className="p-6">
        <h2 className="text-lg font-semibold">
          {t('trips.loadingOptimization.run')}
        </h2>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            loading={createJob.isPending}
            disabled={createJob.isPending || !canStartNew || createJob.notice === 'storage'}
            onClick={() => createJob.handleStartNew(resolvedJobId)}
          >
            {t('optimization.backend.runNew')}
          </Button>
          {createJob.action && !resolvedJobId && (
            <Button variant="secondary" disabled={createJob.isPending || createJob.notice === 'storage'}
              onClick={() => jobId ? void statusQuery.refetch() : createJob.handleRetry()}>
              {t(jobId ? 'optimization.backend.action.checkStatus' : 'optimization.backend.action.retry')}
            </Button>
          )}
          {jobId && (
            <span className="text-sm text-text-2">
              {t('optimization.backend.status')}:{' '}
              {jobStatus
                ? t(getBackendJobStatusKey(jobStatus))
                : t('optimization.backend.starting')}
            </span>
          )}
        </div>
        {actionNotice && (
          <p role="alert" className="mt-3 text-sm text-text-2">
            {t(`optimization.backend.action.${actionNotice}`)}
          </p>
        )}
        {jobId === null ? (
          <p className="mt-3 text-sm text-text-2">
            {t('optimization.backend.noJobSelected', { tripId })}
          </p>
        ) : statusQuery.isError ? (
          <p role="alert" className="mt-3 text-sm text-red-500">
            {t('optimization.backend.statusFailed')}
          </p>
        ) : jobFailed ? (
          <p role="alert" className="mt-3 text-sm text-red-500">
            {t('optimization.backend.jobFailed')}
          </p>
        ) : isOptimizationTerminal(jobStatus) && !jobHasPossiblePlan ? (
          <p role="status" className="mt-3 text-sm text-text-2">
            {t(getBackendJobStatusKey(jobStatus))}
          </p>
        ) : !jobHasPossiblePlan ? (
          <div className="mt-4 flex items-center gap-3">
            <Spinner />
            <p className="text-sm text-text-2">
              {t('optimization.backend.running')}
            </p>
          </div>
        ) : plansQuery.isPending ? (
          <div className="mt-4">
            <Spinner />
          </div>
        ) : plansQuery.isError ? (
          <p role="alert" className="mt-3 text-sm text-red-500">
            {t('optimization.backend.plansFailed')}
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <p>
              {t('optimization.backend.jobId')}: {jobId}
            </p>
            {plans.length === 0 && (
              <p className="text-sm text-text-2">
                {t('optimization.backend.noPlans')}
              </p>
            )}
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="rounded-lg border p-4"
              >
                <p className="font-medium">
                  {plan.plan_name}
                </p>
                <p>
                  {t('optimization.backend.loadPlanId')}: {plan.id}
                </p>
                <p>
                  {t('optimization.backend.packages')}:{' '}
                  {plan.packed_items_count}
                </p>
                <p>
                  {t('optimization.backend.volumeUtilization')}:{' '}
                  {((plan.volume_utilization ?? 0) * 100).toFixed(2)}%
                </p>
                <p>
                  {t('optimization.backend.weightUtilization')}:{' '}
                  {((plan.weight_utilization ?? 0) * 100).toFixed(2)}%
                </p>
                <p>
                  {t('optimization.backend.placementsReturned')}:{' '}
                  {plan.placements.length}
                </p>
              </div>
            ))}
            {plans.length > 0 && (
              sceneQuery.isPending ? (
                <div role="status" className="py-6">
                  <Spinner />
                </div>
              ) : sceneQuery.isError ? (
                <p role="alert" className="text-sm text-red-500">
                  {t('optimization.backend.sceneFailed')}
                </p>
              ) : sceneQuery.data ? (
                <BackendLoadPlanViewer
                  key={`${tripId}-${plans[0]?.id}`}
                  model={sceneQuery.data}
                />
              ) : null
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
