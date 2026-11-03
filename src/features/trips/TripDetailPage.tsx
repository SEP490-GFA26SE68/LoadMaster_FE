import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useCan } from '@/features/auth/useCan'
import { PickupRequestsCard } from '@/features/pickups/PickupRequestsCard'
import { RequirementAssignDialog } from '@/features/requirements/RequirementAssignDialog'
import { tripLabelsPath } from '@/features/package-pool/packages-list'
import type { CargoPackage } from '@/domain/models'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { PackageFormPanel } from './PackageFormPanel'
import { PackageImportDialog } from './PackageImportDialog'
import { ManualConfirmCard } from './ManualConfirmCard'
import { MissingPackagesCard } from './MissingPackagesCard'
import { emptyPackage } from './package-defaults'
import { PackagesTable } from './PackagesTable'
import { PoolPackagePicker } from './PoolPackagePicker'
import { SegregationCard } from './SegregationCard'
import { SegregationOverrideDialog } from './SegregationOverrideDialog'
import { StopFormDialog } from './StopFormDialog'
import { cargoSummary, stopRows, type StopRow } from './trip-summary'
import { TripDetailSide } from './TripDetailSide'
import { TripPoolPackagesCard } from './TripPoolPackagesCard'
import { TripRequirementsCard } from './TripRequirementsCard'
import { TripRouteCard } from './TripRouteCard'
import { TripReadinessCard } from './TripReadinessCard'
import { useTripEtaQuery } from './useRouteQuery'
import { useSegregationGuard } from './useSegregationQuery'
import { BackendTripRouteCard } from './BackendTripRouteCard'
import { StatusBadge } from '@/components/StatusBadge'

import {
  useDeletePackageMutation,
  useDuplicatePackageMutation,
  useRemoveStopMutation,
  useSavePackageMutation,
  useTripDetailQuery,
  useTripStopsMutation,
} from './useTripsQuery'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchBackendActiveRoutePlan,
  fetchBackendTripDetail,
  optimizeBackendTrip,
} from './trips-api'
import { RealTripDetailHeader, TripDetailHeader } from './TripDetailHeader'
import { PackageOpen, Plus, Route } from 'lucide-react'
import { BackendRequirementAssignDialog } from './BackendRequirementAssignDialog'


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

            <Button type="button" variant="secondary" asChild>
              <Link to={`/chuyen/${encodeURIComponent(tripId)}/toi-uu`}>
                <PackageOpen className="size-4" />
                {t('trips.loadingOptimization.run')}
              </Link>
            </Button>
          </div>


          <BackendTripRouteCard
            trip={trip}
            stops={stops}
            routePlan={routePlanQuery.data ?? null}
          />



          <section className="rounded-xl border border-border bg-bg p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-ink-strong">
                Thông tin vận hành
              </h2>

              <StatusBadge status={trip.status} />
            </div>

            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="mb-1 text-xs text-text-2">Mã chuyến</dt>
                <dd className="break-all font-mono text-sm font-semibold">
                  {trip.tripCode}
                </dd>
              </div>

              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="mb-1 text-xs text-text-2">Xe vận chuyển</dt>
                <dd className="text-sm font-medium">
                  {trip.vehicleName}
                </dd>
                <dd className="mt-1 font-mono text-xs text-text-2">
                  {trip.licensePlate}
                </dd>
              </div>

              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="mb-1 text-xs text-text-2">Tài xế</dt>
                <dd className="text-sm font-medium">
                  {trip.driverName ?? t('trips.detail.noDriver')}
                </dd>
              </div>

              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="mb-1 text-xs text-text-2">Giờ xuất phát</dt>
                <dd className="text-sm font-medium tabular-nums">
                  {trip.departureTime?.replace('T', ' ') ?? '—'}
                </dd>
              </div>

              <div className="rounded-lg bg-slate-50 p-3 sm:col-span-2">
                <dt className="mb-1 text-xs text-text-2">Kho xuất phát</dt>
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
                        <p className="mt-2 text-xs text-text-2">
                          {t('trips.detail.requirementId')} #{stop.deliveryRequirementId}
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                        <div>
                          <span className="text-text-2">
                            {t('trips.detail.plannedArrival')}:
                          </span>{' '}
                          <span className="font-medium">
                            {stop.plannedArrival?.replace('T', ' ') ?? '—'}
                          </span>
                        </div>

                        <div>
                          <span className="text-text-2">
                            {t('trips.detail.actualArrival')}:
                          </span>{' '}
                          <span className="font-medium">
                            {stop.actualArrival?.replace('T', ' ') ?? '—'}
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

