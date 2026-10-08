import { ChevronLeft, ChevronRight, Pause, Play, SkipBack } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Button } from '@/components/ui/Button'
import { useFormat, useT } from '@/lib/i18n'
import { stopColor } from '@/lib/stops'
import { cn } from '@/lib/utils'
import type { ScenePlacement } from '@/features/viewer3d/scene-input'
import type { PlaybackSpeed } from '@/features/viewer3d/viewer-types'
import { timelineBins } from './operations/operations-model'
import { DARK_FIELD, DARK_SCOPE, GLASS_PRESSED, GlassValue, MUTED } from './panels/scene-ui'

export type TimelineProps = {
  placements: readonly ScenePlacement[]; step: number; totalSteps: number; playing: boolean; speed: PlaybackSpeed
  onStepChange: (step: number) => void; onStepForward: () => void; onStepBackward: () => void
  onGoToStart: () => void; onTogglePlaying: () => void; onSpeedChange: (speed: PlaybackSpeed) => void
  kind?: 'loading' | 'unloading'; orderedOverride?: readonly ScenePlacement[]
  /** Thứ tự dỡ do FE suy ra (phương án cũ không có `unloadingOrder`): nhãn ghi "gợi ý" */
  suggested?: boolean
  /** Điều khiển nền đặc, không blur, nút Phát cyan đặc (màn tài xế, V2.3 đợt 6 — kính chưa đo trên điện thoại thật); mặc định là nút kính. */
  solid?: boolean
}

/** Nút điều khiển vuông kính (`.ib`): 56 px cảm ứng, 40 px từ `xl`. */
const CONTROL = cn('size-14 p-0 xl:size-10 [&_svg]:size-5', GLASS_PRESSED)

/**
 * Thanh phát lại bước xếp/dỡ trên nền tối của khung 3D (V2.3 `.tl`). Ô đều nhau, mật độ theo bề rộng thanh chứ không theo số
 * kiện (8–64 ô); ô hiện tại viền trắng có quầng. Lệch có chủ ý so với bản mẫu: ô giữ cùng chiều cao (mục 7) thay vì ô hiện tại
 * cao gấp đôi; nút Phát là nút kính bật cyan, không phải nút chính tròn — màn chỉ có một nút chính (Duyệt).
 */
