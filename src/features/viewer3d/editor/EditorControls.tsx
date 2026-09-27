import { Focus, Magnet, Pin, PinOff, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { effectiveOrientations, ORIENTATION_CODES } from '@/domain/geometry'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { LoadPlanViewerState } from '../useLoadPlanViewer'
import { DARK_FIELD, GLASS_PRESSED, GlassSegmented, MUTED } from '../panels/scene-ui'
import { AXES, EDITOR_NUDGE_STEPS_CM } from './geometry'
import type { DragPlane, ManualEditor } from './useManualEditor'

/** Nút kính của panel: 56 px cảm ứng, 36 px từ `xl`. */
const CONTROL = cn('h-14 px-2 text-body-lg xl:h-9 xl:text-small', GLASS_PRESSED)
const PLANES: readonly DragPlane[] = ['xy', 'xz', 'yz']
const BLOCK_TITLE = 'font-semibold text-glass-dark-text xl:text-small'

/**
 * Nút chỉnh kiện đang chọn (V2.3 `.ep-b`): tập trung, ghim, dịch chuyển theo trục đúng bước cm, hướng xoay (đủ sáu mã, mã không được
 * phép mờ đi), mặt phẳng kéo + hút, khôi phục kiện này. Dưới 1.280 px lưới dịch chuyển hai cột và hướng xoay ba cột để giữ 56 px.
 */
export function EditorControls({ state, editor }: { state: LoadPlanViewerState; editor: ManualEditor }) {
  const t = useT()
  const format = useFormat()
  const p = state.selected
  if (!p) return null
  const rules = state.sceneModel.orientationRulesById.get(p.id) ?? { allowedOrientations: [p.orientation], keepUpright: false }
  const allowed = effectiveOrientations(rules)
  return <div className="flex flex-col gap-4 text-body-lg xl:text-small">
    <div className="flex gap-2">
      <Button variant="glass" className={cn(CONTROL, 'flex-1')} onClick={editor.focusSelected}><Focus strokeWidth={1.5} />{t('viewer.editor.focus')}</Button>
      <Button variant="glass" className={CONTROL} onClick={editor.togglePin}>
        {p.pinned ? <PinOff strokeWidth={1.5} /> : <Pin strokeWidth={1.5} />}{p.pinned ? t('viewer.editor.unpin') : t('viewer.editor.pin')}
      </Button>
    </div>
    {p.pinned ? <p className="text-cyan-100">{t('viewer.editor.pinnedHint')}</p> : null}
    <fieldset disabled={p.pinned} className="flex min-w-0 flex-col gap-4 disabled:cursor-not-allowed disabled:opacity-60">
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className={BLOCK_TITLE}>{t('viewer.editor.nudgeTitle')}</span>
          <GlassSegmented ariaLabel={t('viewer.editor.nudgeStep')} value={editor.nudgeCm} onChange={editor.setNudgeCm} itemClassName="xl:min-h-6.5 xl:px-2.5 font-display tabular-nums"
            options={EDITOR_NUDGE_STEPS_CM.map((cm) => ({ value: cm, label: format.length(cm) }))} />
        </div>
        <div className="grid grid-cols-2 gap-1.5 xl:grid-cols-6" role="group" aria-label={t('viewer.editor.nudgeGroup')}>
          {AXES.flatMap((axis) => [-1, 1].map((direction) => (
            <Button key={`${axis}${direction}`} variant="glass" className={cn(CONTROL, 'px-0 font-display')} onClick={() => editor.nudge(axis, direction)}
              aria-label={t(direction < 0 ? 'viewer.editor.decrease' : 'viewer.editor.increase', { axis: axis.toUpperCase() })}>
              {axis.toUpperCase()} {direction < 0 ? '−' : '+'}
            </Button>
          )))}
        </div>
        <p className={cn('mt-2 xl:text-caption', MUTED)}>{t('viewer.editor.axesHint')}</p>
      </div>
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
          <span className={BLOCK_TITLE}>{t('viewer.editor.rotation')}</span>
          <span className={cn('text-caption xl:text-micro', MUTED)}>
            {t('viewer.orientation.allowed', { codes: format.list(allowed) })}{rules.keepUpright ? ` · ${t('viewer.orientation.keepUpright')}` : ''}
          </span>
        </div>
        <div role="group" aria-label={t('viewer.editor.rotation')} className="grid grid-cols-3 gap-1.5 xl:grid-cols-6">
          {ORIENTATION_CODES.map((orientation) => <Button key={orientation} variant="glass" className={cn(CONTROL, 'px-0 font-mono')}
            aria-pressed={p.orientation === orientation} disabled={!allowed.includes(orientation)} onClick={() => editor.rotate(orientation)}>
            {orientation}
          </Button>)}
        </div>
      </div>
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="editor-plane" className={BLOCK_TITLE}>{t('viewer.editor.plane')}</label>
          <Button variant="skyGhost" className={cn(CONTROL, 'px-1.5')} aria-pressed={editor.snapping} onClick={() => editor.setSnapping(!editor.snapping)}>
            <span aria-hidden className={cn('relative h-5 w-9 flex-none rounded-full transition-colors duration-(--dur-fast)', editor.snapping ? 'bg-cyan-500' : 'bg-switch-off')}>
              <span className={cn('absolute top-0.5 size-4 rounded-full bg-sky-text shadow-e1 transition-[left] duration-(--dur-fast)', editor.snapping ? 'left-4.5' : 'left-0.5')} />
            </span>
            {t('viewer.editor.snapping', { state: t(editor.snapping ? 'common.on' : 'common.off') })}
          </Button>
        </div>
        <div className="flex gap-2">
          <select id="editor-plane" value={editor.plane} onChange={(e) => editor.setPlane(e.target.value as DragPlane)} className={cn(DARK_FIELD, 'flex-1')}>
            {PLANES.map((plane) => <option key={plane} value={plane}>{t(`viewer.editor.planes.${plane}`)}</option>)}
          </select>
          <Button variant="glass" className={CONTROL} onClick={editor.snap}><Magnet strokeWidth={1.5} />{t('viewer.editor.snap')}</Button>
        </div>
      </div>
    </fieldset>
    <Button variant="skyGhost" className={cn(CONTROL, 'self-start px-1 text-cyan-100')} disabled={!state.draft.patches.has(p.id)} onClick={editor.resetPlacement}>
      <RotateCcw strokeWidth={1.5} />{t('viewer.editor.resetOne')}
    </Button>
  </div>
}
