import { useMemo } from 'react'
import { AlertTriangle, Focus, Maximize, Pencil, Settings2, SkipForward, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { LoadPlanViewerState } from '../useLoadPlanViewer'
import type { OperationsState } from './useOperations'
import { MassCard } from './OperationsPanel'
import type { InspectorTab } from '../panels/WorkspaceToolbar'
import { DARK_SCOPE, GLASS_PANEL, GLASS_PRESSED, MUTED, StopMark } from '../panels/scene-ui'
import type { ScenePlacement } from '@/features/viewer3d/scene-input'

const HUD_BUTTON = cn('pointer-events-auto h-14 px-3 text-body-lg xl:h-8 xl:px-2.5 xl:text-small', GLASS_PRESSED)

/**
 * Bối cảnh ở mép khung 3D (V2.3 `.legend`): điểm giao theo thứ tự dỡ với số kiện, bước đang mô phỏng, theo bước / xem toàn xe /
 * quay lại kiện cần dỡ và lối dỡ bị che kín. Thông tin không gian nằm trên chính kiện (nhãn neo). Thẻ kiện đang chọn và panel
 * dỡ hàng nổi bên phải nằm ở `SceneInspector` (cần lỗi ràng buộc của phương án). Dưới 1.280 px bỏ danh sách điểm giao và dùng
 * thanh kiện gọn ở góc dưới trái.
 */
export function SceneHud({ state, operations, onInspect, onFocus, onEdit, onResetFocus }: {
  state: LoadPlanViewerState; operations: OperationsState; onInspect: (tab: InspectorTab) => void
  onFocus: (p?: ScenePlacement) => void; onEdit?: () => void; onResetFocus?: () => void
}) {
  const p = operations.current, stopNumber = operations.focusStop ?? p?.stop
  const stops = state.sceneModel.stops
  const stop = stops.find((s) => s.number === stopNumber)
  const counts = useMemo(() => {
    const byStop = new Map<number, number>()
    for (const placement of state.placements) byStop.set(placement.stop, (byStop.get(placement.stop) ?? 0) + 1)
    return byStop
  }, [state.placements])
  const count = stopNumber === undefined ? 0 : counts.get(stopNumber) ?? 0
  const format = useFormat()
  const t = useT()
  const unloading = operations.kind === 'unloading'
  const kind = t(!unloading ? 'viewer.operations.loading' : operations.unload.fromResult ? 'viewer.operations.unloading' : 'viewer.operations.suggestedUnloading')
  return <div className={cn('pointer-events-none absolute inset-0 flex flex-col justify-between p-3', DARK_SCOPE)}>
    <div className="flex items-start justify-between gap-3">
      <section aria-label={t('viewer.hud.stopsTitle')}
        className={cn('min-w-0 max-w-80 p-3 text-body-lg xl:w-74 xl:p-3.5 xl:text-body', GLASS_PANEL)}>
        <div className="hidden xl:block">
          <h2 className={cn('mb-2.5 font-display text-small font-[650]', MUTED)}>{t('viewer.hud.stopsTitle')}</h2>
          <ol className="m-0 flex list-none flex-col gap-0.5 p-0">
            {stops.map((s) => (
              <li key={s.number} aria-current={s.number === stopNumber ? 'step' : undefined}
                className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-lede aria-[current=step]:bg-cyan-400/14 aria-[current=step]:inset-ring aria-[current=step]:inset-ring-cyan-300/35">
                <StopMark stop={s.number} />
                <span className="min-w-0 flex-1">{s.name}</span>
                <span className="font-display text-small font-semibold tabular-nums text-glass-dark-text/85">{format.integer(counts.get(s.number) ?? 0)}</span>
              </li>
            ))}
          </ol>
        </div>
        <div key={stopNumber} className="animate-[lm-fade-in_150ms_var(--ease-standard)] xl:mt-2.5 xl:border-t xl:border-glass-dark-border xl:pt-2.5">
          <p className="font-semibold text-sky-text">{t('viewer.hud.stopOf', { kind, number: stopNumber ?? '', total: stops.length })}</p>
          <p className={cn('text-body-lg font-display font-[650] text-sky-text xl:text-h3', !unloading && 'xl:hidden')}>{stop?.name}</p>
          <p className={cn('hidden text-body xl:block xl:text-fine', MUTED)}>{t('viewer.hud.packagesHere', { count })} · {t(unloading ? 'viewer.hud.unloadingHint' : 'viewer.hud.loadingHint')}</p>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <Button variant="glass" className={HUD_BUTTON} aria-pressed={operations.follow === 'on'}
            onClick={() => operations.setFollow(operations.follow === 'on' ? 'off' : 'on')}>
            <Focus strokeWidth={1.5} />{operations.follow === 'paused' ? t('viewer.hud.resumeFollow') : t('viewer.hud.follow', { state: t(operations.follow === 'on' ? 'common.on' : 'common.off') })}
          </Button>
          {onResetFocus ? <Button variant="glass" className={HUD_BUTTON} onClick={onResetFocus}><Maximize strokeWidth={1.5} />{t('viewer.hud.overview')}</Button> : null}
          {unloading && p && state.selectedId !== p.id ? <Button variant="glass" className={HUD_BUTTON} onClick={() => { state.select(p.id); onFocus(p) }}>
            <Undo2 strokeWidth={1.5} />{t('viewer.hud.backToTarget')}
          </Button> : null}
        </div>
        {unloading && operations.unload.warning ? <div role="status" className="mt-2.5 rounded-lg border border-amber-500/60 bg-amber-700/35 p-2.5">
          <p className="mb-2 flex items-center gap-2 font-semibold text-amber-200">
            <AlertTriangle className="size-4 flex-none text-amber-500" strokeWidth={1.5} aria-hidden />{t('viewer.operations.blockers.paused')}
          </p>
          <Button variant="glass" className={cn(HUD_BUTTON, 'w-full')} onClick={() => operations.unload.setCursor(operations.unload.cursor + 1)}>
            <SkipForward strokeWidth={1.5} />{t('viewer.hud.skipStep')}
          </Button>
        </div> : null}
      </section>
      {/* Từ 1.280 px tâm khối lượng nằm trong cột nổi bên phải (SceneInspector) */}
      <MassCard state={state} operations={operations} className="max-w-60 xl:hidden" />
    </div>
    <div className="flex items-end justify-between gap-2">
      {/* Thanh kiện gọn: tablet và điện thoại; từ 1.280 px lúc xếp hàng thẻ kiện nổi bên phải thay nó, lúc dỡ hàng vẫn giữ (kiện chắn đang xem) */}
      <div className={cn('pointer-events-auto flex max-w-full items-center gap-1 p-1', !unloading && 'xl:hidden', GLASS_PANEL)}>
        <Button variant="skyGhost" aria-label={t('viewer.hud.selectPackage')} className="h-14 min-w-0 px-2 text-body-lg xl:h-10 xl:text-body" onClick={() => onInspect('package')}>
          <span className="max-w-32 truncate font-mono xl:max-w-48">{state.selected?.id ?? t('viewer.hud.selectPackage')}</span>
        </Button>
        <Button variant="skyGhost" className="size-14 p-0 xl:size-10" aria-label={t('viewer.hud.focus')} disabled={!state.selected} onClick={() => onFocus()}><Focus strokeWidth={1.5} /></Button>
        {onEdit ? <Button variant="skyGhost" className="size-14 p-0 xl:size-10" aria-label={t('viewer.hud.edit')} disabled={!state.selected} onClick={onEdit}><Pencil strokeWidth={1.5} /></Button> : null}
      </div>
      <Button variant="glass" className="pointer-events-auto ml-auto size-14 shrink-0 p-0 glass-dark xl:h-10 xl:w-auto xl:px-3.5" aria-label={t('viewer.hud.detailsLabel')} onClick={() => onInspect('operations')}>
        <Settings2 strokeWidth={1.5} /><span className="hidden xl:inline">{t('viewer.hud.detailsLabel')}</span>
      </Button>
    </div>
  </div>
}
