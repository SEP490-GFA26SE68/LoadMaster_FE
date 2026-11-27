import { useSyncExternalStore } from 'react'
import { useFormat, useT } from '@/lib/i18n'
import type { PerfSample } from './scene/PerfProbe'
import { cn } from '@/lib/utils'

/** Debug có subscription riêng để mẫu FPS không render lại trang hoặc Canvas. */
export function createPerfStore() {
  let snapshot: PerfSample | null = null
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    publish: (sample: PerfSample) => {
      snapshot = sample
      listeners.forEach((listener) => listener())
    },
  }
}

export type PerfStore = ReturnType<typeof createPerfStore>

export function DebugOverlay({ store, className }: { store: PerfStore; className?: string }) {
  const sample = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const t = useT()
  const format = useFormat()
  if (!sample) return null

  return (
    <output
      data-viewer-performance
      data-fps={sample.fps ?? ''}
      data-frame-time-ms={sample.frameTimeMs ?? ''}
      data-draw-calls={sample.drawCalls}
      data-triangles={sample.triangles}
      data-shadow-passes={sample.shadowPasses}
      data-placement-count={sample.placementCount}
      data-dpr={sample.dpr}
      data-quality-tier={sample.qualityTier}
      data-rendered-frames={sample.renderedFrames}
      data-idle={sample.idle}
      aria-live="off"
      title={t('viewer.debug.title')}
      className={cn('pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 flex-col gap-1 rounded-sm border border-border-dark bg-panel-dark px-3 py-2 font-mono text-caption whitespace-nowrap text-bg', className)}
    >
      <span>
        {sample.idle ? t('viewer.debug.idle') : sample.fps === null ? t('viewer.debug.sampling') : `${format.integer(sample.fps)} FPS`}
        {' · '}{sample.frameTimeMs === null ? '—' : format.decimal(sample.frameTimeMs)} ms/frame
      </span>
      <span>{t('viewer.debug.draws', { calls: format.integer(sample.drawCalls), triangles: format.integer(sample.triangles) })}</span>
      <span>{t('viewer.debug.scene', { count: format.integer(sample.placementCount), dpr: format.decimal(sample.dpr), tier: sample.qualityTier })}</span>
    </output>
  )
}
