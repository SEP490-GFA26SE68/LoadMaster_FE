import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import type { OptimizationRequest, OptimizationResult } from '@/domain/models'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { createPerfStore, DebugOverlay } from './DebugOverlay'
import { ContextWatch, FirstFrame } from './landing/frame-watch'
import { DARK_SCOPE, MUTED } from './panels/scene-ui'
import { useSamplePlayback, type SamplePlaybackMode } from './sample/useSamplePlayback'
import { adaptResult, type ScenePlacement } from './scene-input'
import { SceneCanvas } from './scene/SceneCanvas'
import { Timeline } from './Timeline'
import { usePerformanceFlags } from './usePerformanceFlags'
import { debugQualityTier } from './viewer-options'
import type { CameraPreset } from './viewer-types'

/** Phím tắt không bắt khi con trỏ ở ô nhập, nút, liên kết, hộp thoại hay danh sách đang mở (Space bấm nút, chọn dòng). */
const KEY_IGNORED = 'input, textarea, select, button, a, [contenteditable="true"], [role="dialog"], [role="listbox"]'

/**
 * Khung 3D của trang công khai `/phuong-an-mau` (`features/marketing/sample-plan` tải lười): cùng `SceneCanvas`, cùng InstancedMesh của
 * kiện với Planner, kho và tài xế — 366 kiện của chuyến mẫu, không mesh riêng cho kiện nào. Xoay, thu phóng, bấm vào kiện được (khác khung
 * mở đầu của trang giới thiệu). `mode` `load`: từng kiện vào thùng theo `loadingOrder`; `unload`: dỡ ở điểm `stop` theo `unloadingOrder`,
 * kiện điểm sau chắn lối có viền cảnh báo, che kín thì dừng kèm nút bỏ qua (như màn tài xế). Thanh `Timeline` phát / dừng / từng bước, phím
 * Space · ← · → · Home trên cả trang. Không MOCK RESULT: trang nói nguồn của số bằng câu riêng.
 */
export default function SamplePlanViewer({ request, result, stopNames, mode, stop, view, autoplay, label, onReady, onFail }: {
  request: OptimizationRequest
  result: OptimizationResult
  stopNames: readonly string[]
  mode: SamplePlaybackMode
  stop: number
  view: CameraPreset
  /** Tự phát mỗi lần đổi phương án, chế độ hay điểm giao; tắt khi người xem chọn giảm chuyển động. */
  autoplay: boolean
  /** Tên truy cập của khung hình (phương án đang xem). */
  label: string
  onReady: () => void
  /** Ngữ cảnh WebGL mất giữa chừng. */
  onFail: () => void
}) {
  const t = useT()
  const format = useFormat()
  const [search] = useSearchParams()
  const flags = usePerformanceFlags(debugQualityTier(search), 'landing')
  const perf = useMemo(() => createPerfStore(), [])
  const model = useMemo(() => adaptResult({
    trip: { id: 'SAMPLE', stops: stopNames.map((name) => ({ name })) },
    revision: { request, result, ordersRecomputed: false },
  }), [request, result, stopNames])
  const playback = useSamplePlayback(model.placements, mode, stop, autoplay)
  const { controls, unload, semantics } = playback
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [focus, setFocus] = useState<{ placement: ScenePlacement; request: number } | null>(null)
  const handleFocus = useCallback((placement: ScenePlacement) => {
    setSelectedId(placement.id)
    setFocus((current) => ({ placement, request: (current?.request ?? 0) + 1 }))
  }, [])

  const { toggle, forward, backward, start } = controls
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target instanceof HTMLElement ? event.target : null
      if (target?.closest(KEY_IGNORED) || event.altKey || event.ctrlKey || event.metaKey) return
      if (event.key === ' ') { event.preventDefault(); toggle() }
      else if (event.key === 'ArrowRight') forward()
      else if (event.key === 'ArrowLeft') backward()
      else if (event.key === 'Home') { event.preventDefault(); start() }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggle, forward, backward, start])

  const stopName = stopNames[stop - 1] ?? ''
  const blockers = semantics.blockers.length
  const unloading = mode === 'unload'
  return (
    <div className={cn('flex h-full min-h-0 flex-col', DARK_SCOPE)}>
      <div role="img" aria-label={label} className="relative min-h-0 flex-1">
        <SceneCanvas experience="landing" model={model} placements={model.placements} flags={flags} preset={view} focus={focus}
          selectedId={selectedId} onSelect={setSelectedId} onFocus={handleFocus} step={unloading ? 0 : controls.step}
          semantics={semantics} animateLoading={!unloading} warningSignal={unload.warning} zones={model.zones} zoneLabels={view === 'tren'}
          onPerfSample={search.has('debug') ? perf.publish : undefined}
          unloadMotion={unloading ? { cursor: unload.cursor, placement: unload.ordered[unload.cursor - 1], durationMs: 520 / playback.speed } : undefined}>
          <FirstFrame onFrame={onReady} />
          <ContextWatch onLost={onFail} />
        </SceneCanvas>
        {search.has('debug') ? <DebugOverlay store={perf} className="top-2 bottom-auto left-2 translate-x-0" /> : null}
      </div>
      <div aria-live="polite" className="flex flex-none flex-wrap items-center gap-x-3 gap-y-1 border-t border-border-dark bg-panel-dark px-3 py-2 text-small pointer-coarse:text-body-lg xl:px-4">
        <span className="font-medium">
          {unloading ? t('samplePlan.player.unloading', { number: stop, name: stopName }) : t('samplePlan.player.loading')}
        </span>
        {unloading && unload.current ? <span className={cn('font-mono', MUTED)}>{t('samplePlan.player.current', { id: unload.current.id })}</span> : null}
        {unloading && blockers > 0 ? <span className="text-amber-200">{t('samplePlan.player.blockers', { count: format.integer(blockers) })}</span> : null}
        {unloading && unload.warning ? (
          <>
            <span className="text-amber-200">{t('samplePlan.player.paused')}</span>
            <button type="button" onClick={() => unload.setCursor(unload.cursor + 1)}
              className="min-h-11 rounded-md px-3 font-semibold text-cyan-300 shadow-[inset_0_0_0_1px_var(--border-dark)] hover:bg-sky-glass focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-cyan-300 pointer-coarse:min-h-14">
              {t('samplePlan.player.skip')}
            </button>
          </>
        ) : null}
      </div>
      <Timeline placements={unloading ? playback.available : model.placements} orderedOverride={unloading ? unload.ordered : undefined}
        suggested={unloading && !unload.fromResult} kind={unloading ? 'unloading' : 'loading'} step={controls.step} totalSteps={controls.totalSteps}
        playing={controls.playing} speed={playback.speed} onSpeedChange={playback.setSpeed} onStepChange={controls.setStep}
        onStepForward={forward} onStepBackward={backward} onGoToStart={start} onTogglePlaying={toggle} />
    </div>
  )
}
