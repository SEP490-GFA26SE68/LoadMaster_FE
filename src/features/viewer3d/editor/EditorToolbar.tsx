import { useSyncExternalStore } from 'react'
import { Eye, Layers, Pencil, Redo2, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { LoadPlanViewerState } from '../useLoadPlanViewer'
import type { ManualEditor } from './useManualEditor'
import { CameraSelect } from '../panels/PlannerSelect'
import { DARK_FIELD, DARK_SCOPE, GlassSegmented, MUTED } from '../panels/scene-ui'

const DIVIDER = 'hidden h-7 w-px flex-none bg-glass-dark-border sm:block'

/**
 * Thanh công cụ chế độ Chỉnh sửa (V2.3 `.etb`): Xem / Chỉnh sửa, Hoàn tác / Làm lại, góc nhìn và ô chọn kiện, trên nền tối nối
 * liền khung 3D. Trong lúc kéo kiện, hoàn tác, làm lại và chọn kiện tạm khoá.
 */
export function EditorToolbar({ state, editor, onModeChange = editor.setMode }: {
  state: LoadPlanViewerState; editor: ManualEditor; onModeChange?: ManualEditor['setMode']
}) {
  const t = useT()
  const preview = useSyncExternalStore(editor.preview.subscribe, editor.preview.getSnapshot, editor.preview.getSnapshot)
  const dragging = Boolean(preview?.dragging)
  const history = 'h-14 px-3 text-body-lg xl:h-10 xl:text-body'
  return (
    <div className={cn('flex flex-none flex-wrap items-center gap-2 border-b border-glass-dark-border bg-panel-dark px-2 py-1.5 sm:flex-nowrap xl:gap-2.5 xl:px-3', DARK_SCOPE)}
      aria-label={t('viewer.editor.modeLabel')}>
      <GlassSegmented ariaLabel={t('viewer.editor.modeGroup')} value={editor.mode} onChange={onModeChange} itemClassName="px-3 xl:min-h-8.5"
        options={[
          { value: 'view', label: <><Eye className="size-4" strokeWidth={1.5} aria-hidden />{t('viewer.editor.view')}</> },
          { value: 'edit', label: <><Pencil className="size-4" strokeWidth={1.5} aria-hidden />{t('viewer.editor.edit')}</> },
        ]} />
      {editor.mode === 'edit' ? <>
        <span aria-hidden className={DIVIDER} />
        <Button variant="glass" aria-label={t('viewer.editor.undo')} disabled={!state.canUndo || dragging} onClick={editor.undo} className={history}>
          <Undo2 strokeWidth={1.5} /><span className="hidden lg:inline">{t('viewer.editor.undo')}</span>
        </Button>
        <Button variant="glass" aria-label={t('viewer.editor.redo')} disabled={!state.canRedo || dragging} onClick={editor.redo} className={history}>
          <Redo2 strokeWidth={1.5} /><span className="hidden lg:inline">{t('viewer.editor.redo')}</span>
        </Button>
      </> : null}
      <span aria-hidden className={DIVIDER} />
      <CameraSelect tone="glass" icon={Layers} label={t('viewer.editor.camera')} preset={state.cameraPreset} onPreset={state.setCameraPreset} className="xl:h-10 2xl:w-36" />
      {/* Chọn kiện giữ `<select>` gốc: tới 1.000 dòng, Radix Select dựng hết mọi dòng khi mở (LM-094) */}
      <label className="ml-auto flex min-w-0 basis-full items-center gap-2.5 text-body-lg sm:basis-auto xl:text-small">
        <span className={cn('shrink-0 sm:hidden xl:inline', MUTED)}>{t('viewer.editor.selectPackage')}</span>
        <select aria-label={t('viewer.editor.selectPackage')} value={state.selectedId ?? ''} disabled={dragging}
          onChange={(e) => { editor.preview.publish(null, true); state.select(e.target.value || null) }}
          className={cn(DARK_FIELD, 'flex-1 font-mono text-sky-text xl:h-10 xl:min-w-60')}>
          <option value="">{t('viewer.editor.selectPackage')}</option>
          {state.placements.map((p) => <option key={p.id} value={p.id}>{t('common.packageAtStop', { id: p.id, stop: p.stop })}</option>)}
        </select>
      </label>
    </div>
  )
}
