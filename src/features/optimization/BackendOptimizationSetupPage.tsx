import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { fetchPackage } from '@/features/package-pool/backend/packages-api'
import { resolveBackendTripId } from '@/features/trips/trips-backend-api'
import { fetchBackendTripDetail, fetchTripVehicleConfig } from '@/features/trips/trips-api'
import { BackendLoadPlanViewer } from '@/features/viewer3d/BackendLoadPlanViewer'
import { adaptBackendScene, adaptBackendVehicle } from '@/features/viewer3d/backend-scene-adapter'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { fetchBackendLoadPlans } from './optimization-api'

/** Lý do chưa vẽ được phương án của máy chủ: câu ở `optimization.backend`, không phải lỗi mạng. */
class BackendSceneError extends Error {
  readonly reason: 'noPlan' | 'vehicleMismatch'

  constructor(reason: 'noPlan' | 'vehicleMismatch') {
    super(reason)
    this.reason = reason
  }
}

/** Mã trên URL có thể là mã chuyến (liên kết từ Giám sát, nhật ký): đổi sang mã số của máy chủ trước. */
export function BackendOptimizationSetupRoute() {
  const { tripId = '' } = useParams()
  const resolved = useQuery({ queryKey: ['trips', 'backend-id', tripId], queryFn: () => resolveBackendTripId(tripId), staleTime: Infinity })
  if (resolved.data === undefined) {
    return (
      <div className="grid flex-1 place-items-center">
        <Spinner />
      </div>
    )
  }
  return <BackendOptimizationSetupPage tripId={resolved.data} />
}

/**
 * Bản nối backend của Thiết lập tối ưu (nhóm `trips`): phương án xếp hàng máy chủ đã tính cho chuyến, xem trên khung 3D. Còn là khung
 * thử kết nối — chưa có lối chạy tối ưu và chọn lần tối ưu: chỉ chuyến #3 có mã lần tối ưu cố định.
 */
function BackendOptimizationSetupPage({ tripId }: { tripId: string }) {
  const t = useT()
  const format = useFormat()

  // Job đã hoàn thành của Trip 3, chỉ dùng để kiểm thử kết nối.
  const jobId = tripId === '3' ? 'c429898c-0b02-4cf5-ad66-d476bb2c505c' : null

  const plansQuery = useQuery({
    queryKey: ['backend', 'optimization-plans', tripId, jobId],
    queryFn: () => fetchBackendLoadPlans(jobId!),
    enabled: jobId !== null,
  })
  const sceneQuery = useQuery({
    queryKey: ['backend', 'optimization-scene', tripId, jobId],
    enabled: jobId !== null && plansQuery.isSuccess,
    queryFn: async () => {
      const plan = plansQuery.data?.[0]
      if (!plan) throw new BackendSceneError('noPlan')

      const [tripDetail, vehicleConfigResponse, packages] = await Promise.all([
        fetchBackendTripDetail(tripId),
        fetchTripVehicleConfig(tripId),
        Promise.all(plan.placements.map((placement) => fetchPackage(String(placement.package_id)))),
      ])
      if (String(vehicleConfigResponse.vehicleId) !== String(tripDetail.trip.vehicleId)) throw new BackendSceneError('vehicleMismatch')

      return adaptBackendScene(tripId, tripDetail, adaptBackendVehicle(vehicleConfigResponse), plan, packages)
    },
  })

  const plans = plansQuery.data ?? []
  const sceneError = sceneQuery.error instanceof BackendSceneError
    ? t(`optimization.backend.${sceneQuery.error.reason}`)
    : dataErrorMessage(sceneQuery.error, t)

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4 px-shell py-6">
      <Button variant="secondary" asChild>
        <Link to={`/chuyen/${encodeURIComponent(tripId)}`}>{t('optimization.back')}</Link>
      </Button>

      <Card className="p-6">
        <h2 className="font-display text-h3 font-semibold">{t('trips.loadingOptimization.run')}</h2>

        {jobId === null ? (
          <p className="mt-3 text-body">{t('optimization.backend.noJob', { trip: tripId })}</p>
        ) : plansQuery.isPending ? (
          <div className="mt-4">
            <Spinner />
          </div>
        ) : plansQuery.isError ? (
          <p role="alert" className="mt-3 text-body text-danger">{dataErrorMessage(plansQuery.error, t)}</p>
        ) : (
          <div className="mt-4 space-y-3 text-body">
            <p>{t('optimization.backend.job', { id: jobId })}</p>

            {plans.map((plan) => (
              <div key={plan.id} className="rounded-lg border border-border p-4">
                <p className="font-medium">{plan.plan_name}</p>
                <p>{t('optimization.backend.planId', { id: plan.id })}</p>
                <p>{t('optimization.backend.packages', { count: format.integer(plan.packed_items_count) })}</p>
                <p>{t('optimization.backend.volume', { value: format.percent((plan.volume_utilization ?? 0) * 100) })}</p>
                <p>{t('optimization.backend.weight', { value: format.percent((plan.weight_utilization ?? 0) * 100) })}</p>
                <p>{t('optimization.backend.placements', { count: format.integer(plan.placements.length) })}</p>
              </div>
            ))}
            {sceneQuery.isPending ? (
              <div role="status" className="py-6">
                <Spinner />
              </div>
            ) : sceneQuery.isError ? (
              <p role="alert" className="text-danger">{sceneError}</p>
            ) : sceneQuery.data ? (
              <BackendLoadPlanViewer key={`${tripId}-${plans[0]?.id}`} model={sceneQuery.data} />
            ) : null}
          </div>
        )}
      </Card>
    </div>
  )
}
