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
import { validateRequest } from '@/domain/constraints'
import { TripFormSection } from '@/features/trips/TripFormSection'
import { formatIssue, useFormat, useT } from '@/lib/i18n'
import { OPTIMIZATION_ALGORITHMS, OPTIMIZATION_OBJECTIVES } from '@/lib/mock-db'
import { OptimizationServiceError } from '@/services/optimization'
import { OpenDecisionBanner } from './OpenDecisionBanner'
import { OptimizationErrorDialog, type OptimizationFailure } from './OptimizationErrorDialog'
import { OptimizationRunDialog } from './OptimizationRunDialog'
import { OptimizationSetupHero } from './OptimizationSetupHero'
import { buildOptimizationRequest, DEFAULT_SETUP, groupRequestIssues, METHODS, splitSetup, type SetupValues } from './optimization-request'
import { RequestIssueList } from './RequestIssueList'
import { RunHistoryCard } from './RunHistoryCard'
import { buildSetupChecklist } from './setup-checklist'
import { SetupAfterSteps } from './SetupAfterSteps'
import { SetupContextPanels } from './SetupContextPanels'
import { SetupLimitsPanel } from './SetupLimitsPanel'
import { SetupAdvancedFields, SetupRequirementFields } from './SetupSettingsFields'
import { useRunHistoryQuery } from './useOptimizationRuns'
import { useOptimizationRun, useOptimizationSetupQuery } from './useOptimizationSetup'

/**
 * Thiết lập tối ưu (LM-047) và chạy job (LM-048), giao diện V2.3 (LM-106): dải trời có đường dẫn, chip trạng thái, dòng dữ liệu chuyến
 * và nút primary duy nhất "Tối ưu" (khoá khi còn lỗi, lý do ngay trên nút). Cột trái một thẻ ba mục đánh số rồi bảng "Lần chạy tối ưu"
 * (LM-104); cột phải 416 px: "Hai giới hạn", danh sách kiểm tra trực tiếp, "Sau khi chạy". Chạy xong mở Planner với revision mới.
 * Chuyến đã sang pha vận hành (D-45, LM-088): banner nói lý do, không đổi xe, nút Tối ưu tắt — kho cũng từ chối `TRIP_LOCKED`.
 */
export function OptimizationSetupPage() {
  const { tripId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const t = useT()
  const format = useFormat()
  const query = useOptimizationSetupQuery(tripId)
  const run = useOptimizationRun(tripId)
  const openDecision = useRunHistoryQuery(tripId).data?.openDecision
  const [failure, setFailure] = useState<OptimizationFailure | null>(null)

  const schema = useMemo(() => z.object({
    method: z.enum(METHODS),
    timeLimitSeconds: z.number({ error: t('optimization.timeLimitRange') }).int(t('optimization.timeLimitRange'))
      .min(1, t('optimization.timeLimitRange')).max(600, t('optimization.timeLimitRange')),
    randomSeed: z.number({ error: t('optimization.seedInteger') }).int(t('optimization.seedInteger')).min(0, t('optimization.seedInteger')).optional(),
    enforceLifo: z.boolean(),
    prioritizeLowCenterOfGravity: z.boolean(),
    objective: z.enum(OPTIMIZATION_OBJECTIVES),
    algorithm: z.enum(OPTIMIZATION_ALGORITHMS),
  }), [t])
  const form = useForm<SetupValues>({ resolver: zodResolver(schema), defaultValues: DEFAULT_SETUP, mode: 'onChange' })
  const watched = useWatch({ control: form.control })
  // Đọc ngay ở mỗi lần render để react-hook-form theo dõi `isValid` và `errors` từ lúc mount. Đọc sau `!summary?.canRun ||` thì
  // lần mở lại với bản cache còn lỗi bỏ qua nó, và nút Tối ưu kẹt ở trạng thái tắt sau khi dữ liệu đã sửa (LM-054).
  const { isValid, errors } = form.formState
  const values: SetupValues = { ...DEFAULT_SETUP, ...watched }

  const setup = query.data
  const locked = setup !== undefined && setup.trip.phase !== 'planning'
  const request = setup ? buildOptimizationRequest(setup.trip, setup.vehicle, splitSetup(values).settings) : null
  const summary = request && setup ? groupRequestIssues(validateRequest(request), { tripId, vehicleId: setup.vehicle.id }) : null
  const checklist = setup && summary ? buildSetupChecklist(setup.trip.packages, setup.vehicle, summary) : null
  const formErrors = (errors.timeLimitSeconds ? 1 : 0) + (errors.randomSeed ? 1 : 0)
  const blockedReason = !locked && checklist && (checklist.errorCount > 0 || formErrors > 0)
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
    const { settings, run: choice } = splitSetup(submitted)
    const payload = buildOptimizationRequest(setup.trip, setup.vehicle, settings)
    run.mutate({ request: payload, simulateFailure: searchParams.get('mo-phong') === 'loi', run: choice }, {
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
        const unplaced = outcome.revision.result.unplacedPackages.length
        if (unplaced > 0) toast.warning(t('optimization.partial', { count: unplaced }))
        else toast.success(t('optimization.done'))
        void navigate(`/chuyen/${tripId}/phuong-an?revision=${outcome.revision.jobId}`)
      },
      onError: (error) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          toast.info(t('optimization.running.cancelled'))
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
        disabled={locked || !summary?.canRun || run.isPending || !isValid}
        blockedReason={run.isPending ? null : blockedReason}
        onRun={() => void handleRun()}
      >
        {setup && locked ? <TripLockBanner trip={setup.trip} /> : null}
        {/* Quản lý công ty đã trả lại phương án mà chưa có lần chạy nào sau đó: lý do nằm ngay chỗ điều phối sẽ chạy lại (LM-104) */}
        {setup && !locked && openDecision ? <OpenDecisionBanner tripId={tripId} /> : null}
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
            {/* Một thẻ ba mục đánh số; nút chính giữ ở dải trời (AGENTS mục 5: một nút primary mỗi màn) */}
            <Card className="overflow-hidden">
              <TripFormSection number={1} title={t('optimization.inputTitle')}>
                <SetupContextPanels tripId={tripId} setup={setup} locked={locked} payloadError={checklist.payload.state === 'fail'} />
              </TripFormSection>
              <TripFormSection number={2} title={t('optimization.requirementsTitle')} description={t('optimization.requirementsHint')}>
                <SetupRequirementFields form={form} />
              </TripFormSection>
              <section className="border-t border-line-soft px-7 pt-5.5 pb-6.5 max-sm:px-4">
                <SetupAdvancedFields form={form} />
              </section>
            </Card>
            {/* Lịch sử lần chạy (LM-104): mục tiêu, thuật toán, kết quả và số phận của từng phương án */}
            <RunHistoryCard tripId={tripId} />
          </div>
          <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-0">
            <SetupLimitsPanel setup={setup} />
            <RequestIssueList tripId={tripId} setup={setup} checklist={checklist} canRun={summary.canRun} locked={locked} />
            <SetupAfterSteps />
          </aside>
        </div>
      )}

      {run.isPending && setup ? (
        <OptimizationRunDialog
          progress={run.progress}
          context={{ tripId, vehicleName: setup.vehicle.name, total: checklist?.dimensions.instances ?? 0, values }}
          onCancel={run.cancel}
        />
      ) : null}
      {failure ? <OptimizationErrorDialog failure={failure} onClose={() => setFailure(null)} onRetry={() => void handleRun()} /> : null}
    </div>
  )
}
