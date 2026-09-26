import { zodResolver } from '@hookform/resolvers/zod'
import { Play } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { FormSection } from '@/components/FormSection'
import { PageHero } from '@/components/PageHero'
import { TripLockBanner } from '@/components/TripLockBanner'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { validateRequest } from '@/domain/constraints'
import { formatIssue, useFormat, useT } from '@/lib/i18n'
import { OptimizationServiceError } from '@/services/optimization'
import { OptimizationErrorDialog, type OptimizationFailure } from './OptimizationErrorDialog'
import { OptimizationRunDialog } from './OptimizationRunDialog'
import { buildOptimizationRequest, DEFAULT_SETTINGS, groupRequestIssues, METHODS, type OptimizationSettings } from './optimization-request'
import { RequestIssueList } from './RequestIssueList'
import { SetupContextPanels } from './SetupContextPanels'
import { SetupLimitsPanel } from './SetupLimitsPanel'
import { SetupAdvancedFields, SetupRequirementFields } from './SetupSettingsFields'
import { useOptimizationRun, useOptimizationSetupQuery } from './useOptimizationSetup'

/**
 * Thiết lập tối ưu (LM-047) và chạy job (LM-048): chọn xe, xem tóm tắt hàng, chỉnh thiết lập, validation summary gom
 * theo nhóm; nút primary duy nhất "Tối ưu" khoá khi còn lỗi. Chạy xong mở Planner với revision mới.
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
  const [failure, setFailure] = useState<OptimizationFailure | null>(null)

  const schema = useMemo(() => z.object({
    method: z.enum(METHODS),
    timeLimitSeconds: z.number({ error: t('optimization.timeLimitRange') }).int(t('optimization.timeLimitRange'))
      .min(1, t('optimization.timeLimitRange')).max(600, t('optimization.timeLimitRange')),
    randomSeed: z.number({ error: t('optimization.seedInteger') }).int(t('optimization.seedInteger')).min(0, t('optimization.seedInteger')).optional(),
    enforceLifo: z.boolean(),
    prioritizeLowCenterOfGravity: z.boolean(),
  }), [t])
  const form = useForm<OptimizationSettings>({ resolver: zodResolver(schema), defaultValues: DEFAULT_SETTINGS, mode: 'onChange' })
  const watched = useWatch({ control: form.control })
  // Đọc ngay ở mỗi lần render để react-hook-form theo dõi `isValid` từ lúc mount. Đọc sau `!summary?.canRun ||` thì
  // lần mở lại với bản cache còn lỗi bỏ qua nó, và nút Tối ưu kẹt ở trạng thái tắt sau khi dữ liệu đã sửa (LM-054).
  const { isValid } = form.formState

  const setup = query.data
  const locked = setup !== undefined && setup.trip.phase !== 'planning'
  const request = setup ? buildOptimizationRequest(setup.trip, setup.vehicle, { ...DEFAULT_SETTINGS, ...watched }) : null
  const summary = request && setup ? groupRequestIssues(validateRequest(request), { tripId, vehicleId: setup.vehicle.id }) : null

  function start(values: OptimizationSettings) {
    if (!setup) return
    setFailure(null)
    const payload = buildOptimizationRequest(setup.trip, setup.vehicle, values)
    run.mutate({ request: payload, simulateFailure: searchParams.get('mo-phong') === 'loi' }, {
      onSuccess: (outcome) => {
        if (outcome.kind === 'failed') {
          setFailure({ kind: 'failed', messages: validateRequest(payload).map((issue) => formatIssue(issue, t, format)) })
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

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero
        overlap
        title={t('optimization.title')}
        meta={tripId}
        description={t('pageHero.optimization')}
        back={{ to: `/chuyen/${tripId}`, label: t('optimization.back') }}
        actions={
          <Button
            variant="primary"
            disabled={locked || !summary?.canRun || run.isPending || !isValid}
            onClick={form.handleSubmit(start)}
          >
            <Play strokeWidth={1.5} />
            {t('optimization.run')}
          </Button>
        }
      />

      {query.isPending ? (
        <div role="status" className="grid flex-1 place-items-center"><Spinner /></div>
      ) : !setup || !summary ? (
        <div className="px-shell py-6">
          <Button variant="secondary" asChild><Link to="/chuyen">{t('optimization.back')}</Link></Button>
        </div>
      ) : (
        <div className="sky-overlap grid min-h-0 flex-1 grid-cols-1 items-start gap-6 overflow-auto px-shell pb-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          {locked ? <div className="lg:col-span-2"><TripLockBanner trip={setup.trip} /></div> : null}
          {/* V2: một thẻ gồm các phần đánh số; nút chính giữ ở thanh tiêu đề (AGENTS mục 5: một nút primary mỗi màn) */}
          <div className="flex min-w-0 flex-col gap-6 rounded-lg border border-border bg-bg p-6">
            <FormSection number={1} title={t('optimization.inputTitle')} description={<><span className="font-mono">{tripId}</span>{` · ${setup.trip.name}`}</>}>
              <SetupContextPanels tripId={tripId} setup={setup} locked={locked} />
            </FormSection>
            <FormSection number={2} title={t('optimization.requirementsTitle')} description={t('optimization.requirementsHint')}>
              <SetupRequirementFields form={form} />
            </FormSection>
            <div className="border-t border-border pt-5">
              <SetupAdvancedFields form={form} />
            </div>
          </div>
          <div className="flex flex-col gap-5 lg:sticky lg:top-0">
            <SetupLimitsPanel setup={setup} />
            <RequestIssueList summary={summary} />
            <div className="flex flex-col gap-1 px-1">
              <span className="text-caption font-medium text-ink-2">{t('optimization.afterTitle')}</span>
              <p className="text-caption text-ink-3">{t('optimization.afterSteps')}</p>
            </div>
          </div>
        </div>
      )}

      {run.isPending ? <OptimizationRunDialog progress={run.progress} onCancel={run.cancel} /> : null}
      {failure ? (
        <OptimizationErrorDialog failure={failure} onClose={() => setFailure(null)} onRetry={form.handleSubmit(start)} />
      ) : null}
    </div>
  )
}
