import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PackageOpen, Plus, Route } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useCan } from '@/features/auth/useCan'
import { BackendLoadPlansCard } from '@/features/optimization/BackendLoadPlansCard'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { BackendRequirementAssignDialog } from './BackendRequirementAssignDialog'
import { backendDateTimeText } from './backend-date-text'
import { BackendTripRouteCard } from './BackendTripRouteCard'
import { BackendTripWriteActions, isEditableStatus, RemoveRequirementButton } from './BackendTripWriteActions'
import { SERVER_MANUAL_CONFIRMS } from './manual-confirm-backend-api'
import { ManualConfirmCard } from './ManualConfirmCard'
import { MissingPackagesCard } from './MissingPackagesCard'
import { SERVER_SHORTAGES } from './shortage-backend-api'
import { RealTripDetailHeader } from './TripDetailHeader'
import { fetchBackendActiveRoutePlan, fetchBackendTripDetail, optimizeBackendTrip, resolveBackendTripId } from './trips-api'

/**
 * Chi tiết chuyến khi nhóm `trips` nối backend (bản của nhóm): thông tin vận hành, điểm giao kèm giờ đến dự kiến và mức hạn, tuyến
 * trên bản đồ, "Tối ưu tuyến" (`POST /api/trips/{id}/optimize-route`) và đưa yêu cầu giao vào chuyến Nháp. Mã trên URL là mã số của
 * máy chủ; liên kết theo mã chuyến (Giám sát, nhật ký) được đổi sang mã số trước (`resolveBackendTripId`).
 */
export function BackendTripDetailPage() {
  const { tripId = '' } = useParams()
  const t = useT()
  const resolved = useQuery({
    queryKey: ['trips', tripId, 'backend-id'],
    queryFn: () => resolveBackendTripId(tripId),
    enabled: tripId !== '',
    staleTime: Infinity,
  })
  if (resolved.isPending) {
    return (
      <div role="status" aria-label={t('trips.detail.loading')} className="grid flex-1 place-items-center">
        <Spinner />
      </div>
    )
  }
  if (resolved.isError) {
    return (
      <div className="flex flex-col items-start gap-3 px-shell py-8">
        <p role="alert" className="text-body text-danger">{dataErrorMessage(resolved.error, t)}</p>
        <Button variant="secondary" asChild>
          <Link to="/chuyen">{t('common.backToTrips')}</Link>
        </Button>
      </div>
    )
  }
  return <BackendTripDetail tripId={resolved.data} />
}

function getDeadlineStatus(
  plannedArrival: string | null,
  deadline: string | null,
): 'onTime' | 'late' | 'unknown' {
  if (!plannedArrival || !deadline) return 'unknown'

  const arrivalMs = Date.parse(`${plannedArrival}+07:00`)
  const deadlineMs = Date.parse(`${deadline}+07:00`)

  if (!Number.isFinite(arrivalMs) || !Number.isFinite(deadlineMs)) {
    return 'unknown'
  }

  return arrivalMs <= deadlineMs ? 'onTime' : 'late'
}



function getStopStatusKey(status: string) {
  switch (status) {
    case 'PENDING':
      return 'trips.detail.stopStatus.PENDING' as const
    case 'ARRIVED':
      return 'trips.detail.stopStatus.ARRIVED' as const
    case 'DELIVERED':
      return 'trips.detail.stopStatus.DELIVERED' as const
    case 'FAILED':
      return 'trips.detail.stopStatus.FAILED' as const
    case 'SKIPPED':
      return 'trips.detail.stopStatus.SKIPPED' as const
    default:
      return null
  }
}