export function Timeline({ placements, step, totalSteps, playing, speed, onStepChange, onStepForward,
  onStepBackward, onGoToStart, onTogglePlaying, onSpeedChange, kind = 'loading', orderedOverride, suggested = false, solid = false }: TimelineProps) {
  const t = useT()
  const variant = solid ? 'skySolid' : 'glass'
  const format = useFormat()
  const rail = useRef<HTMLDivElement>(null)
  const [budget, setBudget] = useState(32)
  useEffect(() => {
    if (!rail.current) return
    const observer = new ResizeObserver(([entry]) => setBudget(Math.max(8, Math.min(64, Math.floor((entry?.contentRect.width ?? 400) / 18)))))
    observer.observe(rail.current); return () => observer.disconnect()
  }, [])
  const ordered = useMemo(() => orderedOverride ?? [...placements].sort((a, b) => a.step - b.step), [placements, orderedOverride])
  const bins = useMemo(() => timelineBins(ordered, budget), [ordered, budget])
  const progress = kind === 'unloading' ? step : ordered.filter((p) => p.step <= step).length
  const currentIndex = kind === 'unloading' ? progress : progress - 1
  const minimum = kind === 'loading' && totalSteps ? 1 : 0
  const percent = totalSteps ? Math.round(step / totalSteps * 100) : 0
  const label = kind === 'loading' ? t('viewer.timeline.loadingStep') : t(suggested ? 'viewer.operations.suggestedUnloaded' : 'viewer.operations.unloaded')
  const current = ordered[currentIndex], next = ordered[currentIndex + 1]
  return <div className={cn('flex flex-none flex-wrap items-center gap-x-4 gap-y-1 border-t border-glass-dark-border bg-panel-dark px-3 py-2 text-body-lg sm:flex-nowrap xl:px-4 xl:py-3 xl:text-body', DARK_SCOPE)} data-operation-timeline>
    <div className="flex shrink-0 items-center gap-1.5">
      <Button variant={variant} className={CONTROL} aria-label={t('viewer.timeline.start')} onClick={onGoToStart} disabled={!totalSteps}><SkipBack strokeWidth={1.5} /></Button>
      <Button variant={variant} className={CONTROL} aria-label={t('viewer.timeline.back')} onClick={onStepBackward} disabled={step <= minimum}><ChevronLeft strokeWidth={1.5} /></Button>
      <Button variant={variant} className={cn(CONTROL, 'xl:size-11', solid && 'border-cyan-300 bg-cyan-300 text-cyan-950 hover:bg-cyan-200 aria-pressed:bg-cyan-200 aria-pressed:text-cyan-950 aria-pressed:ring-0')} aria-label={playing ? t('viewer.timeline.pause') : t('viewer.timeline.play')} aria-pressed={playing} onClick={onTogglePlaying} disabled={!totalSteps}>
        {playing ? <Pause strokeWidth={1.5} /> : <Play strokeWidth={1.5} />}
      </Button>
      <Button variant={variant} className={CONTROL} aria-label={t('viewer.timeline.forward')} onClick={onStepForward} disabled={step >= totalSteps}><ChevronRight strokeWidth={1.5} /></Button>
    </div>
    <div className="ml-auto shrink-0 sm:ml-0 sm:w-28">
      <span className={cn('block text-body xl:text-caption', MUTED)}>{label}</span>
      <GlassValue className="text-h3 xl:text-h2" value={format.integer(step)} unit={`/ ${format.integer(totalSteps)}`} />
    </div>
    <div className="order-last min-w-0 basis-full sm:order-none sm:flex-1 sm:basis-auto">
      <div className={cn('mb-1.5 hidden justify-between gap-4 text-caption lg:flex', MUTED)}>
        <span>{current ? <>{t('viewer.timeline.current', { stop: current.stop })} · <span className="font-mono text-cyan-200">{current.id}</span></> : t('viewer.timeline.done')}</span>
        <span>{next ? t('viewer.timeline.next', { stop: next.stop }) : ''}</span>
      </div>
      <div ref={rail} aria-hidden className="relative flex h-6 items-center gap-0.5" data-timeline-bins={bins.length}>
        {bins.map((bin, i) => {
          const dominant = [...bin.stops].sort((a, b) => b.ratio - a.ratio)[0]!
          const active = currentIndex >= bin.start && currentIndex < bin.end
          const boundary = i > 0 && bins[i - 1]!.stops.at(-1)?.stop !== bin.stops[0]?.stop
          return <span key={bin.start} data-sequence-cell data-current={active} title={bin.stops.map((s) => t('common.stop', { number: s.stop })).join(' / ')}
            className={cn('relative h-5 min-w-0 flex-1 rounded-[3px]', active && 'ring-2 ring-sky-text shadow-[0_0_14px_rgba(255,255,255,.6)]')}
            style={{ background: stopColor(dominant.stop), opacity: active || bin.end <= progress ? 0.95 : 0.38, marginLeft: boundary ? 3 : 0 }}>
            {bin.stops.length > 1 ? <span className="absolute inset-x-0.5 bottom-0.5 h-0.5 rounded-xs bg-canvas-1/70" /> : null}
          </span>
        })}
      </div>
      <input type="range" className="lm-range mt-1 min-h-8 xl:min-h-4 xl:h-4" min={minimum} max={totalSteps || minimum} step={1} value={step}
        disabled={!totalSteps} onChange={(e) => onStepChange(Number(e.target.value))} aria-label={label}
        aria-valuetext={t('viewer.timeline.valueText', { label, step, total: totalSteps })}
        style={{ '--lm-range-fill': `${percent}%`, '--border': 'var(--border-dark)' } as CSSProperties} />
    </div>
    <label className="hidden shrink-0 sm:flex">
      <span className="sr-only">{t('viewer.timeline.speed')}</span>
      <select aria-label={t('viewer.timeline.speedLabel')} value={speed} onChange={(e) => onSpeedChange(Number(e.target.value) as PlaybackSpeed)}
        className={cn(DARK_FIELD, 'font-display font-semibold tabular-nums')}>
        <option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option>
      </select>
    </label>
  </div>
}
