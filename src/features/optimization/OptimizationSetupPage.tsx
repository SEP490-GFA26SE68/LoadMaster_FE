import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { TripLockBanner } from '@/components/TripLockBanner'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { pinnedIssues, validateRequest } from '@/domain/constraints'
import { TripFormSection } from '@/features/trips/TripFormSection'
import { dataErrorMessage, formatIssue, useFormat, useT } from '@/lib/i18n'
import { MockDbError } from '@/lib/mock-db'
import { OptimizationServiceError } from '@/services/optimization'
import { OptimizationErrorDialog, type OptimizationFailure } from './OptimizationErrorDialog'
import type { OptimizationCredit } from './optimization-api'
import { OptimizationRunDialog } from './OptimizationRunDialog'
import { OptimizationSetupHero } from './OptimizationSetupHero'
import { buildOptimizationRequest, DEFAULT_SETUP, groupRequestIssues, METHODS, type SetupValues } from './optimization-request'
import { RequestIssueList } from './RequestIssueList'
import { RunHistoryCard } from './RunHistoryCard'
import { SetupPinsCard } from './SetupPinsCard'
import { buildSetupChecklist } from './setup-checklist'
import { SetupAfterSteps } from './SetupAfterSteps'
import { SetupContextPanels } from './SetupContextPanels'
import { SetupCreditPanel } from './SetupCreditPanel'
import { SetupLimitsPanel } from './SetupLimitsPanel'
import { SetupAdvancedFields, SetupCandidateList, SetupRequirementFields } from './SetupSettingsFields'
import { useOptimizationCreditQuery, useOptimizationRun, useOptimizationSetupQuery } from './useOptimizationSetup'

import { useQuery } from '@tanstack/react-query'
import { fetchBackendLoadPlans } from './optimization-api'

import {
  fetchBackendTripDetail,
  fetchTripVehicleConfig,
} from '@/features/trips/trips-api'
import { fetchPackage } from '@/features/package-pool/packages-api'
import {
  adaptBackendScene,
  adaptBackendVehicle,
} from '@/features/viewer3d/backend-scene-adapter'
import { BackendLoadPlanViewer } from '@/features/viewer3d/BackendLoadPlanViewer'

/**
 * Thiết lập tối ưu (LM-047) và chạy job (LM-048), giao diện V2.3 (LM-106): dải trời có đường dẫn, chip trạng thái, dòng dữ liệu chuyến
 * và nút primary duy nhất "Tối ưu" (khoá khi còn lỗi, lý do ngay trên nút). Cột trái một thẻ ba mục đánh số rồi bảng "Lần chạy tối ưu"
 * (LM-104); cột phải 416 px: "Hai giới hạn", danh sách kiểm tra trực tiếp, "Sau khi chạy". Mỗi lần chạy ra ba phương án ứng viên
 * (FE-5b-05, D-77): màn không còn ô chọn mục tiêu và thuật toán, chỉ chạy khi chuyến đã tối ưu tuyến, và chạy xong mở màn So sánh của
 * lần chạy đó (`?lan-chay=`).
 * Chuyến đã sang pha vận hành (D-45, LM-088): banner nói lý do, không đổi xe, nút Tối ưu tắt — kho cũng từ chối `TRIP_LOCKED`.
 */
