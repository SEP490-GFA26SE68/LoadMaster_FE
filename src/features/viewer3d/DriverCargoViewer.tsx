import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { useFormat, useT } from '@/lib/i18n'
import type { CameraPreset, PlaybackSpeed } from '@/features/viewer3d/viewer-types'
import { adaptResult, type ScenePlacement, type ViewerSceneModel } from '@/features/viewer3d/scene-input'
import { SceneCanvas } from './scene/SceneCanvas'
import { usePerformanceFlags } from './usePerformanceFlags'
import { deriveSceneSemantics } from './operations/scene-semantics'
import { useUnloadPlayback } from './operations/useUnloadPlayback'
import { BlockerPanel } from './operations/BlockerPanel'
import { placementMeasurements } from './operations/placement-measurements'
import { createPerfStore, DebugOverlay } from './DebugOverlay'
import { benchmarkCountFromSearch, createBenchmarkInput } from './benchmark.mock'
import { debugQualityTier } from './viewer-options'
import { Timeline } from './Timeline'

const PRESETS = [['cua-sau', 'rear'], ['tren', 'top'], ['goc-cheo', 'diagonal'], ['ben-hong', 'side']] as const

/**
 * Khung 3D "Xem vị trí hàng" của tài xế (LM-061): scene cm của revision đã duyệt (LM-030), mô phỏng dỡ theo `unloadingOrder` của
 * kết quả, LIFO từ domain — `LIFO_BLOCKED` dừng mô phỏng và tô kiện chắn. Không có editor, không đánh dấu đã giao.
 * `?debug&packages=N` thay scene bằng fixture benchmark cm.
 *
 * Kiện nhận dọc đường (FE-7-05, D-88) chưa có vị trí 3D (P2) nên không có mesh nào: `pickupCargo` chỉ là một danh sách DOM cạnh khung,
 * "Kiện nhận dọc đường — chưa có vị trí 3D", không thêm draw call.
 */
