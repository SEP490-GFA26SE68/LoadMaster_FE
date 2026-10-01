import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { useCan } from '@/features/auth/useCan'
import { useT } from '@/lib/i18n'
import type { TripPhase } from '@/lib/mock-db'
import { ApprovePlanDialog } from './ApprovePlanDialog'
import { plannerAccess } from './approval/planner-access'
import { useViewerApproval } from './approval/useViewerApproval'
import { createColorContext } from './colors'
import { createPerfStore, DebugOverlay } from './DebugOverlay'
import { EditorGestureHud } from './editor/EditorGestureHud'
import { EditorPanel } from './editor/EditorPanel'
import { EditorToolbar } from './editor/EditorToolbar'
import { useManualEditor } from './editor/useManualEditor'
import { operationApprovalChecks } from './operations/approval-checks'
import { SceneHud } from './operations/SceneHud'
import { useOperations } from './operations/useOperations'
import { PlannerActions } from './panels/PlannerActions'
import { PlannerNotices } from './PlannerNotices'
import { PlannerSimulationControls } from './PlannerSimulationControls'
import { SceneInspector } from './panels/SceneInspector'
import { WorkspaceToolbar, type InspectorTab } from './panels/WorkspaceToolbar'
import type { ViewerSceneModel } from './scene-input'
import { Timeline } from './Timeline'
import { useLoadPlanViewer } from './useLoadPlanViewer'
import { usePerformanceFlags } from './usePerformanceFlags'
import { usePlanApprovalQuery } from './usePlanSourceQuery'
import type { PlanSource } from './viewer-api'
import { ViewerHeader } from './ViewerHeader'
import { debugQualityTier } from './viewer-options'
import { ViewerSkeleton } from './ViewerSkeleton'

/** Three.js là chunk nặng nhất — chỉ tải khi mở màn này, các màn khác không gánh. */
const LoadPlanViewer = lazy(() => import('./LoadPlanViewer').then((module) => ({ default: module.LoadPlanViewer })))

/**
 * Một phiên Planner trên một snapshot (LM-049, LM-050, LM-094): hàng điều khiển, thông báo khoá/lỗi thời, scene, inspector,
 * timeline và Duyệt. Hành động chính duy nhất: nút Duyệt ("Duyệt phương án" / "Duyệt bản chỉnh"), vắng khi bản đã duyệt chưa có
 * chỉnh sửa. `phase` của chuyến (D-45): từ `loading` trở đi phương án đã chốt — không Chỉnh sửa, không Duyệt; fixture benchmark
 * không có chuyến trong kho nên coi như đang lập kế hoạch.
 * Phím tắt: Space phát/dừng, ←/→ lùi/tiến một bước, Home về đầu.
 */
