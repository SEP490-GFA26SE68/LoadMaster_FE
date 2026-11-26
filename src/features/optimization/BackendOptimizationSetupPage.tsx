import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useCurrentUser } from '@/features/auth/AuthProvider'
import { Banner } from '@/components/Banner'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useBackendTripDetailQuery } from '@/features/trips/useTripsQuery'
import { useBackendTripIdQuery } from '@/features/trips/useBackendTripQuery'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { BackendLoadPlansCard } from './BackendLoadPlansCard'
import { BackendPinsCard } from './BackendPinsCard'
import { BackendRunDialog } from './BackendRunDialog'
import type { RunInputs } from './BackendRunProgress'
import type { BackendTripDetail } from '@/features/trips/trips-api'
import { useTripLoadPlansQuery } from './useLoadPlansQuery'
import { BackendInitialActionPanel } from './BackendInitialActionPanel'
import type { OptimizationJob } from './load-plan-dto'
export { BackendInitialActionPanel as BackendOptimizationSetupPage } from './BackendInitialActionPanel'

/** Mã trên URL có thể là mã chuyến (liên kết từ Giám sát, nhật ký): đổi sang mã số của máy chủ trước. */
export function BackendOptimizationSetupRoute() {
  const { tripId = '' } = useParams()
  const t = useT()
  const user = useCurrentUser()
  const resolved = useBackendTripIdQuery(tripId)
  if (resolved.isError) return <p role="alert" className="px-shell py-8 text-body text-danger">{dataErrorMessage(resolved.error, t)}</p>
  if (resolved.data === undefined) return <div className="grid flex-1 place-items-center"><Spinner /></div>
  return <BackendTripOptimizationPage key={JSON.stringify([user.id, user.companyId, resolved.data])} tripId={resolved.data} />
}

/**
 * Thiết lập tối ưu khi nhóm `trips` nối backend: một nút chính "Chạy tối ưu" gửi một lần chạy (`POST /api/trips/{id}/optimize-loading`,
 * credit một lần chạy, ba phương án), hộp thoại đọc lại trạng thái job tới khi xong, rồi mở màn So sánh của lần chạy đó. Bên dưới là các lần chạy
 * trước của chuyến. Không chọn mục tiêu hay thuật toán (D-77): máy chủ chọn theo gói. `tripId` là mã số của máy chủ. Mở từ "Chạy lại giữ
 * ghim" của Planner (`?giu-ghim=<mã phương án>`) thì có thẻ "Giữ kiện đã ghim": bật sẵn, lần chạy gửi `keepPinsFromPlanId` của phương án đó.
 */
function BackendTripOptimizationPage({ tripId }: { tripId: string }) {
  const t = useT()
  const navigate = useNavigate()
  const client = useQueryClient()
  const reasonId = useId()
  const detail = useBackendTripDetailQuery(tripId)
  const [params] = useSearchParams()
  const keepFrom = params.get('giu-ghim')
  const plans = useTripLoadPlansQuery(keepFrom === null ? '' : tripId)
  const [keepPins, setKeepPins] = useState(true)
  const pinSource = keepFrom === null ? undefined : plans.data?.plans.find((plan) => plan.id === keepFrom)
  const pinnedCount = pinSource?.placements.filter((placement) => placement.pinned).length ?? 0
  const [jobId, setJobId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [job, setJob] = useState<OptimizationJob | null>(null)
  const [jobError, setJobError] = useState<unknown>(null)
  const [hasPlans, setHasPlans] = useState(false)
  const [constraintCodes, setConstraintCodes] = useState<readonly string[]>([])
  const lastJobId = useRef<string | null>(null)
  const onJobChange = useCallback((id: string, state: OptimizationJob | null, savedPlans: boolean, error?: unknown, codes?: readonly string[]) => {
    setJobId(id)
    setJob(state)
    setHasPlans(savedPlans)
    setJobError(error ?? null)
    setConstraintCodes(codes ?? [])
    if (lastJobId.current !== id) {
      lastJobId.current = id
      setDialogOpen(true)
    }
  }, [])
  const tripCode = detail.data?.trip.tripCode ?? tripId
  const finished = job?.finished === true

  // Job xong: phương án mới nằm dưới khoá của chuyến. Có phương án và hộp thoại còn mở thì mở ngay các phương án của lần chạy để so sánh
  useEffect(() => {
    if (!finished || jobId === null) return
    void client.invalidateQueries({ queryKey: ['trips', tripId] })
    void client.invalidateQueries({ queryKey: ['billing'] })
    if (hasPlans && dialogOpen) void navigate(`/chuyen/${encodeURIComponent(tripCode)}/so-sanh?lan-chay=${encodeURIComponent(jobId)}`)
  }, [finished, hasPlans, jobId, tripId, tripCode, dialogOpen, client, navigate])

  if (detail.isPending) return <div className="grid flex-1 place-items-center"><Spinner /></div>
  if (detail.isError) return <p role="alert" className="px-shell py-8 text-body text-danger">{dataErrorMessage(detail.error, t)}</p>

  const { trip, stops } = detail.data
  const editable = trip.status === 'DRAFT' || trip.status === 'PLANNED'
  const blocked = !editable ? t('serverPlans.setup.locked') : stops.length === 0 ? t('serverPlans.setup.noStops') : null
  const tripPath = `/chuyen/${encodeURIComponent(trip.tripCode)}`

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <PageHero
        title={t('serverPlans.setup.title')}
        crumbs={[{ label: t('nav.trips'), to: '/chuyen' }, { label: trip.tripCode, to: tripPath, mono: true }]}
        description={t('serverPlans.setup.description')}

      />
      <div className="min-h-0 flex-1 overflow-y-auto px-shell py-6">
        <div className="flex flex-col gap-4">
          <BackendInitialActionPanel tripId={tripId} disabledReason={blocked} keepPinsFromPlanId={keepPins && pinnedCount > 0 ? keepFrom ?? undefined : undefined} onJobChange={onJobChange} />
          {blocked ? (
            <Banner tone="warning" action={<Button variant="secondary" size="sm" asChild><Link to={tripPath}>{t('serverPlans.setup.backToTrip')}</Link></Button>}>
              <span id={reasonId}>{blocked}</span>
            </Banner>
          ) : null}
          {keepFrom !== null && plans.data !== undefined ? <BackendPinsCard count={pinnedCount} keep={keepPins} onKeepChange={setKeepPins} /> : null}
          <BackendLoadPlansCard tripId={tripId} tripCode={trip.tripCode} showAlgorithms />
        </div>
      </div>
      {jobId !== null ? (
        <BackendRunDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          jobId={jobId}
          job={job}
          error={jobError}
          hasPlans={hasPlans}
          constraintCodes={constraintCodes}
          inputs={runInputsOf(trip, stops.length)}
          compareTo={`${tripPath}/so-sanh?lan-chay=${encodeURIComponent(jobId)}`}
        />
      ) : null}
    </div>
  )
}

/** Đầu vào thật của lần chạy từ Chi tiết chuyến của máy chủ: số kiện (máy chủ cũ không trả thì bỏ), số điểm giao, xe. */
function runInputsOf(trip: BackendTripDetail['trip'], stopCount: number): RunInputs {
  const vehicle = [trip.vehicleName?.trim(), trip.licensePlate?.trim()].filter(Boolean).join(' · ')
  return {
    packageCount: typeof trip.packageCount === 'number' ? trip.packageCount : null,
    stopCount,
    vehicleName: vehicle === '' ? null : vehicle,
  }
}
