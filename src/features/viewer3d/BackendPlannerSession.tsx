import { SlidersHorizontal, TriangleAlert } from 'lucide-react'
import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/Button'
import { useCan } from '@/features/auth/useCan'
import { PlannerAssistant } from '@/features/marketing/assistant/PlannerAssistant'
import { dataErrorMessage, useT } from '@/lib/i18n'
import type { TripStatus } from '@/types/trip'
import { backendEditApproval, baselineErrorKeys } from './approval/backend-edit-approval'
import type { PlannerLock } from './approval/planner-access'
import { backendPlacementIds, backendPlanScene, planShownOn, unknownStopCodes } from './backend-plan-scene'
import { BackendPlannerActions } from './BackendPlannerActions'
import { createColorContext } from './colors'
import { createPerfStore, DebugOverlay } from './DebugOverlay'
import { useDialogOpener } from './dialog-opener'
import { EditorGestureHud } from './editor/EditorGestureHud'
import { EditorPanel } from './editor/EditorPanel'
import { EditorToolbar } from './editor/EditorToolbar'
import { useManualEditor } from './editor/useManualEditor'
import { SceneHud } from './operations/SceneHud'
import { useOperations } from './operations/useOperations'
import { usePlannerAssistant } from './usePlannerAssistant'
import { PlannerLockNotice } from './PlannerLockNotice'
import { PlannerNoticeBar, PlannerNoticeLink } from './PlannerNoticeBar'
import { ChangeVehicleHost } from './PlannerDialogHosts'
import { PlannerSimulationControls } from './PlannerSimulationControls'
import { SceneInspector } from './panels/SceneInspector'
import { WorkspaceToolbar, type InspectorTab } from './panels/WorkspaceToolbar'
import { PlannerTimeline } from './PlannerTimeline'
import { useApproveBackendEditsMutation, useBackendPlanQuery, useTogglePinMutation } from './useBackendPlanQuery'
import { useLoadPlanViewer } from './useLoadPlanViewer'
import { usePerformanceFlags } from './usePerformanceFlags'
import { usePlannerSessionControls } from './usePlannerSessionControls'
import type { BackendPlanSource } from './viewer-backend-api'
import { ViewerHeader } from './ViewerHeader'
import { debugQualityTier } from './viewer-options'
import { ViewerSkeleton } from './ViewerSkeleton'

const LoadPlanViewer = lazy(() => import('./LoadPlanViewer').then((module) => ({ default: module.LoadPlanViewer })))

/** Trạng thái chuyến của máy chủ → lý do khoá của Planner. Nháp và Đã lập kế hoạch còn lập kế hoạch: không khoá theo pha. */
const STATUS_LOCK: Readonly<Record<TripStatus, PlannerLock | null>> = {
  DRAFT: null, PLANNED: null, LOADING: 'loading', IN_TRANSIT: 'delivering', DELIVERED: 'completed', CANCELLED: 'cancelled',
}
/** Danh sách lỗi rỗng dùng chung: thẻ kiện (memo) không vẽ lại chỉ vì một mảng rỗng mới */
const NO_ISSUES: readonly never[] = []

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
  // Kiện không gắn được điểm giao của chuyến: lỗi dữ liệu của máy chủ — nói rõ thay vì vẽ (màu, vùng, thứ tự dỡ đều theo điểm giao)
  const unknownStops = unknownStopCodes(plan, query.data.stops)
  if (unknownStops.length > 0) {
    return (
      <div className="flex h-dvh flex-col bg-bg p-8">
        <EmptyState mascot="error" title={t('plannerRecovery.unknownStops.title')}
          description={t('plannerRecovery.unknownStops.description', { count: unknownStops.length, codes: unknownStops.slice(0, 5).join(', ') })}
          action={<Button variant="primary" asChild>
            <Link to={`/chuyen/${encodeURIComponent(tripId)}/toi-uu`}>{t('viewer.plan.toSetup')}</Link>
          </Button>}
        />
      </div>
    )
  }
  // Phương án khác là phiên mới (bản chỉnh tay, lịch sử hoàn tác gắn với snapshot — như `LoadedResult` của kho mẫu) nên giữ `key`;
  // đọc lại cùng phương án (đổi xe, ghim) giữ nguyên `plan.id`, khung 3D không dựng lại
  return <BackendPlannerSession key={plan.id} tripCode={tripId} source={{ ...query.data, plan }} />
}

