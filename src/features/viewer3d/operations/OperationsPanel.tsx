import { useMemo } from 'react'
import { Crosshair, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { ScenePlacement } from '@/features/viewer3d/scene-input'
import type { LoadPlanViewerState } from '../useLoadPlanViewer'
import { AxleLoadPanel } from '../overlays/AxleLoadPanel'
import { DARK_FIELD, DARK_SUBCARD, GLASS_PANEL, GLASS_PRESSED, MUTED } from '../panels/scene-ui'
import { cargoCenterOfMass, stopOrderConsistent } from './operations-model'
import { BlockerPanel } from './BlockerPanel'
import type { OperationsState } from './useOperations'

type PanelProps = {
  state: LoadPlanViewerState; operations: OperationsState; onSelect: (p: ScenePlacement) => void
  /** Chọn kiện chắn rồi vào Chỉnh sửa; vắng khi không được chỉnh phương án. */
  onEdit?: (p: ScenePlacement) => void
}

/** Tab "Vận hành" của hộp thông tin: điểm giao đang mô phỏng, thứ tự xếp/dỡ, kiện chắn lối dỡ, tải trục. */
export function OperationsPanel({ state, operations, onSelect, onEdit }: PanelProps) {
  const t = useT()
  const { focusStop } = operations
  const stop = state.sceneModel.stops.find((p) => p.number === focusStop)
  return <div className="flex flex-col gap-4 p-4 text-body-lg xl:text-body">
    <label className="flex flex-col gap-2 md:hidden">{t('viewer.operations.stop')}
      <select aria-label={t('viewer.toolbar.focusStop')} value={focusStop ?? ''} onChange={(e) => operations.setFocusStop(e.target.value ? Number(e.target.value) : null)} className={DARK_FIELD}>
        {operations.kind === 'loading' ? <option value="">{t('viewer.toolbar.allStops')}</option> : null}
        {state.sceneModel.stops.map((s) => <option key={s.number} value={s.number}>{t('common.stopWithName', { number: s.number, name: s.name })}</option>)}
      </select>
    </label>
    <div>
      <h2 className="font-display text-h3 font-[650] text-sky-text">{stop ? t('viewer.operations.stopOf', { number: stop.number, total: state.sceneModel.stops.length }) : t('viewer.operations.allStops')}</h2>
      <p>{stop?.name ?? t('viewer.operations.simulatedPlan')}</p>
      {stop ? <p className={cn('mt-1', MUTED)}>{t('viewer.operations.earlierHidden')}</p> : null}
    </div>
    {operations.kind === 'loading' ? <p className={MUTED}>{t('viewer.operations.loadingLegend')}</p> : null}
    <div className={cn('p-3', DARK_SUBCARD)}>
      <p className="mb-2 font-semibold text-sky-text">{operations.kind === 'unloading' ? unloadingTitle(operations, t) : t('viewer.operations.loadingOrder')}</p>
      <OrderSummary state={state} operations={operations} onSelect={onSelect} />
    </div>
    <BlockerToggle operations={operations} />
    {operations.inspectBlockers ? <BlockerPanel tone="dark" target={state.placements.find((p) => p.id === operations.semantics.inspectionId)}
      lifo={operations.semantics.lifo} onSelect={onSelect} onEdit={onEdit} /> : null}
    {operations.kind === 'unloading' ? <p className={MUTED}>{t('viewer.operations.blockers.corridor')}</p> : null}
    <AxleLoadPanel axles={state.sceneModel.vehicle.axles} />
  </div>
}

/**
 * Panel dỡ hàng nổi bên phải khung 3D từ 1.280 px (V2.3 Planner3DDoHang `.ops`): thứ tự dỡ, kiện chắn lối dỡ theo kiểm LIFO, ghi chú
 * hành lang và nút ẩn/hiện kiện chắn. Câu "đã tạm dừng" chỉ nằm ở HUD bên trái để không nói hai lần.
 */
export function UnloadingPanel({ state, operations, onSelect, onEdit }: PanelProps) {
  const t = useT()
  const stop = state.sceneModel.stops.find((p) => p.number === operations.focusStop)
  return <section aria-label={t('viewer.operations.panelLabel')} className={cn('flex min-h-0 flex-col overflow-y-auto text-body xl:text-small', GLASS_PANEL)}>
    <div className="flex items-baseline justify-between gap-3 px-4 pt-3.5 pb-2.5">
      <h2 className="font-display text-body font-[650] text-sky-text">{unloadingTitle(operations, t)}</h2>
      {stop ? <span className={MUTED}>{t('viewer.operations.stopOf', { number: stop.number, total: state.sceneModel.stops.length })}</span> : null}
    </div>
    <div className="flex flex-col gap-3 px-3 pb-3.5">
      <OrderSummary state={state} operations={operations} onSelect={onSelect} />
      {operations.inspectBlockers ? <BlockerPanel tone="dark" target={state.placements.find((p) => p.id === operations.semantics.inspectionId)}
        lifo={operations.semantics.lifo} onSelect={onSelect} onEdit={onEdit} /> : null}
      <p className={cn('px-1', MUTED)}>{t('viewer.operations.blockers.corridor')}</p>
      <BlockerToggle operations={operations} />
    </div>
  </section>
}

/** Tâm khối lượng hàng (lớp "Hiện tâm khối lượng hàng"): kính tối, nổi góc trên phải khung 3D. */
export function MassCard({ state, operations, className }: Pick<PanelProps, 'state' | 'operations'> & { className?: string }) {
  const t = useT()
  const format = useFormat()
  const mass = useMemo(() => operations.showMass ? cargoCenterOfMass(operations.semantics.massPlacements) : null, [operations.showMass, operations.semantics.massPlacements])
  if (!mass) return null
  return <section aria-label={t('viewer.cues.centerOfMass')} data-mass-hud className={cn('pointer-events-auto grid grid-cols-[auto_1fr] gap-x-2.5 px-4 py-3 text-body xl:text-small', GLASS_PANEL, className)}>
    <span aria-hidden className="row-span-3 grid size-7.5 place-items-center rounded-md bg-amber-500/15 text-amber-500"><Crosshair className="size-4.5" strokeWidth={1.5} /></span>
    <span className="font-semibold text-sky-text">{t('viewer.cues.centerOfMass')}</span>
    <span className="font-mono">X {format.length(mass.position.x)} · Y {format.length(mass.position.y)} · Z {format.length(mass.position.z)}</span>
    <span className={MUTED}>{t('viewer.hud.lateralOffset', { value: format.length(Math.abs(mass.position.y - state.sceneModel.vehicle.innerWidthCm / 2)) })}</span>
  </section>
}

function unloadingTitle(operations: OperationsState, t: ReturnType<typeof useT>) {
  return operations.unload.fromResult ? t('viewer.operations.unloadingOrder') : t('viewer.operations.suggestedUnloadingOrder')
}

/** Kiện hiện tại (bấm để chọn) và kế tiếp, chấm màu như nhãn neo; rồi câu kiểm thứ tự điểm giao. */
function OrderSummary({ state, operations, onSelect }: Omit<PanelProps, 'onEdit'>) {
  const t = useT()
  const { current, next } = operations
  const consistent = useMemo(() => stopOrderConsistent(state.placements), [state.placements])
  const row = 'flex min-h-14 w-full items-center gap-2.5 rounded-md border border-glass-dark-border bg-sky-glass/60 px-2.5 text-left xl:min-h-8.5'
  return <div className="flex flex-col gap-1">
    {state.sceneModel.ordersRecomputed ? <p className={cn('mb-1', MUTED)}>{t('viewer.operations.ordersRecomputed')}</p> : null}
    {current ? <button type="button" onClick={() => onSelect(current)} className={cn(row, 'hover:bg-sky-glass-hover focus-visible:outline-2 focus-visible:outline-primary')}>
      <span aria-hidden className="size-2 flex-none rounded-full bg-highlight shadow-[0_0_8px_var(--highlight)]" />
      {t('viewer.operations.current', { id: current.id, stop: current.stop })}
    </button> : <p className="py-1">{t('viewer.operations.done')}</p>}
    {next ? <p className={row}><span aria-hidden className="size-2 flex-none rounded-full bg-cyan-400" />{t('viewer.operations.next', { id: next.id, stop: next.stop })}</p> : null}
    <p className={cn('mt-1.5 px-1', MUTED)}>{t(consistent ? 'viewer.operations.orderConsistent' : 'viewer.operations.orderInconsistent')}. {t('viewer.operations.orderScope')}</p>
  </div>
}

function BlockerToggle({ operations }: Pick<PanelProps, 'operations'>) {
  const t = useT()
  return <Button variant="glass" aria-pressed={operations.inspectBlockers} onClick={() => operations.setInspectBlockers(!operations.inspectBlockers)}
    className={cn('h-14 w-full text-body-lg xl:h-8 xl:text-small', GLASS_PRESSED)}>
    {operations.inspectBlockers ? <EyeOff strokeWidth={1.5} /> : <Eye strokeWidth={1.5} />}
    {t(operations.inspectBlockers ? 'viewer.operations.blockers.toggleHide' : 'viewer.operations.blockers.toggleShow')}
  </Button>
}