export function DriverCargoViewer({ model: source, stopNumber, doneIds, pickupCargo = [] }: {
  model: ViewerSceneModel; stopNumber: number; doneIds: ReadonlySet<string>
  /** Kiện nhận dọc đường còn đi cùng xe hoặc sắp lên xe: mã kiện kho kiện, mã của bên gửi, khối lượng. */
  pickupCargo?: readonly { readonly id: string; readonly name: string; readonly weightKg: number }[]
}) {
  const t = useT()
  const format = useFormat()
  const [search] = useSearchParams()
  const count = benchmarkCountFromSearch(search.toString())
  const model = useMemo(() => {
    if (!count) return source
    const input = createBenchmarkInput(count)
    return adaptResult({ trip: input.trip, revision: input })
  }, [count, source])
  const available = useMemo(() => model.placements.filter((p) => p.stop === stopNumber && !doneIds.has(p.id)),
    [model, stopNumber, doneIds])
  const [speed, setSpeed] = useState<PlaybackSpeed>(2)
  const unloadContext = useMemo(() => model.placements.filter((p) => !doneIds.has(p.id)), [model, doneIds])
  const unload = useUnloadPlayback(available, speed, unloadContext)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [preset, setPreset] = useState<CameraPreset>('cua-sau')
  const [focus, setFocus] = useState<{ placement: ScenePlacement; request: number } | null>(null)
  const [inspect, setInspect] = useState(true)
  const flags = usePerformanceFlags(debugQualityTier(search), 'driver')
  const perf = useMemo(() => createPerfStore(), [])
  const removed = useMemo(() => new Set([...doneIds, ...unload.unloadedIds]), [doneIds, unload.unloadedIds])
  const selected = model.placements.find((p) => p.id === selectedId && !removed.has(p.id) && p.stop >= stopNumber) ?? unload.current
  const semantics = useMemo(() => deriveSceneSemantics(model.placements, {
    kind: 'unloading', step: 0, focusStop: stopNumber, unloadedIds: removed, lifo: unload.lifo,
    currentId: unload.current?.id, nextId: unload.next?.id, inspectId: inspect || unload.warning ? unload.current?.id : null,
  }), [model, stopNumber, removed, unload.lifo, unload.current, unload.next, inspect, unload.warning])
  const measurements = selected ? placementMeasurements(selected, model.placements, model.vehicle) : null
  const stop = model.stops.find((s) => s.number === stopNumber)
  const handleFocus = (p: ScenePlacement) => { setSelectedId(p.id); setFocus((f) => ({ placement: p, request: (f?.request ?? 0) + 1 })) }
  return <div className="flex min-h-0 flex-1 flex-col text-body-lg">
    <div className="flex flex-none flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
      <p>{t('driver.cargo.stop', { number: stopNumber, total: model.stops.length, name: stop?.name ?? '' })}</p>
      <select aria-label={t('driver.cargo.view')} value={preset} onChange={(e) => setPreset(e.target.value as CameraPreset)}
        className="h-14 rounded-md border border-border bg-bg px-2 focus-visible:outline-2 focus-visible:outline-primary">
        {PRESETS.map(([value, key]) => <option key={value} value={value}>{t(`driver.cargo.presets.${key}`)}</option>)}
      </select>
    </div>
    <div className="relative min-h-48 flex-1 bg-canvas-1">
      <SceneCanvas experience="driver" model={model} placements={model.placements} flags={flags} preset={preset} focus={focus}
        selectedId={selected?.id ?? null} onSelect={setSelectedId} step={0} semantics={semantics} animateLoading={false}
        decoration={false} onFocus={handleFocus} warningSignal={unload.warning} onPerfSample={search.has('debug') ? perf.publish : undefined}
        unloadMotion={{ cursor: unload.cursor, placement: unload.ordered[unload.cursor - 1], durationMs: 520 / speed }} />
      {search.has('debug') ? <DebugOverlay store={perf} className="top-2 bottom-auto left-2 translate-x-0" /> : null}
    </div>
    <div className="max-h-[30dvh] shrink-0 overflow-y-auto border-t border-border p-3">
      {pickupCargo.length > 0 ? (
        <section aria-label={t('driver.pickup.cargoTitle')} className="mb-2 rounded-md border border-badge-azure-border bg-badge-azure-bg p-3 text-badge-azure-fg">
          <h3 className="m-0 font-semibold">{t('driver.pickup.cargoTitle')}</h3>
          <p className="m-0 mt-0.5">{t('driver.pickup.cargoNote')}</p>
          <ul className="m-0 mt-1 flex list-none flex-col gap-0.5 p-0 font-mono">
            {pickupCargo.map((item) => <li key={item.id}>{t('driver.pickup.cargoRow', { id: item.id, name: item.name, weight: format.weight(item.weightKg) })}</li>)}
          </ul>
        </section>
      ) : null}
      <p className="font-medium">{t(unload.fromResult ? 'viewer.operations.unloadingOrder' : 'viewer.operations.suggestedUnloadingOrder')} · {t('driver.cargo.noDelivery')}</p>
      <p className="mt-1">{unload.current ? t('driver.cargo.current', { id: unload.current.id }) : t('driver.cargo.allViewed')}{unload.next ? ` · ${t('driver.cargo.next', { id: unload.next.id })}` : ''}</p>
      {selected && measurements ? <>
        <div className="my-2 flex flex-wrap gap-2">
          <Button variant="secondary" size="touch" onClick={() => handleFocus(selected)}>{t('driver.cargo.focus')}</Button>
          <Button variant="secondary" size="touch" aria-pressed={inspect} onClick={() => setInspect(!inspect)}>{t(inspect ? 'viewer.operations.blockers.toggleHide' : 'viewer.operations.blockers.toggleShow')}</Button>
        </div>
        <p>{t('driver.cargo.selected', { id: selected.id, stop: selected.stop, orientation: selected.orientation })}</p>
        <p>{t('viewer.measurements.summary', { rear: format.length(measurements.rearCm), left: format.length(measurements.leftCm), layer: measurements.layer })}</p>
        {selected.id !== unload.current?.id && unload.current ? <Button variant="secondary" size="touch" onClick={() => handleFocus(unload.current!)}>{t('driver.cargo.backToCurrent')}</Button> : null}
        {unload.warning ? <p className="text-badge-warning-fg">{t('viewer.operations.blockers.paused')}</p> : null}
        {unload.warning ? <Button variant="secondary" size="touch" onClick={() => unload.setCursor(unload.cursor + 1)}>{t('driver.cargo.skipStep')}</Button> : null}
        {inspect ? <BlockerPanel target={unload.current} lifo={semantics.lifo} onSelect={handleFocus} /> : null}
      </> : null}
    </div>
    <Timeline placements={available} orderedOverride={unload.ordered} suggested={!unload.fromResult} kind="unloading" step={unload.cursor} totalSteps={unload.ordered.length}
      playing={unload.playing} speed={speed} onSpeedChange={setSpeed} onStepChange={unload.setCursor}
      onStepForward={unload.advance} onStepBackward={() => unload.setCursor(unload.cursor - 1)}
      onGoToStart={() => { unload.stop(); unload.setCursor(0) }} onTogglePlaying={unload.toggle} />
  </div>
}