function MockTripDetailPage() {
  const { tripId = '' } = useParams()
  const t = useT()
  const can = useCan()
  const query = useTripDetailQuery(tripId)
  const stopsMutation = useTripStopsMutation(tripId)
  const removeStop = useRemoveStopMutation(tripId)
  const savePackage = useSavePackageMutation(tripId)
  const deletePackage = useDeletePackageMutation(tripId)
  const duplicatePackage = useDuplicatePackageMutation(tripId)
  const etaQuery = useTripEtaQuery(tripId)
  const segregationGuard = useSegregationGuard()
  const [searchParams, setSearchParams] = useSearchParams()
  const [draft, setDraft] = useState<CargoPackage | null>(null)
  const [importing, setImporting] = useState(false)
  const [assigning, setAssigning] = useState(false)

  const [addingStop, setAddingStop] = useState(false)
  const [pickingPool, setPickingPool] = useState(false)
  // Điểm giao đang lọc bảng kiện: điểm trên sơ đồ tuyến và ô chọn trên bảng dùng chung
  const [stopFilter, setStopFilter] = useState<number | null>(null)

  const trip = query.data?.trip
  const vehicle = query.data?.vehicle
  // Quản lý xem chuyến chỉ đọc (D-41); từ lúc kho bắt đầu xếp, xe, điểm giao và kiện bị khoá (D-45)
  const editable = can('trips.edit') && trip?.phase === 'planning'
  // Đưa yêu cầu giao vào chuyến khi chuyến còn lập kế hoạch và người xem sửa được chuyến (điều phối viên)
  const canAssign = can('trips.edit') && trip?.phase === 'planning'
  const openAssign = canAssign ? () => setAssigning(true) : undefined
  const stops = useMemo<StopRow[]>(() => (trip ? stopRows(trip.stops, trip.packages) : []), [trip])
  const summary = useMemo(() => (trip && vehicle ? cargoSummary(trip.packages, vehicle) : null), [trip, vehicle])
  // `?kien=<mã>` mở panel của kiện đó — liên kết từ validation summary của Thiết lập tối ưu (LM-047).
  const linkedId = searchParams.get('kien')
  const editing = draft ?? trip?.packages.find((pkg) => pkg.id === linkedId) ?? null
  function setEditing(next: CargoPackage | null) {
    setDraft(next)
    if (linkedId !== null) setSearchParams((params) => { params.delete('kien'); return params }, { replace: true })
  }

  function handleRemoveStop(stop: StopRow) {
    removeStop.mutate(stop.id, {
      onSuccess: (result) => {
        if (result.allowed) toast.success(t('trips.stops.removed', { name: stop.name }))
        else toast.error(t('trips.stops.removeBlocked', { name: stop.name, count: result.affectedInstances }))
      },
    })
  }

  /** Lưu kiện; kiện khác loại hàng của chuyến (D-74) thì kho từ chối và hộp vượt luật hỏi lý do rồi lưu lại kèm lý do. */
  function handleSave(pkg: CargoPackage, keepOpen: boolean) {
    const save = (overrideReason?: string) => savePackage.mutateAsync({ pkg, overrideReason }).then(() => {
      toast.success(t('trips.form.saved', { id: pkg.id }))
      setEditing(keepOpen ? emptyPackage(trip?.packages ?? [], pkg.deliveryStop) : null)
    })
    save().catch((error: unknown) => {
      if (!segregationGuard.intercept(error, save)) toast.error(dataErrorMessage(error, t))
    })
  }

  function handleDuplicate(pkg: CargoPackage) {
    duplicatePackage.mutate(pkg.id, {
      onSuccess: (copy) => { toast.success(t('trips.form.duplicated', { id: copy.id })); setEditing(copy) },
    })
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <TripDetailHeader tripId={tripId} detail={query.data} />

      {query.isPending ? (
        <div role="status" aria-label={t('trips.detail.loading')} className="grid flex-1 place-items-center"><Spinner /></div>
      ) : !trip || !vehicle || !summary ? (
        <div className="flex flex-1 flex-col items-start gap-3 px-shell py-8">
          <h2 className="text-h2 font-semibold">{t('trips.detail.notFound', { id: tripId })}</h2>
          <Button variant="secondary" asChild><Link to="/chuyen">{t('common.backToTrips')}</Link></Button>
        </div>
      ) : (
        // V2.3: vùng cuộn đè lên đáy dải trời (`sky-overlap`), card sơ đồ tuyến nằm nửa trên dải
        <div className="sky-overlap min-h-0 flex-1 overflow-auto px-shell pb-8">
          {/*
            Không chọn kiện: sơ đồ tuyến chiếm cả hàng, dưới là bảng kiện và cột phải 360 px. Chọn một kiện: panel kiện chiếm cột phải
            452 px từ đỉnh vùng, sơ đồ tuyến thu về cột trái (`ChiTietChuyenKien.jpg`). Hẹp hơn 1.280 px thì xếp chồng một cột.
            Vị trí đổi bằng grid-template-areas, không dựng thẻ hai lần.
          */}
          <div className={cn('grid items-start gap-4', editing
            ? 'xl:grid-cols-[minmax(0,1fr)_452px] xl:[grid-template-areas:"route_side"_"main_side"]'
            : 'xl:grid-cols-[minmax(0,1fr)_360px] xl:[grid-template-areas:"route_route"_"main_side"]')}>
            <div className="min-w-0 xl:[grid-area:route]">
              <TripRouteCard
                tripId={tripId}
                trip={trip}
                eta={etaQuery.data}
                vehicleName={vehicle.name}
                stops={stops}
                editable={editable}
                onAddStop={() => setAddingStop(true)}
                onReorder={(next) => stopsMutation.mutate(next)}
                onRemove={handleRemoveStop}
                selectedStop={stopFilter}
                onSelectStop={setStopFilter}
              />
            </div>

            <div className="flex min-w-0 flex-col gap-3 xl:[grid-area:main]">
              {/* Việc chờ điều phối viên đứng trước bảng kiện: còn dòng ở đây thì kho / tài xế chưa đi tiếp được (FE-6-04) */}
              <MissingPackagesCard tripId={tripId} />
              <ManualConfirmCard tripId={tripId} />
              <PickupRequestsCard tripId={tripId} phase={trip.phase} stops={trip.stops} />
              <PackagesTable
                packages={trip.packages}
                vehicle={vehicle}
                stops={stops}
                selectedId={editing?.id ?? null}
                onSelect={(pkg) => setEditing(editing?.id === pkg.id ? null : pkg)}
                // Kiện phải thuộc một điểm giao: chuyến chưa có điểm nào thì thêm điểm giao (hoặc đưa yêu cầu vào chuyến) trước
                onAdd={editable && stops.length > 0 ? () => setEditing(emptyPackage(trip.packages, stops[0]?.number ?? 1)) : undefined}
                onImport={editable && stops.length > 0 ? () => setImporting(true) : undefined}
                emptyHint={editable && stops.length === 0 ? t('trips.packages.emptyNoStops') : undefined}
                labelsHref={can('labels.print') ? tripLabelsPath(tripId) : undefined}
                stopFilter={stopFilter}
                onStopFilterChange={setStopFilter}
              />
              {/* Yêu cầu giao của chuyến: ngay dưới bảng kiện — mỗi yêu cầu đưa vào là các dòng kiện của bảng này */}
              <TripRequirementsCard trip={trip} onAssign={openAssign} />
              <TripPoolPackagesCard trip={trip} onAdd={editable ? () => setPickingPool(true) : undefined} />
              {editable ? <PackageImportDialog trip={trip} vehicle={vehicle} open={importing} onOpenChange={setImporting} /> : null}
              {canAssign ? <RequirementAssignDialog open={assigning} onOpenChange={setAssigning} tripId={tripId} /> : null}
              {editable ? <StopFormDialog open={addingStop} onOpenChange={setAddingStop} tripId={tripId} /> : null}
              {editable ? <PoolPackagePicker open={pickingPool} onOpenChange={setPickingPool} trip={trip} /> : null}
              <SegregationOverrideDialog pending={segregationGuard.pending} onClose={segregationGuard.close} />
            </div>

            {editing ? (
              // Ô lưới giãn hết hai hàng để panel tự dính (sticky, card riêng của panel) khi cuộn bảng kiện; không bọc thêm card
              <div className="min-w-0 xl:self-stretch xl:[grid-area:side]">
                <PackageFormPanel
                  key={editing.id}
                  tripId={tripId}
                  value={editing}
                  vehicle={vehicle}
                  stops={stops}
                  readOnly={!editable}
                  onSave={handleSave}
                  onDelete={trip.packages.some((pkg) => pkg.id === editing.id)
                    ? (pkg) => deletePackage.mutate(pkg.id, { onSuccess: () => setEditing(null) })
                    : undefined}
                  onDuplicate={trip.packages.some((pkg) => pkg.id === editing.id) ? handleDuplicate : undefined}
                  onClose={() => setEditing(null)}
                />
              </div>
            ) : (
              // Chuyến còn lập kế hoạch: "Kiểm tra trước khi tối ưu" đứng đầu cột phải (LM-104)
              <div className="flex min-w-0 flex-col gap-4 xl:[grid-area:side]">
                {trip.phase === 'planning' ? <TripReadinessCard tripId={tripId} onAssignRequirement={openAssign} /> : null}
                <SegregationCard tripId={tripId} packages={trip.packages} editable={editable} />
                <TripDetailSide trip={trip} vehicle={vehicle} driver={query.data?.driver ?? null} summary={summary} editable={editable} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function TripDetailPage() {
  const { tripId = '' } = useParams()

  // Các chuyến có ID số được tạo từ Backend hiện tại.
  if (/^[1-9]\d*$/.test(tripId)) {
    return <BackendTripDetail tripId={tripId} />
  }



  // Các chuyến mẫu giữ nguyên luồng cũ.
  return <MockTripDetailPage />
}
