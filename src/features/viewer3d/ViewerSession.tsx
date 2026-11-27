import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { useCan } from '@/features/auth/useCan'
import { tripStatus, type TripPhase } from '@/lib/mock-db'
import { plannerAccess } from './approval/planner-access'
import { useViewerApproval } from './approval/useViewerApproval'
import { createColorContext } from './colors'
import { createPerfStore, DebugOverlay } from './DebugOverlay'
import { useDialogOpener } from './dialog-opener'
import { EditorGestureHud } from './editor/EditorGestureHud'
import { EditorPanel } from './editor/EditorPanel'
import { EditorToolbar } from './editor/EditorToolbar'
import { useManualEditor } from './editor/useManualEditor'
import { SceneHud } from './operations/SceneHud'
import { useOperations } from './operations/useOperations'
import { PlannerActions } from './panels/PlannerActions'
import { ApprovePlanHost, ChangeVehicleHost } from './PlannerDialogHosts'
import { PlannerNotices } from './PlannerNotices'
import { PlannerSimulationControls } from './PlannerSimulationControls'
import { SceneInspector } from './panels/SceneInspector'
import { WorkspaceToolbar, type InspectorTab } from './panels/WorkspaceToolbar'
import type { ViewerSceneModel } from './scene-input'
import { PlannerTimeline } from './PlannerTimeline'
import { useLoadPlanViewer } from './useLoadPlanViewer'
import { usePerformanceFlags } from './usePerformanceFlags'
import { usePlanApprovalQuery } from './usePlanSourceQuery'
import { usePlannerSessionControls } from './usePlannerSessionControls'
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
 * Phím tắt: Space phát/dừng, ←/→ lùi/tiến một bước, Home về đầu (`usePlannerSessionControls`).
 *
 * Bước phát lại và chọn kiện vẽ lại phiên này, nhưng mọi phần không đổi theo chúng (thanh trên, thông báo, thanh công cụ, phần tĩnh của
 * HUD, hộp Duyệt) bọc `memo` và nhận props giữ tham chiếu: hàm qua `useCallback` / `useMemo`, phần tử truyền làm prop qua `useMemo`.
 */