function MockOptimizationSetupPage() {
  const { tripId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const t = useT()
  const format = useFormat()
  // `?giu-ghim=<mã revision>`: mở từ Planner để chạy lại giữ kiện đã ghim của phương án đó (FE-BL-02)
  const query = useOptimizationSetupQuery(tripId, searchParams.get('giu-ghim') ?? undefined)
  const run = useOptimizationRun(tripId)
  const creditQuery = useOptimizationCreditQuery()
  const [failure, setFailure] = useState<OptimizationFailure | null>(null)
  const [keepPins, setKeepPins] = useState(true)
  // Credit lúc bấm Tối ưu: hộp chạy hiện số của lần chạy này dù câu hỏi credit được làm mới giữa chừng
  const [runCredit, setRunCredit] = useState<OptimizationCredit | null>(null)

  const schema = useMemo(() => z.object({
    method: z.enum(METHODS),
    timeLimitSeconds: z.number({ error: t('optimization.timeLimitRange') }).int(t('optimization.timeLimitRange'))
      .min(1, t('optimization.timeLimitRange')).max(600, t('optimization.timeLimitRange')),
    randomSeed: z.number({ error: t('optimization.seedInteger') }).int(t('optimization.seedInteger')).min(0, t('optimization.seedInteger')).optional(),
    enforceLifo: z.boolean(),
    prioritizeLowCenterOfGravity: z.boolean(),
  }), [t])
  const form = useForm<SetupValues>({ resolver: zodResolver(schema), defaultValues: DEFAULT_SETUP, mode: 'onChange' })
  const watched = useWatch({ control: form.control })
  // Đọc ngay ở mỗi lần render để react-hook-form theo dõi `isValid` và `errors` từ lúc mount. Đọc sau `!summary?.canRun ||` thì
  // lần mở lại với bản cache còn lỗi bỏ qua nó, và nút Tối ưu kẹt ở trạng thái tắt sau khi dữ liệu đã sửa (LM-054).
  const { isValid, errors } = form.formState
  const values: SetupValues = { ...DEFAULT_SETUP, ...watched }

  const setup = query.data
  const locked = setup !== undefined && setup.trip.phase !== 'planning'
  // Giữ kiện đã ghim (FE-BL-02): request mang `pinnedPlacements` chỉ khi có kiện để giữ và công tắc bật
  const pinOffer = setup?.pinOffer ?? null
  const pinnedPlacements = pinOffer !== null && keepPins && pinOffer.placements.length > 0 ? pinOffer.placements : undefined
  const request = setup ? buildOptimizationRequest(setup.trip, setup.vehicle, values, pinnedPlacements) : null
  const pinFaults = request && pinnedPlacements ? pinnedIssues(request) : []
  const summary = request && setup ? groupRequestIssues(validateRequest(request), { tripId, vehicleId: setup.vehicle.id }) : null
  // Xếp 3D theo tuyến: chuyến phải đã tối ưu tuyến (Đã lập kế hoạch) — kho cũng từ chối `ROUTE_NOT_PLANNED`
  const checklist = setup && summary ? buildSetupChecklist(setup.trip.packages, setup.vehicle, summary, setup.trip.routePlan !== undefined) : null
  const formErrors = (errors.timeLimitSeconds ? 1 : 0) + (errors.randomSeed ? 1 : 0)
  // Hết credit, gói hết hạn (FE-8-05): nút Tối ưu mờ kèm lý do trước khi bấm; kho cũng từ chối (`INSUFFICIENT_CREDITS`, `SUBSCRIPTION_EXPIRED`)
  const creditBlock = creditQuery.data?.block ?? null
  const blockedReason = !locked && creditBlock !== null
    ? t(`optimization.credit.blocked.${creditBlock}`)
    : !locked && pinFaults.length > 0
      ? t('optimization.pins.blockedReason')
      : !locked && checklist && (checklist.errorCount > 0 || formErrors > 0)
        ? t('optimization.blockedHint', {
          count: checklist.errorCount + formErrors,
          places: format.list([
            ...checklist.errorGroups.map((group) => t(`optimization.groups.${group}`)),
            ...(formErrors > 0 ? [t('optimization.advancedTitle')] : []),
          ]),
        })
        : null

  function start(submitted: SetupValues) {
    if (!setup) return
    setFailure(null)
    setRunCredit(creditQuery.data ?? null)
    const payload = buildOptimizationRequest(setup.trip, setup.vehicle, submitted, pinnedPlacements)
    run.mutate({ request: payload, simulateFailure: searchParams.get('mo-phong') === 'loi' }, {
      onSuccess: (outcome) => {
        if (outcome.kind === 'failed') {
          setFailure({
            kind: 'failed',
            issues: validateRequest(payload).map((issue) => ({
              severity: issue.severity === 'error' ? 'error' : 'warning',
              message: formatIssue(issue, t, format),
            })),
          })
          return
        }
        // Kết quả một phần: không phương án nào xếp hết — báo số kiện chưa xếp của phương án xếp được nhiều nhất
        const unplaced = Math.min(...outcome.revisions.map((revision) => revision.result.unplacedPackages.length))
        if (unplaced > 0) toast.warning(t('optimization.partial', { count: unplaced }))
        else toast.success(t('optimization.done'))
        void navigate(`/chuyen/${tripId}/so-sanh?lan-chay=${encodeURIComponent(outcome.run.id)}`)
      },
      onError: (error) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          toast.info(t('optimization.running.cancelled'))
          return
        }
        if (error instanceof MockDbError) {
          toast.error(dataErrorMessage(error, t))
          return
        }
        setFailure({ kind: 'service', code: error instanceof OptimizationServiceError ? error.code : 'MOCK_FAILED' })
      },
    })
  }

  const handleRun = form.handleSubmit(start)

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <OptimizationSetupHero
        tripId={tripId}
        setup={setup}
        disabled={locked || !checklist?.canRun || run.isPending || !isValid || creditBlock !== null || pinFaults.length > 0}
        blockedReason={run.isPending ? null : blockedReason}
        onRun={() => void handleRun()}
      >
        {setup && locked ? <TripLockBanner trip={setup.trip} /> : null}
      </OptimizationSetupHero>

      {query.isPending ? (
        <div role="status" className="grid flex-1 place-items-center"><Spinner /></div>
      ) : !setup || !summary || !checklist ? (
        <div className="px-shell py-6">
          <Button variant="secondary" asChild><Link to="/chuyen">{t('optimization.back')}</Link></Button>
        </div>
      ) : (
        <div className="sky-overlap grid min-h-0 flex-1 grid-cols-1 items-start gap-4 overflow-auto px-shell pb-7 xl:grid-cols-[minmax(0,1fr)_416px]">
          <div className="flex min-w-0 flex-col gap-4">
            {pinOffer ? <SetupPinsCard offer={pinOffer} keep={keepPins} onKeepChange={setKeepPins} issues={pinFaults} /> : null}
            {/* Một thẻ ba mục đánh số; nút chính giữ ở dải trời (AGENTS mục 5: một nút primary mỗi màn) */}
            <Card className="overflow-hidden">
              <TripFormSection number={1} title={t('optimization.inputTitle')}>
                <SetupContextPanels tripId={tripId} setup={setup} locked={locked} payloadError={checklist.payload.state === 'fail'} />
              </TripFormSection>
              <TripFormSection number={2} title={t('optimization.requirementsTitle')} description={t('optimization.requirementsHint')}>
                <SetupRequirementFields form={form} />
              </TripFormSection>
              <TripFormSection number={3} title={t('optimization.candidatesTitle')} description={t('optimization.candidatesHint')}>
                <SetupCandidateList />
              </TripFormSection>
              <section className="border-t border-line-soft px-7 pt-5.5 pb-6.5 max-sm:px-4">
                <SetupAdvancedFields form={form} />
              </section>
            </Card>
            {/* Lịch sử lần chạy (LM-104): thuật toán, ba phương án của từng lần chạy và lần chạy đã duyệt hay còn chờ duyệt */}
            <RunHistoryCard tripId={tripId} />
          </div>
          <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-0">
            <SetupCreditPanel credit={creditQuery.data} />
            <SetupLimitsPanel setup={setup} />
            <RequestIssueList tripId={tripId} setup={setup} checklist={checklist} canRun={checklist.canRun} locked={locked} />
            <SetupAfterSteps />
          </aside>
        </div>
      )}

      {run.isPending && setup ? (
        <OptimizationRunDialog
          progress={run.progress}
          context={{ tripId, vehicleName: setup.vehicle.name, total: checklist?.dimensions.instances ?? 0, values, credit: runCredit }}
          onCancel={run.cancel}
        />
      ) : null}
      {failure ? <OptimizationErrorDialog failure={failure} onClose={() => setFailure(null)} onRetry={() => void handleRun()} /> : null}
    </div>
  )
}


