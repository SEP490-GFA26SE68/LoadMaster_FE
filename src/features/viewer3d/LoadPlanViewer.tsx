import { startTransition, useCallback } from 'react'
import type { VehicleBodyStyle } from '@/types/vehicle-body-style'
import type { ScenePlacement } from './scene-input'
import type { LoadPlanViewerState } from './useLoadPlanViewer'
import type { PerformanceFlags } from './usePerformanceFlags'
import type { PerfSample } from './scene/PerfProbe'
import type { ManualEditor } from './editor/useManualEditor'
import type { OperationsState } from './operations/useOperations'
import { SceneCanvas } from './scene/SceneCanvas'
import { EditorProxy } from './editor/EditorProxy'
import { EditorFloorGrid } from './editor/EditorGuides'

/** Hình một kiện rời thùng khi dỡ: cố định trong khoảng 400–700 ms của mục 8, không theo hệ số thời gian thật. */
const UNLOAD_MOTION_MS = 520

/** Planner composes the shared renderer with its one edit proxy. */
export function LoadPlanViewer({ state, flags, editor, operations, onPerfSample, vehicleBodyStyle }: {
  state: LoadPlanViewerState; flags: PerformanceFlags; editor: ManualEditor; operations: OperationsState
  onPerfSample?: (sample: PerfSample) => void
  /** Kiểu thân của loại đang gắn với xe; vắng thì khung 3D tự chọn dáng theo kích thước. */
  vehicleBodyStyle?: VehicleBodyStyle
}) {
  const editing = editor.mode === 'edit'
  const { pauseFollow } = operations
  const { focusPlacement } = editor
  const handleFocus = useCallback((p: ScenePlacement) => { pauseFollow(); focusPlacement(p) }, [pauseFollow, focusPlacement])
  // Chế độ Xem: bấm chọn kiện trên khung vẽ lại trong một transition, để lượt bấm (dò tia) không gánh cả phần vẽ thẻ kiện và cảnh.
  // Chế độ Chỉnh sửa giữ chọn ngay: tay kéo và proxy của kiện mới chọn phải có trước cú kéo kế tiếp
  const { select } = state
  const handleSelect = useCallback((id: string | null) => startTransition(() => select(id)), [select])
  return <SceneCanvas experience="planner" model={state.sceneModel} placements={state.placements} flags={flags}
    preset={state.cameraPreset} focus={editor.focus} selectedId={state.selectedId} onSelect={editing ? select : handleSelect}
    onUserControl={pauseFollow} onFocus={handleFocus} spinning={state.spinning && !editing} onSpinEnd={state.stopSpin}
    warningSignal={operations.unload.warning}
    colorMode={state.colorMode} sliceCm={editing ? state.sceneModel.vehicle.innerLengthCm : state.sliceCm}
    step={editing ? state.totalSteps : state.step} semantics={editing ? undefined : operations.semantics}
    hiddenId={editing ? state.selectedId : null} obstaclePicking={!editing} animateLoading={!editing && operations.kind === 'loading' && operations.focusStop === null} entryMotion
    centerOfGravity={operations.showMass ? editing ? state.placements : operations.cargo.placements : undefined}
    zones={operations.showZones ? state.sceneModel.zones : undefined} onPerfSample={onPerfSample} vehicleBodyStyle={vehicleBodyStyle}
    unloadMotion={!editing && operations.kind === 'unloading' ? { cursor: operations.unload.cursor,
      placement: operations.unload.ordered[operations.unload.cursor - 1], durationMs: UNLOAD_MOTION_MS } : undefined}>
    {editing ? <EditorFloorGrid vehicle={state.sceneModel.vehicle} /> : null}
    {editing && state.selected ? <EditorProxy key={`${state.selected.id}:${editor.plane}`} placement={state.selected} state={state} editor={editor} /> : null}
  </SceneCanvas>
}