function BackendTripDetail({ tripId }: { tripId: string }) {
  const t = useT()
  const format = useFormat()
  const can = useCan()

  const [assigning, setAssigning] = useState(false)

  const queryClient = useQueryClient()

  const optimizeRoute = useMutation({
    mutationFn: () => optimizeBackendTrip(tripId),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['trips', tripId],
      })

      toast.success(t('trips.optimization.success'))
    },

    onError: (error) => {
      toast.error(dataErrorMessage(error, t))
    },
  })


  const query = useQuery({
    queryKey: ['trips', tripId, 'backend-detail'],
    queryFn: () => fetchBackendTripDetail(tripId),
    enabled: tripId !== '',
  })


  const routePlanQuery = useQuery({
    queryKey: ['trips', tripId, 'active-route-plan'],
    queryFn: () => fetchBackendActiveRoutePlan(tripId),
    enabled: tripId !== '',
    retry: false,
  })


  if (query.isPending) {
    return (
      <div
        role="status"
        aria-label={t('trips.detail.loading')}
        className="grid flex-1 place-items-center"
      >
        <Spinner />
      </div>
    )
  }

  if (query.isError || !query.data) {
    return (
      <div className="flex flex-col items-start gap-3 px-shell py-8">
        <p role="alert" className="text-body text-danger">
          {dataErrorMessage(query.error, t)}
        </p>
        <Button variant="secondary" asChild>
          <Link to="/chuyen">{t('common.backToTrips')}</Link>
        </Button>
      </div>
    )
  }

  const { trip, stops } = query.data
  const canAssign =
    can('trips.edit') &&
    trip.status === 'DRAFT'
  const canOptimize =
    can('trips.edit') &&
    (trip.status === 'DRAFT' || trip.status === 'PLANNED') &&
    stops.length > 0
  // Sửa, huỷ, gỡ yêu cầu giao, chạy tối ưu xếp hàng: máy chủ kiểm lại vai trò và trạng thái; màn chỉ hiện việc làm được
  const canWrite = can('trips.edit')
  const canRemoveRequirement = canWrite && isEditableStatus(trip.status)
  const canOptimizeLoading = can('optimization.run') && isEditableStatus(trip.status) && stops.length > 0


  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <RealTripDetailHeader tripId={tripId} />

      <div className="sky-overlap min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-shell pb-8">
        <div className="flex flex-col gap-4">

          <div className="flex flex-wrap items-center justify-end gap-3">
            {canOptimize && (
              <Button
                type="button"
                loading={optimizeRoute.isPending}
                disabled={optimizeRoute.isPending}
                onClick={() => optimizeRoute.mutate()}
              >
                <Route className="size-4" />
                {t('trips.optimization.run')}
              </Button>
            )}

            {canWrite ? <BackendTripWriteActions trip={trip} /> : null}
          </div>


          {SERVER_MANUAL_CONFIRMS ? <ManualConfirmCard tripId={tripId} server /> : null}
          {SERVER_SHORTAGES ? <MissingPackagesCard tripId={tripId} server /> : null}

          <BackendTripRouteCard
            trip={trip}
            stops={stops}
            routePlan={routePlanQuery.data ?? null}
          />

          <BackendLoadPlansCard
            tripId={tripId}
            tripCode={trip.tripCode}
            action={canOptimizeLoading ? (
              <Button type="button" variant="secondary" size="sm" asChild>
                <Link to={`/chuyen/${encodeURIComponent(trip.tripCode)}/toi-uu`}>
                  <PackageOpen className="size-4" />
                  {t('trips.loadingOptimization.run')}
                </Link>
              </Button>
            ) : null}
          />



          <section className="rounded-xl border border-border bg-bg p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-ink-strong">
                {t('trips.server.operations')}
              </h2>

              <StatusBadge status={trip.status} />
            </div>

            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="mb-1 text-xs text-text-2">{t('trips.server.tripCode')}</dt>
                <dd className="break-all font-mono text-sm font-semibold">
                  {trip.tripCode}
                </dd>
              </div>

              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="mb-1 text-xs text-text-2">{t('trips.server.vehicle')}</dt>
                <dd className="text-sm font-medium">
                  {trip.vehicleName}
                </dd>
                <dd className="mt-1 font-mono text-xs text-text-2">
                  {trip.licensePlate}
                </dd>
              </div>

              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="mb-1 text-xs text-text-2">{t('trips.server.driver')}</dt>
                <dd className="text-sm font-medium">
                  {trip.driverName ?? t('trips.detail.noDriver')}
                </dd>
              </div>

              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="mb-1 text-xs text-text-2">{t('trips.server.departure')}</dt>
                <dd className="text-sm font-medium tabular-nums">
                  {backendDateTimeText(trip.departureTime, format)}
                </dd>
              </div>

              <div className="rounded-lg bg-slate-50 p-3 sm:col-span-2">
                <dt className="mb-1 text-xs text-text-2">{t('trips.server.depot')}</dt>
                <dd className="text-sm font-medium">
                  {trip.originName}
                </dd>
                {trip.originAddress ? (
                  <dd className="mt-1 text-xs text-text-2">
                    {trip.originAddress}
                  </dd>
                ) : null}
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-border bg-bg p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  {t('trips.detail.deliveryStops')}
                </h2>

                <p className="mt-1 text-sm text-text-2">
                  {stops.length} {t('trips.detail.stopUnit')}
                </p>
              </div>

              {canAssign ? (
                <Button
                  type="button"
                  onClick={() => setAssigning(true)}
                >
                  <Plus className="size-4" />
                  {t('trips.assign.title')}
                </Button>
              ) : null}
            </div>

            {stops.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
                <p className="font-medium">
                  {t('trips.detail.noStops')}
                </p>
                <p className="mt-2 text-sm text-text-2">
                  {t('trips.detail.noStopsHint')}
                </p>
              </div>
            ) : (
              <ol className="space-y-3">
                {stops.map((stop) => (
                  <li
                    key={stop.id}
                    className="flex flex-col gap-3 rounded-xl border border-border bg-bg p-4 shadow-sm transition-colors hover:border-primary/30 sm:flex-row sm:items-start"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-semibold text-primary">
                      {stop.stopSequence}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">
                          {stop.stopName ||
                            stop.address ||
                            t('trips.detail.unnamedStop')}
                        </h3>


                        <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium">
                          {getStopStatusKey(stop.status)
                            ? t(getStopStatusKey(stop.status)!)
                            : stop.status}
                        </span>

                      </div>

                      {stop.address && (
                        <p className="mt-1 text-sm text-text-2">
                          {stop.address}
                        </p>
                      )}

                      {stop.deliveryRequirementId !== null && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <p className="text-xs text-text-2">
                            {t('trips.detail.requirementId')} #{stop.deliveryRequirementId}
                          </p>
                          {canRemoveRequirement ? (
                            <RemoveRequirementButton tripId={tripId} requirementId={String(stop.deliveryRequirementId)} />
                          ) : null}
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                        <div>
                          <span className="text-text-2">
                            {t('trips.detail.plannedArrival')}:
                          </span>{' '}
                          <span className="font-medium">
                            {backendDateTimeText(stop.plannedArrival, format)}
                          </span>
                        </div>

                        <div>
                          <span className="text-text-2">
                            {t('trips.detail.actualArrival')}:
                          </span>{' '}
                          <span className="font-medium">
                            {backendDateTimeText(stop.actualArrival, format)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-text-2">
                          {t('trips.detail.deadlineStatus')}:
                        </span>

                        {(() => {
                          const status = getDeadlineStatus(
                            stop.plannedArrival,
                            stop.deadline,
                          )

                          return (
                            <span
                              className={
                                status === 'onTime'
                                  ? 'rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700'
                                  : status === 'late'
                                    ? 'rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700'
                                    : 'rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600'
                              }
                            >
                              {t(`trips.detail.deadlineStatusValues.${status}`)}
                            </span>
                          )
                        })()}
                      </div>

                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>

      {canAssign ? (
        <BackendRequirementAssignDialog
          open={assigning}
          onOpenChange={setAssigning}
          tripId={tripId}
        />
      ) : null}
    </div>
  )
}