export function OptimizationSetupPage() {
  const { tripId = '' } = useParams()

  if (/^[1-9]\d*$/.test(tripId)) {
    return <BackendOptimizationSetupPage tripId={tripId} />
  }

  return <MockOptimizationSetupPage />
}

function BackendOptimizationSetupPage({
  tripId,
}: {
  tripId: string
}) {
  const t = useT()

  // Job đã hoàn thành của Trip 3, chỉ dùng để kiểm thử kết nối.
  const jobId =
    tripId === '3'
      ? 'c429898c-0b02-4cf5-ad66-d476bb2c505c'
      : null

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

        {jobId === null ? (
          <p className="mt-3 text-sm">
            Trip #{tripId}: No optimization job selected.
          </p>
        ) : plansQuery.isPending ? (
          <div className="mt-4">
            <Spinner />
          </div>
        ) : plansQuery.isError ? (
          <p className="mt-3 text-sm text-red-500">
            {plansQuery.error.message}
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <p>Job: {jobId}</p>

            {plans.map((plan) => (
              <div key={plan.id} className="rounded-lg border p-4">
                <p className="font-medium">{plan.plan_name}</p>
                <p>LoadPlan ID: {plan.id}</p>
                <p>Packages: {plan.packed_items_count}</p>
                <p>
                  Volume utilization:{' '}
                  {((plan.volume_utilization ?? 0) * 100).toFixed(2)}%
                </p>
                <p>
                  Weight utilization:{' '}
                  {((plan.weight_utilization ?? 0) * 100).toFixed(2)}%
                </p>
                <p>Placements returned: {plan.placements.length}</p>
              </div>
            ))}
            {sceneQuery.isPending ? (
              <div role="status" className="py-6">
                <Spinner />
              </div>
            ) : sceneQuery.isError ? (
              <p role="alert" className="text-sm text-red-500">
                {sceneQuery.error.message}
              </p>
            ) : sceneQuery.data ? (
              <BackendLoadPlanViewer
                key={`${tripId}-${plans[0]?.id}`}
                model={sceneQuery.data}
              />
            ) : null}
          </div>
        )}
      </Card>
    </div>
  )
}