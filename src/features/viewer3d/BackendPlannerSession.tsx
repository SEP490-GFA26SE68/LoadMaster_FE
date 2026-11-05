import { TriangleAlert } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/Button'
import { useCan } from '@/features/auth/useCan'
import { dataErrorMessage, useT } from '@/lib/i18n'
import type { TripStatus } from '@/types/trip'
import type { PlannerLock } from './approval/planner-access'
import { backendPlacementIds, backendPlanScene } from './backend-plan-scene'
import { BackendPlannerActions } from './BackendPlannerActions'
import { BackendRerunDialog } from './BackendRerunDialog'
import { createColorContext } from './colors'
import { createPerfStore, DebugOverlay } from './DebugOverlay'
import { useManualEditor } from './editor/useManualEditor'
import { SceneHud } from './operations/SceneHud'
import { useOperations } from './operations/useOperations'
import { PlannerLockNotice } from './PlannerLockNotice'
import { PlannerNoticeBar } from './PlannerNoticeBar'
import { PlannerSimulationControls } from './PlannerSimulationControls'
import { SceneInspector } from './panels/SceneInspector'
import { WorkspaceToolbar, type InspectorTab } from './panels/WorkspaceToolbar'
import { Timeline } from './Timeline'
import { useBackendPlanQuery, useTogglePinMutation } from './useBackendPlanQuery'
import { useLoadPlanViewer } from './useLoadPlanViewer'
import { usePerformanceFlags } from './usePerformanceFlags'
import type { BackendPlanSource } from './viewer-backend-api'
import { ViewerHeader } from './ViewerHeader'
import { debugQualityTier } from './viewer-options'
import { ViewerSkeleton } from './ViewerSkeleton'

const LoadPlanViewer = lazy(() => import('./LoadPlanViewer').then((module) => ({ default: module.LoadPlanViewer })))

/** Trạng thái chuyến của máy chủ → lý do khoá của Planner. Nháp và Đã lập kế hoạch còn lập kế hoạch: không khoá theo pha. */
const STATUS_LOCK: Readonly<Record<TripStatus, PlannerLock | null>> = {
  DRAFT: null, PLANNED: null, LOADING: 'loading', IN_TRANSIT: 'delivering', DELIVERED: 'completed', CANCELLED: 'cancelled',
}

