import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'
import type { CameraPreset } from '@/features/viewer3d/viewer-types'
import type { ScenePlacement, ViewerSceneModel } from '@/features/viewer3d/scene-input'
import { deriveSceneSemantics } from './operations/scene-semantics'
import { SceneCanvas } from './scene/SceneCanvas'
import { usePerformanceFlags } from './usePerformanceFlags'
import { CAMERA_PRESETS, debugQualityTier } from './viewer-options'
import { createPerfStore, DebugOverlay } from './DebugOverlay'

/**
 * Warehouse uses the same scene/units/instances as Planner, without editor UI.
 * `model` là scene cm của revision đã duyệt (`adaptResult`, LM-060); bước theo `loadingOrder`.
 * `leftOutIds`: kiện hỏng lúc xếp, bị bỏ lại kho (FE-6-05) — không có trên xe dù đã qua bước của nó, nên vẽ như kiện đã gỡ (ẩn theo ID, không
 * tính trọng tâm), cùng cách khung 3D của tài xế bỏ kiện thiếu; không thêm mesh hay draw call.
 */
export function PositionViewer({ model, current, leftOutIds }: {
  model: ViewerSceneModel
  current: Pick<ScenePlacement, 'id' | 'step' | 'stop'>
  leftOutIds?: ReadonlySet<string>
}) {
  const t = useT()
  const [preset, setPreset] = useState<CameraPreset>('goc-cheo')
  const [isolate, setIsolate] = useState(false)
  const [search] = useSearchParams()
  const flags = usePerformanceFlags(debugQualityTier(search), 'warehouse')
  const perf = useMemo(() => createPerfStore(), [])
  const semantics = useMemo(() => deriveSceneSemantics(model.placements, {
    kind: 'loading', step: current.step, isolateId: isolate ? current.id : null, unloadedIds: leftOutIds,
  }), [model, current.id, current.step, isolate, leftOutIds])
  const next = model.placements.find((p) => p.id === semantics.nextId)
  return <div className="relative h-full min-h-80 overflow-hidden rounded-md bg-canvas-1">
    <SceneCanvas experience="warehouse" model={model} placements={model.placements} flags={flags} preset={preset}
      selectedId={current.id} onSelect={() => {}} step={current.step} semantics={semantics}
      decoration={false} xraySelection onPerfSample={search.has('debug') ? perf.publish : undefined} />
    <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-col gap-1 rounded-md bg-panel-dark p-3 text-body-lg text-bg">
      <span className="font-medium">{t('viewer.position.current', { id: current.id, stop: current.stop })}</span>
      <span>{next ? t('viewer.position.next', { id: next.id, stop: next.stop }) : t('viewer.position.last')}</span>
    </div>
    <div className="pointer-events-none absolute inset-x-2 bottom-2 flex flex-col items-center gap-2">
      <div className="pointer-events-auto flex max-w-full gap-2">
        <Button variant="secondary" className="h-14 px-3 text-body-lg" aria-pressed={isolate} onClick={() => setIsolate(!isolate)}>
          {isolate ? t('viewer.position.showSurroundings') : t('viewer.position.isolate')}
        </Button>
        <select aria-label={t('viewer.position.camera')} value={preset} onChange={(e) => setPreset(e.target.value as CameraPreset)}
          className="h-14 min-w-0 rounded-md border border-border bg-bg px-2 text-body-lg focus-visible:outline-2 focus-visible:outline-primary">
          {CAMERA_PRESETS.filter((p) => p !== 'truoc' && p !== 'gam-xe').map((p) => <option key={p} value={p}>{t(`viewer.camera.${p}`)}</option>)}
        </select>
      </div>
      <span className="text-center text-body-lg text-bg">{t('viewer.position.legend')}</span>
    </div>
    {search.has('debug') ? <DebugOverlay store={perf} className="bottom-28" /> : null}
  </div>
}
