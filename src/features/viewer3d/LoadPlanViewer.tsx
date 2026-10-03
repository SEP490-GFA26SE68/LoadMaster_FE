import type { LoadPlanViewerState } from './useLoadPlanViewer'
import type { PerformanceFlags } from './usePerformanceFlags'
import type { PerfSample } from './scene/PerfProbe'
import type { ManualEditor } from './editor/useManualEditor'
import type { OperationsState } from './operations/useOperations'
import { SceneCanvas } from './scene/SceneCanvas'
import { EditorProxy } from './editor/EditorProxy'
import { EditorFloorGrid } from './editor/EditorGuides'

/** Planner composes the shared renderer with its one edit proxy. */
export function LoadPlanViewer({ state, flags, editor, operations, onPerfSample }: {
  state: LoadPlanViewerState; flags: PerformanceFlags; editor: ManualEditor; operations: OperationsState
  onPerfSample?: (sample: PerfSample) => void
}) {
  const editing = editor.mode === 'edit'
  return <SceneCanvas experience="planner" model={state.sceneModel} placements={state.placements} flags={flags}
    preset={state.cameraPreset} focus={editor.focus} selectedId={state.selectedId} onSelect={state.select}
    onUserControl={operations.pauseFollow} onFocus={(p) => { operations.pauseFollow(); editor.focusPlacement(p) }}
    warningSignal={operations.unload.warning}
    colorMode={state.colorMode} sliceCm={editing ? state.sceneModel.vehicle.innerLengthCm : state.sliceCm}
    step={editing ? state.totalSteps : state.step} semantics={editing ? undefined : operations.semantics}
    hiddenId={editing ? state.selectedId : null} obstaclePicking={!editing} animateLoading={!editing && operations.kind === 'loading' && operations.focusStop === null}
    showMass={operations.showMass} zones={operations.showZones ? state.sceneModel.zones : undefined} onPerfSample={onPerfSample}
    unloadMotion={!editing && operations.kind === 'unloading' ? { cursor: operations.unload.cursor,
      placement: operations.unload.ordered[operations.unload.cursor - 1], durationMs: 520 / state.speed } : undefined}>
    {editing ? <EditorFloorGrid vehicle={state.sceneModel.vehicle} /> : null}
    {editing && state.selected ? <EditorProxy key={`${state.selected.id}:${editor.plane}`} placement={state.selected} state={state} editor={editor} /> : null}
  </SceneCanvas>
}