/** Planner khi nhóm `trips` nối backend: phương án `?revision=<mã phương án>`, không có thì phương án đã duyệt, không nữa thì mới nhất. */
export function BackendResultSession() {
  const { tripId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const t = useT()
  const query = useBackendPlanQuery(tripId, searchParams.get('revision') ?? undefined)
  if (query.isPending) return <div className="relative h-dvh bg-canvas-1"><ViewerSkeleton packageCount={0} stopCount={0} /></div>
  const plan = query.data?.plan
  if (!query.data || !plan) {
    return (
      <div className="flex h-dvh flex-col bg-bg p-8">
        <EmptyState
          mascot={query.isError ? 'error' : 'empty'}
          title={query.isError ? t('viewer.plan.loadErrorTitle') : t('serverPlans.planner.emptyTitle')}
          description={query.isError ? t('viewer.plan.loadErrorDescription', { tripId }) : t('serverPlans.planner.emptyDescription')}
          action={<Button variant={query.isError ? 'secondary' : 'primary'} asChild>
            <Link to={query.isError ? '/chuyen' : `/chuyen/${encodeURIComponent(tripId)}/toi-uu`}>{query.isError ? t('common.backToTrips') : t('viewer.plan.toSetup')}</Link>
          </Button>}
        />
      </div>
    )
  }
  return <BackendPlannerSession key={plan.id} tripCode={tripId} source={{ ...query.data, plan }} />
}

/**
 * Một phiên Planner trên phương án của máy chủ: xem, mô phỏng xếp / dỡ, inspector, timeline và Duyệt (`POST /api/load-plans/{id}/approve`).
 * Chuyến Đã lập kế hoạch: điều phối viên (`plans.approve`) ghim / bỏ ghim kiện đang chọn ngay ở thẻ kiện — ghim lưu thẳng vào phương án
 * ở máy chủ, không qua Duyệt —, và khi có kiện ghim thì "Chạy lại giữ ghim" (`optimization.run`) ở góc dưới phải khung 3D. Không có chỉnh
 * tay hay đổi xe ở đây: máy chủ chưa nhận bản chỉnh (D-20 — không có nút giả). Kết quả của máy chủ không mang MOCK RESULT. Quản lý công ty
 * xem chỉ đọc (thiếu `plans.approve`). Phím tắt như Planner của kho mẫu.
 */
function BackendPlannerSession({ tripCode, source }: { tripCode: string; source: BackendPlanSource & { plan: NonNullable<BackendPlanSource['plan']> } }) {
  const [searchParams] = useSearchParams()
  const showPerf = searchParams.has('debug')
  const t = useT()
  const can = useCan()
  // Query giữ nguyên tham chiếu khi dữ liệu đọc lại không đổi (structural sharing): scene chỉ dựng lại khi máy chủ trả khác đi
  const { plan, vehicle, stops } = source
  const model = useMemo(() => backendPlanScene({ tripCode, plan, vehicle, stops }), [tripCode, plan, vehicle, stops])
  const flags = usePerformanceFlags(debugQualityTier(searchParams))
  const state = useLoadPlanViewer(model, { initialSelectedId: model.placements[0]?.id })
  const editor = useManualEditor(state)
  const operations = useOperations(state)
  const colorContext = useMemo(() => createColorContext(model), [model])
  const perfStore = useMemo(() => createPerfStore(), [])
  const [inspectorTab, setInspectorTab] = useState<InspectorTab | null>(null)

  const phaseLock = STATUS_LOCK[source.status]
  const lock: PlannerLock | null = phaseLock ?? (can('plans.approve') ? null : 'readOnly')
  const approve = lock !== null ? null : source.status === 'DRAFT' ? 'draft' : 'ready'
  // Ghim và chạy lại chỉ khi chuyến Đã lập kế hoạch: Nháp chưa có tuyến, pha vận hành đã khoá phương án
  const pinnable = lock === null && source.status === 'PLANNED'
  const canRerun = pinnable && can('optimization.run')
  const [rerunOpen, setRerunOpen] = useState(false)
  const pinMutation = useTogglePinMutation(tripCode, plan.id)
  const placementIds = useMemo(() => backendPlacementIds(plan), [plan])
  const pinnedCount = useMemo(() => plan.placements.filter((item) => item.pinned).length, [plan])
  const pin = pinnable ? {
    pending: pinMutation.isPending,
    onToggle: (placement: { id: string; pinned: boolean }) => {
      const placementId = placementIds.get(placement.id)
      if (placementId === undefined || pinMutation.isPending) return
      pinMutation.mutate({ placementId, pinned: !placement.pinned }, { onError: (error) => toast.error(dataErrorMessage(error, t)) })
    },
  } : undefined

  const { togglePlaying, stepForward, stepBackward, goToStart, follow, current, setFollow } = operations
  const { followPlacement } = editor
  useEffect(() => { if (follow === 'on' && current) followPlacement(current) }, [follow, current, followPlacement])
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target instanceof HTMLElement ? event.target : null
      if (target?.closest('input, textarea, select, button, a, [contenteditable="true"], [role="dialog"], [role="listbox"]')) return
      if (event.key === ' ') { event.preventDefault(); togglePlaying() }
      else if (event.key === 'ArrowRight') stepForward()
      else if (event.key === 'ArrowLeft') stepBackward()
      else if (event.key === 'Home') goToStart()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePlaying, stepForward, stepBackward, goToStart])

  const simulation = { operations, stops: model.stops, preset: state.cameraPreset, onPreset: state.setCameraPreset }
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas-1">
      <ViewerHeader tripId={tripCode} title={source.tripName} revisionId={model.revision?.id ?? null} metrics={model.metrics}
        placedCount={model.placements.length} totalCount={model.placements.length + model.unplaced.length} isMockResult={false}
        manuallyEdited={false} candidateLabel={source.plan.label ?? undefined} controls={<PlannerSimulationControls {...simulation} />}>
        <BackendPlannerActions tripCode={tripCode} plan={source.plan} approve={approve} />
      </ViewerHeader>
      <div className="flex flex-none flex-col items-start gap-2 px-2 pt-2 empty:hidden xl:px-3.5 xl:pt-2.5">
        <PlannerLockNotice lock={lock} />
        {approve === 'draft' && !source.plan.approved ? (
          <PlannerNoticeBar role="status" tone="warning" icon={TriangleAlert} title={t('serverPlans.planner.draftReason')} />
        ) : null}
      </div>
      <WorkspaceToolbar {...simulation} />
      <div className="relative flex min-h-0 flex-1">
        <div className="relative min-h-48 min-w-0 flex-1 overflow-hidden bg-canvas-1">
          <Suspense fallback={<ViewerSkeleton packageCount={model.placements.length} stopCount={model.stops.length} />}>
            <LoadPlanViewer state={state} flags={flags} editor={editor} operations={operations} onPerfSample={showPerf ? perfStore.publish : undefined} />
          </Suspense>
          <SceneHud state={state} operations={operations} onInspect={setInspectorTab}
            onRerunPinned={canRerun ? () => setRerunOpen(true) : undefined}
            onResetFocus={editor.focus ? () => { setFollow('off'); editor.resetFocus() } : undefined}
            onFocus={(p) => { operations.pauseFollow(); if (p) editor.focusPlacement(p); else editor.focusSelected() }} />
          {showPerf ? <DebugOverlay store={perfStore} /> : null}
        </div>
        <SceneInspector state={state} operations={operations} tripId={tripCode} colorContext={colorContext} issues={[]} pin={pin}
          onFocus={editor.focusSelected} onSelect={(p) => { state.select(p.id); operations.pauseFollow(); editor.focusPlacement(p) }}
          tab={inspectorTab} onTab={setInspectorTab} onClose={() => setInspectorTab(null)} />
      </div>
      <Timeline
        placements={state.placements}
        kind={operations.kind}
        orderedOverride={operations.kind === 'unloading' ? operations.unload.ordered : undefined}
        suggested={!operations.unload.fromResult}
        step={operations.kind === 'unloading' ? operations.unload.cursor : state.step}
        totalSteps={operations.kind === 'unloading' ? operations.unload.ordered.length : state.totalSteps}
        playing={operations.playing}
        speed={state.speed}
        onStepChange={operations.kind === 'unloading' ? operations.unload.setCursor : state.setStep}
        onStepForward={operations.stepForward}
        onStepBackward={operations.stepBackward}
        onGoToStart={operations.goToStart}
        onTogglePlaying={operations.togglePlaying}
        onSpeedChange={state.setSpeed}
      />
      {canRerun ? <BackendRerunDialog tripCode={tripCode} plan={plan} pinnedCount={pinnedCount} open={rerunOpen} onOpenChange={setRerunOpen} /> : null}
    </div>
  )
}