/**
 * Một phiên Planner trên phương án của máy chủ: xem, mô phỏng xếp / dỡ, inspector, timeline và Duyệt (`POST /api/load-plans/{id}/approve`).
 * Chuyến Đã lập kế hoạch: điều phối viên (`plans.approve`) ghim / bỏ ghim kiện đang chọn ngay ở thẻ kiện — ghim lưu thẳng vào phương án
 * ở máy chủ, không qua Duyệt —, chỉnh tay (dời và xoay kiện; hướng xoay được là `allowedRotations` máy chủ trả theo loại kiện) rồi "Duyệt bản
 * chỉnh" (`POST /api/load-plans/{id}/approve-edits`: máy chủ kiểm lại và lưu một bản duyệt mới đánh dấu chỉnh tay), "Chạy lại giữ ghim"
 * (`optimization.run`) và "Đổi xe" (`trips.edit`) ở góc dưới phải khung 3D. Chuyến còn Nháp thì ghim và chạy lại mờ kèm lý do (máy chủ
 * từ chối `TRIP_LOCKED`); pha vận hành khoá cả Planner. Phương án lỗi thời (máy chủ `stale`: đổi xe, đổi kiện của chuyến) có thanh cảnh báo,
 * không chỉnh tay, không Duyệt. Kết quả của máy chủ không mang MOCK RESULT. Quản lý công ty xem chỉ đọc (thiếu `plans.approve`). Phím tắt
 * như Planner của kho mẫu. Nhóm `assistant` nối máy chủ: nút "Trợ lý AI" ở góc dưới phải khung 3D, câu trả lời điều khiển được khung 3D
 * (`usePlannerAssistant`). Như phiên kho mẫu, phần không đổi theo bước phát lại và lần chọn kiện nhận props giữ tham chiếu (`memo`).
 */
