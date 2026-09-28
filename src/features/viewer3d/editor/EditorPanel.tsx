import { useState, useSyncExternalStore } from 'react'
import { AlertTriangle, CheckCircle2, Info, RotateCcw, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/Dialog'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { LoadPlanViewerState } from '../useLoadPlanViewer'
import { useObstacleText } from '../overlays/useObstacleText'
import { DARK_SCOPE, DARK_SUBCARD, GlassChip, MUTED, StopMark, type GlassChipTone } from '../panels/scene-ui'
import { EditorControls } from './EditorControls'
import { formatSnapSource } from './snapping'
import type { ManualEditor } from './useManualEditor'

const STATUS = {
  ok: { icon: CheckCircle2, label: 'viewer.editor.canPlace' },
  warn: { icon: AlertTriangle, label: 'viewer.editor.canPlaceWarning' },
  bad: { icon: XCircle, label: 'viewer.editor.cannotPlace' },
} as const

/**
 * Panel chỉnh sửa (V2.3 `.ep`): kiện đang chọn và nhãn xám "Đã chỉnh thủ công" / "Nguyên bản", trạng thái đặt theo quyết định 3
 * (xanh "Có thể đặt" · hổ phách chỉ khi có ràng buộc thật · đỏ "Không thể đặt" kèm vật cản bị chồng), số đo vị trí, chú giải ba
 * trạng thái, rồi các nút chỉnh — tạm khoá trong lúc kéo. Khôi phục mọi chỉnh sửa ở chân panel, có hộp thoại xác nhận.
 */
export function EditorPanel({ state, editor }: { state: LoadPlanViewerState; editor: ManualEditor }) {
  const preview = useSyncExternalStore(editor.preview.subscribe, editor.preview.getSnapshot, editor.preview.getSnapshot)
  const [resetOpen, setResetOpen] = useState(false)
  const t = useT()
  const obstacleText = useObstacleText()
  const format = useFormat()
  const p = state.selected
  const active = preview?.id === p?.id ? preview : null
  const result = active?.result ?? editor.validation
  const position = active?.dragging ? active.position : p?.position
  const dragging = Boolean(active?.dragging)
  const tone: GlassChipTone = !result ? 'ok' : !result.valid ? 'bad' : result.advisories.length ? 'warn' : 'ok'
  const Icon = STATUS[tone === 'bad' ? 'bad' : tone === 'warn' ? 'warn' : 'ok'].icon
  const obstacles = result ? state.sceneModel.vehicle.obstacles.filter((o) => result.obstacleIds.includes(o.id)) : []
  const manual = p ? state.draft.patches.has(p.id) : false
  const stopName = p ? state.sceneModel.stops.find((s) => s.number === p.stop)?.name : undefined
  return <aside aria-label={t('viewer.editor.panelLabel')} className={cn('flex max-h-[45dvh] w-full shrink-0 flex-col overflow-hidden border-t border-glass-dark-border bg-panel-dark text-body-lg xl:max-h-none xl:w-93 xl:border-t-0 xl:border-l xl:text-small', DARK_SCOPE)}>
    {p ? <div className="flex-none border-b border-glass-dark-border px-4 pt-3.5 pb-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-mono font-semibold text-sky-text xl:text-body">{t('common.packageAtStop', { id: p.id, stop: p.stop })}</h2>
        <span className="ml-auto flex gap-1.5">
          {p.pinned ? <GlassChip tone="cyan" size="tag">{t('viewer.editor.pinned')}</GlassChip> : null}
          <GlassChip tone="grey" size="tag">{t(manual ? 'viewer.editor.manual' : 'viewer.editor.original')}</GlassChip>
        </span>
      </div>
      <p className="mt-1.5 flex items-center gap-2 text-glass-dark-text/80"><StopMark stop={p.stop} className="size-4.5 text-micro" />{p.name}{stopName ? ` · ${stopName}` : ''}</p>
    </div> : null}
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
      {p && result ? <>
        <div role="status" aria-live="polite" data-editor-status data-valid={result.valid} data-dragging={dragging}
          data-x={position?.x} data-y={position?.y} data-z={position?.z} data-orientation={p.orientation}
          className={cn('max-h-64 flex-none overflow-y-auto p-3', DARK_SUBCARD, tone === 'bad' && 'border-red-500/50 bg-red-700/15', tone === 'warn' && 'border-amber-500/40')}>
          <div className="flex flex-wrap items-center gap-1.5">
            <GlassChip tone={tone} size="pill"><Icon strokeWidth={1.5} aria-hidden />{t(STATUS[tone === 'bad' ? 'bad' : tone === 'warn' ? 'warn' : 'ok'].label)}</GlassChip>
            {result.valid && result.manual ? <GlassChip tone="grey">{t('viewer.editor.manual')}</GlassChip> : null}
          </div>
          {result.errors[0] ? <p className="mt-2 font-semibold text-red-200 xl:text-lede">{result.errors[0]}</p> : null}
          {obstacles.map((o) => <p key={o.id} className="mt-0.5 text-red-200/85 xl:text-caption">
            {t('viewer.editor.obstacleLine', { type: obstacleText.type(o), id: o.id, range: obstacleRange(o, t, format.lengthValue), bearing: obstacleText.bearing(o) })}
          </p>)}
          {active?.message ? <p className="mt-1.5">{active.message}</p> : null}
          {[...result.errors.slice(1), ...result.advisories].map((reason) => <p key={reason} className={cn('mt-1', result.valid ? 'text-amber-200' : 'text-red-200')}>{reason}</p>)}
          {position ? <PlacementReadout position={position} lengthCm={p.lengthCm} widthCm={p.widthCm} heightCm={p.heightCm} /> : null}
          {active?.sources.length ? <p className={cn('mt-2 xl:text-caption', MUTED)}>{active.sources.map((s) => formatSnapSource(s, t)).join(' · ')}</p> : null}
        </div>
        <StateLegend />
        {dragging ? <p className="flex flex-none items-start gap-2 rounded-lg border border-sky-glass-border bg-sky-glass p-2.5 xl:text-fine">
          <Info className={cn('mt-0.5 size-4 flex-none', MUTED)} strokeWidth={1.5} aria-hidden />{t(result.valid ? 'viewer.editor.draggingValid' : 'viewer.editor.draggingInvalid')}
        </p> : null}
      </> : <p className={MUTED}>{t('viewer.editor.empty')}</p>}
      <fieldset disabled={dragging} className={cn('flex-none transition-opacity duration-(--dur-fast)', dragging && 'opacity-45')}>
        <EditorControls state={state} editor={editor} />
      </fieldset>
      <p className={cn('xl:hidden', MUTED)}>{t('viewer.editor.keyboard')}</p>
      <p className={cn('xl:text-caption', MUTED)}>{t('viewer.editor.disclaimer')}</p>
    </div>
    <div className="flex-none border-t border-glass-dark-border px-4 pt-3 pb-3.5">
      <Button variant="glass" className="h-14 w-full border-red-500/45 bg-red-500/12 text-body-lg text-red-200 hover:bg-red-500/20 xl:h-10 xl:text-body"
        disabled={!state.draft.patches.size || dragging} onClick={() => setResetOpen(true)}>
        <RotateCcw strokeWidth={1.5} />{t('viewer.editor.resetAll')}
      </Button>
    </div>
    <Dialog open={resetOpen} onOpenChange={setResetOpen}>
      <DialogContent>
        <div className="p-6">
          <DialogTitle className="text-h2 font-semibold">{t('viewer.editor.resetTitle')}</DialogTitle>
          <DialogDescription className="mt-2 text-body-lg">{t('viewer.editor.resetDescription')}</DialogDescription>
        </div>
        <DialogFooter>
          <Button variant="secondary" size="touch" onClick={() => setResetOpen(false)}>{t('viewer.editor.keepEdits')}</Button>
          <Button variant="secondary" size="touch" onClick={() => { editor.resetDraft(); setResetOpen(false) }}>{t('viewer.editor.resetConfirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </aside>
}

/** Chú giải ba trạng thái khi dời kiện (V2.3 quyết định 3), để người dùng biết màu nào nghĩa là gì trước khi kéo. */
function StateLegend() {
  const t = useT()
  const rows = [
    { tone: 'ok' as const, label: 'viewer.editor.canPlace' as const, extra: true, note: 'viewer.editor.legend.moved' as const },
    { tone: 'warn' as const, label: 'viewer.editor.canPlaceWarning' as const, extra: false, note: 'viewer.editor.legend.soft' as const },
    { tone: 'bad' as const, label: 'viewer.editor.cannotPlace' as const, extra: false, note: 'viewer.editor.legend.hard' as const },
  ]
  return <section aria-label={t('viewer.editor.legend.title')} className="flex flex-none flex-col gap-1.5 border-t border-dashed border-glass-dark-border pt-2.5">
    <h3 className={cn('text-caption', MUTED)}>{t('viewer.editor.legend.title')}</h3>
    {rows.map((row) => <p key={row.tone} className="flex flex-wrap items-center gap-1.5">
      <GlassChip tone={row.tone} size="tag">{t(row.label)}</GlassChip>
      {row.extra ? <GlassChip tone="grey" size="tag">{t('viewer.editor.manual')}</GlassChip> : null}
      <span className={cn('ml-0.5 text-caption', MUTED)}>{t(row.note)}</span>
    </p>)}
  </section>
}

/** Phạm vi vật cản theo ba trục, cm: "X 420–530 · Y 210–235 · Z 0–32 cm". */
function obstacleRange(o: { xCm: number; yCm: number; zCm: number; lengthCm: number; widthCm: number; heightCm: number }, t: ReturnType<typeof useT>, cm: (value: number) => string) {
  return t('viewer.editor.extentValue', { x0: cm(o.xCm), x1: cm(o.xCm + o.lengthCm), y0: cm(o.yCm), y1: cm(o.yCm + o.widthCm), z0: cm(o.zCm), z1: cm(o.zCm + o.heightCm) })
}

/**
 * Vị trí (góc sát vách trước – vách trái – sàn), kích thước đã theo hướng đặt và phạm vi chiếm chỗ của kiện, cùng đơn vị cm.
 * Khi kéo, vị trí và phạm vi theo proxy; kích thước không đổi vì kéo không xoay kiện.
 */
function PlacementReadout({ position, lengthCm, widthCm, heightCm }: {
  position: { x: number; y: number; z: number }; lengthCm: number; widthCm: number; heightCm: number
}) {
  const format = useFormat()
  const t = useT()
  const cm = format.lengthValue
  return <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 xl:text-fine">
    <dt className={MUTED}>{t('viewer.editor.position')}</dt>
    <dd className="text-right font-mono">{t('viewer.editor.positionValue', { x: cm(position.x), y: cm(position.y), z: cm(position.z) })}</dd>
    <dt className={MUTED}>{t('viewer.editor.size')}</dt>
    <dd className="text-right font-mono">{format.dimensions(lengthCm, widthCm, heightCm)}</dd>
    <dt className={cn('col-span-2', MUTED)}>{t('viewer.editor.extent')}</dt>
    <dd className="col-span-2 font-mono">{t('viewer.editor.extentValue', {
      x0: cm(position.x), x1: cm(position.x + lengthCm),
      y0: cm(position.y), y1: cm(position.y + widthCm),
      z0: cm(position.z), z1: cm(position.z + heightCm),
    })}</dd>
  </dl>
}