export function ViewerSession({ model: plan, phase, source }: { model: ViewerSceneModel; phase?: TripPhase; source?: PlanSource }) {
  const params = useParams()
  const [searchParams] = useSearchParams()
  const tripId = params.tripId ?? plan.tripId
  const showPerf = searchParams.has('debug')
  const can = useCan()

  const flags = usePerformanceFlags(debugQualityTier(searchParams))
  const state = useLoadPlanViewer(plan, { initialSelectedId: plan.placements[0]?.id })
  const editor = useManualEditor(state)
  const operations = useOperations(state)
  const approval = useViewerApproval(plan, state)
  const { handleModeChange, handleResetFocus, handleFocus, handleSelect, simulation, spin } =
    usePlannerSessionControls(state, operations, editor, { stops: plan.stops, reducedMotion: flags.reducedMotion })
  // Dời, xoay hoặc ghim kiện là chỉnh sửa cần Duyệt để lưu (ghim lưu cùng phương án, FE-BL-02); chỉ dời / xoay mới là "chỉnh tay"
  const poseEdits = (approval.approval?.patches.length ?? 0) > 0
  const hasEdits = poseEdits || (approval.approval?.pinsChanged ?? false)
  // Điều phối viên chỉnh tay và duyệt (`plans.approve`, FE-0-07), quản lý công ty chỉ xem; chuyến đã sang pha vận hành thì phương án
  // đã chốt với mọi vai trò (D-45)
  const planInfo = usePlanApprovalQuery(plan.revision?.id).data
  const approvedBy = planInfo?.approvedByName
  // Phương án ứng viên của một lần chạy (FE-5b-06): nhãn A · B · C ở tiêu đề, nút So sánh mở đúng ba phương án của lần chạy đó. Bản đã
  // chỉnh tay không còn nguyên là phương án ứng viên: nhãn "Đã chỉnh tay" nói thay, không kèm chữ cái (hai nhãn không vừa 1.536 px)
  const candidate = planInfo?.candidate ?? null
  const canApprove = can('plans.approve')
  const approvedAt = plan.revision?.approvedAt ?? null
  const access = useMemo(() => plannerAccess({ phase, canApprove, approvedAt, hasEdits }), [phase, canApprove, approvedAt, hasEdits])
  const editable = access.lock === null
  const handleEdit = useMemo(() => editable ? () => handleModeChange('edit') : undefined, [editable, handleModeChange])
  const colorContext = useMemo(() => createColorContext(plan), [plan])
  const perfStore = useMemo(() => createPerfStore(), [])
  // State mở của hộp Duyệt và hộp Đổi xe nằm ở chính hộp thoại: mở / đóng không vẽ lại phiên và khung 3D
  const approveDialog = useDialogOpener()
  // Đổi xe (FE-5b-08, D-80): chuyến Đã lập kế hoạch, người sửa được chuyến; nút nằm ở góc khung 3D (thanh trên không còn chỗ), đổi
  // xong phương án đang xem thành lỗi thời
  const canChangeVehicle = source !== undefined && can('trips.edit') && tripStatus(source.trip) === 'PLANNED'
  const vehicleDialog = useDialogOpener()
  // Chạy lại giữ kiện đã ghim (FE-BL-02): mở Thiết lập tối ưu với ghim của phương án đang xem; cần quyền chạy tối ưu và chuyến Đã lập kế hoạch
  const navigate = useNavigate()
  const canRerunPinned = source !== undefined && plan.revision !== undefined && can('optimization.run') && tripStatus(source.trip) === 'PLANNED'
  const revisionId = plan.revision?.id ?? ''
  const handleRerunPinned = useMemo(() => canRerunPinned ? () => void navigate(`/chuyen/${tripId}/toi-uu?giu-ghim=${encodeURIComponent(revisionId)}`) : undefined,
    [canRerunPinned, navigate, tripId, revisionId])
  const [inspectorTab, setInspectorTab] = useState<InspectorTab | null>(null)
  const handleCloseInspector = useCallback(() => setInspectorTab(null), [])

  const totalPackages = plan.placements.length + plan.unplaced.length
  const planIssues = useMemo(() => approval.approval ? [...approval.approval.blockers.issues, ...approval.approval.warnings] : [], [approval.approval])

  const editing = editor.mode === 'edit'
  const { setKind } = operations
  /** Từ hộp thoại Duyệt (đã tự đóng): về chế độ Xem và mở mô phỏng dỡ hàng để xem kiện chắn lối (V2.3 Planner3DTatLIFO). */
  const handleShowUnloading = useCallback(() => { if (editing) handleModeChange('view'); setKind('unloading') }, [editing, handleModeChange, setKind])

  const controls = useMemo(() => editing ? undefined : <PlannerSimulationControls {...simulation} />, [editing, simulation])
  const compareRunId = candidate?.runId
  const actions = useMemo(() => <PlannerActions tripId={tripId} access={access} blockedReason={approval.blockedReason} approvedBy={approvedBy}
    compareRunId={compareRunId} onApprove={approveDialog.open} onEdit={editing ? undefined : handleEdit} />,
  [tripId, access, approval.blockedReason, approvedBy, compareRunId, approveDialog.open, editing, handleEdit])
  const debugOverlay = useMemo(() => showPerf ? <DebugOverlay store={perfStore} /> : null, [showPerf, perfStore])
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
        manuallyEdited={!poseEdits && (plan.revision?.manuallyEdited ?? false)}
        candidateLabel={plan.revision?.manuallyEdited ? undefined : candidate?.label}
        controls={controls}
      >
        {actions}
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
            onChangeVehicle={canChangeVehicle ? vehicleDialog.open : undefined} onRerunPinned={handleRerunPinned}
            onResetFocus={handleResetFocus} onFocus={handleFocus} onEdit={handleEdit} spin={spin} /> : null}
          {debugOverlay}
          {editor.mode === 'edit' && state.selected ? <EditorGestureHud placement={state.selected} editor={editor} /> : null}
        </div>

        {editor.mode === 'edit' ? <EditorPanel state={state} editor={editor} /> :
          <SceneInspector state={state} operations={operations} tripId={tripId} colorContext={colorContext} issues={planIssues}
            onEdit={handleEdit} onFocus={editor.focusSelected} onSelect={handleSelect}
            tab={inspectorTab} onTab={setInspectorTab} onClose={handleCloseInspector} />}
      </div>

      {editor.mode === 'view' ? <PlannerTimeline state={state} operations={operations} /> : null}

      <ApprovePlanHost opener={approveDialog} plan={plan} approval={approval} placements={state.placements} poseEdits={poseEdits}
        onShowUnloading={handleShowUnloading} />
      {canChangeVehicle ? <ChangeVehicleHost opener={vehicleDialog} tripId={tripId} /> : null}
    </div>
  )
}