function BackendPlannerSession({ tripCode, source }: { tripCode: string; source: BackendPlanSource & { plan: NonNullable<BackendPlanSource['plan']> } }) {
  const [searchParams] = useSearchParams()
  const showPerf = searchParams.has('debug')
  const t = useT()
  const can = useCan()
  const navigate = useNavigate()
  // Query giữ nguyên tham chiếu khi dữ liệu đọc lại không đổi (structural sharing): scene chỉ dựng lại khi máy chủ trả khác đi
  const { plan, planVehicle, stops, vehicleBodyStyle } = source
  // Phương án tính cho xe trước khi đổi xe: máy chủ biết xe đó thì vẽ trong chính xe đó; không biết thì không đặt kiện nào vào thùng xe
  // hiện tại khi chúng không vừa (`planShownOn`)
  const vehicle = planVehicle ?? source.vehicle
  const shown = useMemo(() => (planVehicle ? { plan, otherVehicle: false } : planShownOn(plan, vehicle)), [plan, planVehicle, vehicle])
  const model = useMemo(() => backendPlanScene({ tripCode, plan: shown.plan, vehicle, stops }), [tripCode, shown, vehicle, stops])
  const staleDetail = planVehicle
    ? t('plannerRecovery.planVehicle', { vehicle: planVehicle.name })
    : shown.otherVehicle ? t('plannerRecovery.otherVehicle') : t('viewer.plan.staleApprove')
  const flags = usePerformanceFlags(debugQualityTier(searchParams))
  const state = useLoadPlanViewer(model, { initialSelectedId: model.placements[0]?.id })
  const editor = useManualEditor(state)
  const operations = useOperations(state)
  const { handleModeChange, handleResetFocus, handleFocus, handleSelect, simulation, spin } =
    usePlannerSessionControls(state, operations, editor, { stops: model.stops, reducedMotion: flags.reducedMotion })
  const colorContext = useMemo(() => createColorContext(model), [model])
  const perfStore = useMemo(() => createPerfStore(), [])
  const [inspectorTab, setInspectorTab] = useState<InspectorTab | null>(null)

  const stale = plan.stale
  const phaseLock = STATUS_LOCK[source.status]
  const lock: PlannerLock | null = phaseLock ?? (can('plans.approve') ? null : 'readOnly')
  const approve = lock !== null ? null : source.status === 'DRAFT' ? 'draft' : stale ? 'stale' : 'ready'
  // Ghim và chạy lại chỉ khi chuyến Đã lập kế hoạch (máy chủ: `TRIP_LOCKED`): Nháp thì nút mờ kèm lý do, pha vận hành đã khoá cả Planner
  const pinnable = lock === null && source.status === 'PLANNED'
  const pinBlocked = lock === null && source.status === 'DRAFT' ? t('serverPlans.planner.pinDraftReason') : undefined
  const canRerun = (pinnable || pinBlocked !== undefined) && can('optimization.run')
  // Chạy lại giữ ghim là một lần chạy ba phương án (tính một lần chạy) ở Thiết lập tối ưu, giữ ghim của phương án đang xem
  const keepPinsPath = `/chuyen/${encodeURIComponent(tripCode)}/toi-uu?giu-ghim=${encodeURIComponent(plan.id)}`
  // Chỉnh tay và Duyệt bản chỉnh: chuyến Đã lập kế hoạch, phương án chưa lỗi thời (máy chủ: `PLAN_TRIP_NOT_PLANNED`, `PLAN_STALE`)
  const editable = pinnable && !stale
  const handleEdit = useMemo(() => editable ? () => handleModeChange('edit') : undefined, [editable, handleModeChange])
  const canChangeVehicle = phaseLock === null && source.status === 'PLANNED' && can('trips.edit')
  // State mở của hộp Đổi xe nằm ở chính hộp thoại: mở / đóng không vẽ lại phiên và khung 3D
  const vehicleDialog = useDialogOpener()
  const { mutate: togglePin, isPending: pinPending } = useTogglePinMutation(tripCode, plan.id)
  const { mutate: approveEdits, isPending: editsPending } = useApproveBackendEditsMutation(plan.id)
  const placementIds = useMemo(() => backendPlacementIds(plan), [plan])
  // Lỗi có sẵn của phương án: tính lười, chỉ khi bản chỉnh đã dời / xoay kiện — chế độ Xem không dựng constraint engine nào
  const baseline = useMemo(() => { let keys: ReadonlySet<string> | undefined; return () => (keys ??= baselineErrorKeys(model)) }, [model])
  const editApproval = useMemo(() => editable ? backendEditApproval(model, state.placements, state.draft, placementIds, baseline) : null,
    [editable, model, state.placements, state.draft, placementIds, baseline])
  const pin = useMemo(() => pinnable || pinBlocked !== undefined ? {
    pending: pinPending,
    disabledReason: pinBlocked,
    onToggle: (placement: { id: string; pinned: boolean }) => {
      const placementId = placementIds.get(placement.id)
      if (!pinnable || placementId === undefined || pinPending) return
      togglePin({ placementId, pinned: !placement.pinned }, { onError: (error) => toast.error(dataErrorMessage(error, t)) })
    },
  } : undefined, [pinnable, pinBlocked, pinPending, placementIds, togglePin, t])

  const edits = useMemo(() => editApproval?.hasEdits ? {
    blockedReason: editApproval.errors.length > 0 ? t('serverPlans.planner.editsBlocked', { count: editApproval.errors.length }) : null,
    pending: editsPending,
    onConfirm: (done: () => void) => {
      approveEdits({ edits: editApproval.edits, pinnedPlacementIds: editApproval.pinnedPlacementIds }, {
        onSuccess: (approved) => {
          done()
          toast.success(t('serverPlans.planner.approvedEdits'))
          void navigate(`/chuyen/${encodeURIComponent(tripCode)}/phuong-an?revision=${encodeURIComponent(approved.id)}`, { replace: true })
        },
        onError: (error) => toast.error(dataErrorMessage(error, t)),
      })
    },
  } : undefined, [editApproval, editsPending, approveEdits, t, navigate, tripCode])

  const editing = editor.mode === 'edit'
  usePlannerAssistant({ tripCode, planId: plan.id, state, operations, editing, onOpenPackages: () => setInspectorTab('packages') })
  const poseEdits = (editApproval?.edits.length ?? 0) > 0
  const rerunTo = stale && can('optimization.run') && phaseLock === null ? `/chuyen/${encodeURIComponent(tripCode)}/toi-uu` : undefined
  const handleRerunPinned = useMemo(() => canRerun ? () => void navigate(keepPinsPath) : undefined, [canRerun, navigate, keepPinsPath])
  const handleCloseInspector = useCallback(() => setInspectorTab(null), [])
  // Phần tử truyền làm prop cho phần bọc `memo` (thanh trên, HUD) giữ nguyên qua bước phát lại
  const controls = useMemo(() => editing ? undefined : <PlannerSimulationControls {...simulation} />, [editing, simulation])
  const actions = useMemo(() => <BackendPlannerActions tripCode={tripCode} plan={plan} approve={approve} edits={edits} />, [tripCode, plan, approve, edits])
  const assistant = useMemo(() => <PlannerAssistant />, [])
  const debugOverlay = useMemo(() => showPerf ? <DebugOverlay store={perfStore} /> : null, [showPerf, perfStore])
  const approved = plan.approved
  const notices = useMemo(() => (
    <div className="flex flex-none flex-col items-start gap-2 px-2 pt-2 empty:hidden xl:px-3.5 xl:pt-2.5">
      <PlannerLockNotice lock={lock} />
      {stale ? (
        <PlannerNoticeBar role="alert" data-planner-stale tone="warning" icon={TriangleAlert} title={t('viewer.plan.staleBanner')}
          detail={staleDetail}
          action={rerunTo ? <PlannerNoticeLink tone="warning" to={rerunTo} icon={SlidersHorizontal}>{t('viewer.plan.rerun')}</PlannerNoticeLink> : null} />
      ) : null}
      {approve === 'draft' && !approved ? (
        <PlannerNoticeBar role="status" tone="warning" icon={TriangleAlert} title={t('serverPlans.planner.draftReason')} />
      ) : null}
    </div>
  ), [lock, stale, staleDetail, rerunTo, approve, approved, t])
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas-1">
      <ViewerHeader tripId={tripCode} title={source.tripName} revisionId={model.revision?.id ?? null} stale={stale} metrics={model.metrics}
        placedCount={model.placements.length} totalCount={model.placements.length + model.unplaced.length} isMockResult={false}
        manuallyEdited={!poseEdits && plan.manuallyEdited} candidateLabel={plan.manuallyEdited ? undefined : plan.label ?? undefined}
        controls={controls}>
        {actions}
      </ViewerHeader>
      {notices}
      {editing ? <EditorToolbar state={state} editor={editor} onModeChange={handleModeChange} /> : <WorkspaceToolbar {...simulation} onEdit={handleEdit} />}
      <div className={`relative flex min-h-0 flex-1 ${editing ? 'flex-col xl:flex-row' : ''}`}>
        <div className="relative min-h-48 min-w-0 flex-1 overflow-hidden bg-canvas-1">
          <Suspense fallback={<ViewerSkeleton packageCount={model.placements.length} stopCount={model.stops.length} />}>
            <LoadPlanViewer state={state} flags={flags} editor={editor} operations={operations} onPerfSample={showPerf ? perfStore.publish : undefined}
              vehicleBodyStyle={vehicleBodyStyle} />
          </Suspense>
          {editing ? null : <SceneHud state={state} operations={operations} onInspect={setInspectorTab}
            onChangeVehicle={canChangeVehicle ? vehicleDialog.open : undefined}
            onRerunPinned={handleRerunPinned} rerunBlockedReason={pinBlocked}
            onResetFocus={handleResetFocus} onFocus={handleFocus} onEdit={handleEdit} spin={spin} assistant={assistant} vehicleBodyStyle={vehicleBodyStyle} />}
          {debugOverlay}
          {editing && state.selected ? <EditorGestureHud placement={state.selected} editor={editor} /> : null}
        </div>
        {editing ? <EditorPanel state={state} editor={editor} /> : (
          <SceneInspector state={state} operations={operations} tripId={tripCode} colorContext={colorContext} issues={editApproval?.errors ?? NO_ISSUES} pin={pin}
            onEdit={handleEdit} onFocus={editor.focusSelected} onSelect={handleSelect}
            tab={inspectorTab} onTab={setInspectorTab} onClose={handleCloseInspector} listSection={state.leftTab} vehicleBodyStyle={vehicleBodyStyle} />
        )}
      </div>
      {editing ? null : <PlannerTimeline state={state} operations={operations} />}
      {canChangeVehicle ? <ChangeVehicleHost opener={vehicleDialog} tripId={tripCode} /> : null}
    </div>
  )
}
