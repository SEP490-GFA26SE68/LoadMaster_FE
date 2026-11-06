import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PackageOpen } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Banner } from '@/components/Banner'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { fetchBackendTripDetail, resolveBackendTripId } from '@/features/trips/trips-api'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { BackendLoadPlansCard } from './BackendLoadPlansCard'
import { BackendPinsCard } from './BackendPinsCard'
import { BackendRunDialog } from './BackendRunDialog'
import { useOptimizationJobQuery, useStartLoadingOptimizationMutation, useTripLoadPlansQuery } from './useLoadPlansQuery'

/** Mã trên URL có thể là mã chuyến (liên kết từ Giám sát, nhật ký): đổi sang mã số của máy chủ trước. */
export function BackendOptimizationSetupRoute() {
  const { tripId = '' } = useParams()
  const t = useT()
  const resolved = useQuery({ queryKey: ['trips', tripId, 'backend-id'], queryFn: () => resolveBackendTripId(tripId), staleTime: Infinity })
  if (resolved.isError) return <p role="alert" className="px-shell py-8 text-body text-danger">{dataErrorMessage(resolved.error, t)}</p>
  if (resolved.data === undefined) return <div className="grid flex-1 place-items-center"><Spinner /></div>
  return <BackendOptimizationSetupPage tripId={resolved.data} />
}

/**
 * Thiết lập tối ưu khi nhóm `trips` nối backend: một nút chính "Chạy tối ưu" gửi một lần chạy (`POST /api/trips/{id}/optimize-loading`,
 * một credit, ba phương án), hộp thoại đọc lại trạng thái job tới khi xong, rồi mở màn So sánh của lần chạy đó. Bên dưới là các lần chạy
 * trước của chuyến. Không chọn mục tiêu hay thuật toán (D-77): máy chủ chọn theo gói. `tripId` là mã số của máy chủ. Mở từ "Chạy lại giữ
 * ghim" của Planner (`?giu-ghim=<mã phương án>`) thì có thẻ "Giữ kiện đã ghim": bật sẵn, lần chạy gửi `keepPinsFromPlanId` của phương án đó.
 */
function BackendOptimizationSetupPage({ tripId }: { tripId: string }) {
  const t = useT()
  const navigate = useNavigate()
  const client = useQueryClient()
  const reasonId = useId()
  const detail = useQuery({ queryKey: ['trips', tripId, 'backend-detail'], queryFn: () => fetchBackendTripDetail(tripId) })
  const start = useStartLoadingOptimizationMutation(tripId)
  const [params] = useSearchParams()
  const keepFrom = params.get('giu-ghim')
  const plans = useTripLoadPlansQuery(keepFrom === null ? '' : tripId)
  const [keepPins, setKeepPins] = useState(true)
  const pinSource = keepFrom === null ? undefined : plans.data?.plans.find((plan) => plan.id === keepFrom)
  const pinnedCount = pinSource?.placements.filter((placement) => placement.pinned).length ?? 0
  const [jobId, setJobId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const job = useOptimizationJobQuery(jobId)
  const tripCode = detail.data?.trip.tripCode ?? tripId
  const finished = job.data?.finished === true
  const hasPlans = job.data?.status === 'COMPLETED' || job.data?.status === 'PARTIAL'

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
  const running = jobId !== null && !finished && !job.isError
  const tripPath = `/chuyen/${encodeURIComponent(trip.tripCode)}`

  function handleRun() {
    start.mutate(keepPins && pinnedCount > 0 && keepFrom !== null ? keepFrom : undefined, {
      onSuccess: ({ jobId: started }) => {
        setJobId(started)
        setDialogOpen(true)
      },
      onError: (error) => toast.error(dataErrorMessage(error, t)),
    })
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <PageHero
        title={t('serverPlans.setup.title')}
        crumbs={[{ label: t('nav.trips'), to: '/chuyen' }, { label: trip.tripCode, to: tripPath, mono: true }]}
        description={t('serverPlans.setup.description')}
        actions={
          <Button type="button" loading={start.isPending} disabled={blocked !== null || running} aria-describedby={blocked ? reasonId : undefined}
            onClick={handleRun}>
            <PackageOpen className="size-4" aria-hidden />{t('serverPlans.setup.run')}
          </Button>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-shell py-6">
        <div className="flex flex-col gap-4">
          {blocked ? (
            <Banner tone="warning" action={<Button variant="secondary" size="sm" asChild><Link to={tripPath}>{t('serverPlans.setup.backToTrip')}</Link></Button>}>
              <span id={reasonId}>{blocked}</span>
            </Banner>
          ) : null}
          {keepFrom !== null && plans.data !== undefined ? <BackendPinsCard count={pinnedCount} keep={keepPins} onKeepChange={setKeepPins} /> : null}
          <BackendLoadPlansCard tripId={tripId} tripCode={trip.tripCode} />
        </div>
      </div>
      {jobId !== null ? (
        <BackendRunDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          jobId={jobId}
          job={job.data ?? null}
          error={job.isError ? job.error : null}
          compareTo={`${tripPath}/so-sanh?lan-chay=${encodeURIComponent(jobId)}`}
        />
      ) : null}
    </div>
  )
}