export function ViewerSession({ model: plan, phase, source }: { model: ViewerSceneModel; phase?: TripPhase; source?: PlanSource }) {
  const params = useParams()
  const [searchParams] = useSearchParams()
  const tripId = params.tripId ?? plan.tripId
  const showPerf = searchParams.has('debug')
  const t = useT()
  const can = useCan()

  const flags = usePerformanceFlags(debugQualityTier(searchParams))
  const state = useLoadPlanViewer(plan, { initialSelectedId: plan.placements[0]?.id })
  const editor = useManualEditor(state)
  const operations = useOperations(state)
  const approval = useViewerApproval(plan, state)
  // Chỉ dời/xoay kiện là chỉnh sửa cần Duyệt lại; ghim không thuộc phương án gửi Duyệt.
  const hasEdits = (approval.approval?.patches.length ?? 0) > 0
  // Điều phối viên chỉnh tay và duyệt (`plans.approve`, FE-0-07), quản lý công ty chỉ xem; chuyến đã sang pha vận hành thì phương án
  // đã chốt với mọi vai trò (D-45)
  const approvedBy = usePlanApprovalQuery(plan.revision?.id).data?.approvedByName
  const access = plannerAccess({ phase, canApprove: can('plans.approve'), approvedAt: plan.revision?.approvedAt ?? null, hasEdits })
  const handleEdit = access.lock === null ? () => handleModeChange('edit') : undefined
  const colorContext = useMemo(() => createColorContext(plan), [plan])
  const perfStore = useMemo(() => createPerfStore(), [])
  const [approveOpen, setApproveOpen] = useState(false)
  const [inspectorTab, setInspectorTab] = useState<InspectorTab | null>(null)
  const { followPlacement } = editor
  const { follow, current: currentOperation } = operations
  useEffect(() => { if (follow === 'on' && currentOperation && editor.mode === 'view') followPlacement(currentOperation) }, [follow, currentOperation, editor.mode, followPlacement])

  const totalPackages = plan.placements.length + plan.unplaced.length
  const planIssues = useMemo(() => approval.approval ? [...approval.approval.blockers.issues, ...approval.approval.warnings] : [], [approval.approval])
  const approvalChecks = useMemo(() => approveOpen
    ? operationApprovalChecks(state.placements, state.draft.patches.size > 0, t) : [],
  [approveOpen, state.placements, state.draft.patches.size, t])

  const { togglePlaying, stepForward, stepBackward, goToStart } = operations
  useEffect(() => {
    if (editor.mode === 'edit') return
    function handleKeyDown(event: KeyboardEvent) {
      // Không cướp phím khi người dùng đang gõ trong ô nhập, hộp thoại hoặc danh sách của Select đang mở (Space chọn dòng).
      const target = event.target instanceof HTMLElement ? event.target : null
      if (target?.closest('input, textarea, select, button, a, [contenteditable="true"], [role="dialog"], [role="listbox"]')) return
      if (event.key === ' ') { event.preventDefault(); togglePlaying() }
      else if (event.key === 'ArrowRight') stepForward()
      else if (event.key === 'ArrowLeft') stepBackward()
      else if (event.key === 'Home') goToStart()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePlaying, stepForward, stepBackward, goToStart, editor.mode])

  function handleModeChange(mode: 'view' | 'edit') { operations.stop(); operations.setFollow('off'); editor.setMode(mode) }
  /** Từ hộp thoại Duyệt: đóng hộp thoại, về chế độ Xem và mở mô phỏng dỡ hàng để xem kiện chắn lối (V2.3 Planner3DTatLIFO). */
  function handleShowUnloading() { setApproveOpen(false); if (editor.mode === 'edit') handleModeChange('view'); operations.setKind('unloading') }

  const simulation = { operations, stops: plan.stops, preset: state.cameraPreset, onPreset: state.setCameraPreset }
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas-1">
      <ViewerHeader
        tripId={tripId}
        title={source?.trip.name}
        revisionId={plan.revision?.id ?? null}
        stale={plan.revision?.stale ?? false}
        lifoOff={plan.engineInput?.settings.enforceLifo === false}
        metrics={plan.metrics}
        placedCount={plan.placements.length}
        totalCount={totalPackages}
        isMockResult={plan.isMockResult}
        manuallyEdited={!hasEdits && (plan.revision?.manuallyEdited ?? false)}
        controls={editor.mode === 'view' ? <PlannerSimulationControls {...simulation} /> : undefined}
      >
        <PlannerActions tripId={tripId} access={access} blockedReason={approval.blockedReason} approvedBy={approvedBy}
          onApprove={() => setApproveOpen(true)} onEdit={editor.mode === 'view' ? handleEdit : undefined} />
      </ViewerHeader>
      <PlannerNotices model={plan} source={source} lock={access.lock}
        rerunTo={can('optimization.run') && (phase ?? 'planning') === 'planning' ? `/chuyen/${tripId}/toi-uu` : undefined} />
      {editor.mode === 'edit' ? <EditorToolbar state={state} editor={editor} onModeChange={handleModeChange} /> :
        <WorkspaceToolbar {...simulation} onEdit={handleEdit} />}
      <div className={`relative flex min-h-0 flex-1 ${editor.mode === 'edit' ? 'flex-col xl:flex-row' : ''}`}>
        <div className="relative min-h-48 min-w-0 flex-1 overflow-hidden bg-canvas-1">
          <Suspense fallback={<ViewerSkeleton packageCount={plan.placements.length} stopCount={plan.stops.length} />}>
            <LoadPlanViewer state={state} flags={flags} editor={editor} operations={operations} onPerfSample={showPerf ? perfStore.publish : undefined} />
          </Suspense>

          {editor.mode === 'view' ? <SceneHud state={state} operations={operations} onInspect={setInspectorTab}
            onResetFocus={editor.focus ? () => { operations.setFollow('off'); editor.resetFocus() } : undefined}
            onFocus={(p) => { operations.pauseFollow(); if (p) editor.focusPlacement(p); else editor.focusSelected() }} onEdit={handleEdit} /> : null}
          {showPerf ? <DebugOverlay store={perfStore} /> : null}
          {editor.mode === 'edit' && state.selected ? <EditorGestureHud placement={state.selected} editor={editor} /> : null}
        </div>

        {editor.mode === 'edit' ? <EditorPanel state={state} editor={editor} /> :
          <SceneInspector state={state} operations={operations} tripId={tripId} colorContext={colorContext} issues={planIssues}
            onEdit={handleEdit} onFocus={editor.focusSelected}
            onSelect={(p) => { state.select(p.id); operations.pauseFollow(); editor.focusPlacement(p) }}
            tab={inspectorTab} onTab={setInspectorTab} onClose={() => setInspectorTab(null)} />}
      </div>

      {editor.mode === 'view' ? <Timeline
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
      /> : null}

      {plan.metrics && approval.approval ? (
        <ApprovePlanDialog
          open={approveOpen}
          onOpenChange={setApproveOpen}
          metrics={plan.metrics}
          canSubmit={approval.canSubmit}
          approval={approval.approval}
          checks={approvalChecks}
          pending={approval.pending}
          onConfirm={() => approval.confirm(() => setApproveOpen(false))}
          isMockResult={plan.isMockResult}
          lifoOff={plan.engineInput?.settings.enforceLifo === false}
          onShowUnloading={handleShowUnloading}
        />
      ) : null}
    </div>
  )
}
