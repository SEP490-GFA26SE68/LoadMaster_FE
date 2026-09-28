import { Fragment, useEffect, useRef } from 'react'
import { Keyboard } from 'lucide-react'
import type { ScenePlacement } from '@/features/viewer3d/scene-input'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { DARK_SCOPE, GLASS_PANEL, MUTED } from '../panels/scene-ui'
import { formatSnapSource } from './snapping'
import type { ManualEditor } from './useManualEditor'

/** Phím tắt của editor: phím (chữ trên nắp phím) → việc; `lead` đứng trước phím ("thêm Shift: làm lại"). */
const SHORTCUTS = [
  { key: 'arrows', action: 'arrowsAction' }, { key: 'pageKeys', action: 'pageAction' }, { key: 'rotateKey', action: 'rotateAction' },
  { key: 'escKey', action: 'escAction' }, { key: 'undoKey', action: 'undoAction' }, { lead: 'redoLead', key: 'shiftKey', action: 'redoAction' },
] as const

/**
 * HUD góc dưới trái khung 3D khi chỉnh sửa (V2.3 `.ghud`): ô trạng thái mặt phẳng kéo (viền xanh / hổ phách / đỏ), một dòng nói việc
 * đang làm hoặc lỗi, rồi mặt hút và phím tắt. Nội dung đổi theo lúc kéo nên ghi thẳng vào DOM, không render lại scene (mục 7).
 * Phím tắt chỉ hiện từ 1.280 px — màn cảm ứng không có bàn phím.
 */
export function EditorGestureHud({ placement, editor }: { placement: ScenePlacement; editor: ManualEditor }) {
  const t = useT()
  const chip = useRef<HTMLSpanElement>(null), line = useRef<HTMLSpanElement>(null), snap = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    function update() {
      if (!chip.current || !line.current || !snap.current) return
      const preview = editor.preview.getLatest()
      const active = preview?.id === placement.id ? preview : null
      const result = active?.result ?? editor.inspect(placement)
      const tone = !result.valid ? 'bad' : result.advisories.length ? 'warn' : 'ok'
      chip.current.textContent = t('viewer.editor.gesturePlane', { plane: editor.plane.toUpperCase(),
        status: t(tone === 'bad' ? 'viewer.editor.cannotPlace' : tone === 'warn' ? 'viewer.editor.hasNotes' : 'viewer.editor.canPlace') })
      chip.current.dataset.tone = tone
      line.current.textContent = tone === 'bad'
        ? `${result.errors[0] ?? ''}${active?.dragging ? ` ${t('viewer.editor.dropKeeps')}` : ''}`
        : t('viewer.editor.keyboardLead')
      line.current.dataset.tone = tone
      snap.current.textContent = active?.sources.length ? t('viewer.editor.gestureSnap', { sources: active.sources.map((s) => formatSnapSource(s, t)).join(' · ') }) + ' ·' : ''
    }
    update()
    return editor.preview.subscribe(update)
  }, [placement, editor, t])
  return <div className={cn('pointer-events-none absolute bottom-3 left-3 flex max-w-[calc(100%-1.5rem)] items-center gap-3 p-2 xl:max-w-[60%] xl:pr-3', GLASS_PANEL, DARK_SCOPE)}>
    <span ref={chip}
      className="inline-flex min-h-8 flex-none items-center rounded-md border-2 border-green-500 bg-panel-dark/90 px-3 text-body-lg font-semibold text-sky-text data-[tone=bad]:border-red-500 data-[tone=warn]:border-amber-500 xl:text-small" />
    <span className="hidden min-w-0 flex-col gap-1.5 xl:flex">
      <span className="flex items-center gap-2 text-fine">
        <Keyboard className={cn('size-4 flex-none', MUTED)} strokeWidth={1.5} aria-hidden />
        <span ref={line} className="data-[tone=bad]:font-semibold data-[tone=bad]:text-red-200" />
      </span>
      <span className={cn('flex flex-wrap items-center gap-x-1.5 gap-y-1 text-caption', MUTED)}>
        <span ref={snap} className="empty:hidden" />
        {SHORTCUTS.map((item, index) => <Fragment key={item.key}>
          {index > 0 ? <span aria-hidden className="opacity-60">·</span> : null}
          {'lead' in item ? <span>{t(`viewer.editor.shortcuts.${item.lead}`)}</span> : null}
          <kbd className="rounded-xs border border-sky-glass-border bg-sky-glass px-1.5 py-0.5 font-sans text-micro font-semibold text-glass-dark-text">{t(`viewer.editor.shortcuts.${item.key}`)}</kbd>
          <span>{t(`viewer.editor.shortcuts.${item.action}`)}</span>
        </Fragment>)}
      </span>
    </span>
  </div>
}
