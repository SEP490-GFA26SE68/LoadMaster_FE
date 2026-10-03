import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogDescription, DialogTitle } from '@/components/ui/Dialog'
import type { ConstraintIssue } from '@/domain/constraints'
import type { ScenePlacement } from '@/features/viewer3d/scene-input'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { LoadPlanViewerState } from '../useLoadPlanViewer'
import type { OperationsState } from '../operations/useOperations'
import { MassCard, OperationsPanel, UnloadingPanel } from '../operations/OperationsPanel'
import { SelectedPackagePanel } from './SelectedPackagePanel'
import { PackageListPanel } from './PackageListPanel'
import { PlanMetricsPanel } from './PlanMetricsPanel'
import { SlicePanel } from '../overlays/SlicePanel'
import { StopLegend } from '../overlays/StopLegend'
import { ObstacleLegend } from '../overlays/ObstacleLegend'
import { COLOR_MODES } from '../viewer-options'
import type { ColorContext } from '../colors'
import type { InspectorTab } from './WorkspaceToolbar'
import { DARK_FIELD, DARK_SCOPE, GLASS_PANEL, GLASS_PRESSED, GlassSegmented, MUTED } from './scene-ui'

type InspectorProps = {
  state: LoadPlanViewerState; operations: OperationsState; tripId: string; colorContext: ColorContext
  /** Lỗi và cảnh báo ràng buộc của phương án đang xem (gồm chỉnh tay), LM-049 */
  issues: readonly ConstraintIssue[]
  /** Vắng khi người xem không được chỉnh phương án (D-41) hoặc chuyến đã khoá: ẩn nút Chỉnh sửa. */
  onEdit?: () => void; onFocus: () => void; onSelect: (p: ScenePlacement) => void
  tab: InspectorTab | null; onTab: (tab: InspectorTab) => void; onClose: () => void
}

/**
 * Lớp thông tin của Planner ở chế độ Xem. Khi hộp thông tin đóng: cột nổi bên phải khung 3D — tâm khối lượng hàng (nếu bật), rồi
 * thẻ kiện đang chọn (xếp hàng) hoặc panel thứ tự dỡ + kiện chắn lối dỡ (dỡ hàng); thẻ và panel chỉ từ 1.280 px, hẹp hơn dùng thanh
 * kiện gọn và hộp thông tin. Hộp thông tin (V2.3 Planner3DThongTin) là panel nền đặc tối bên phải — bề mặt đọc lâu nên không dùng kính
 * (mục 5), và không phủ tối khung 3D.
 */
export function SceneInspector(props: InspectorProps) {
  const { tab } = props
  return <>
    {tab === null ? <FloatingColumn {...props} /> : null}
    <InspectorDialog {...props} />
  </>
}

function FloatingColumn({ state, operations, tripId, issues, onEdit, onFocus, onSelect, onTab }: InspectorProps) {
  const selected = state.selected
  const editBlocker = onEdit ? (p: ScenePlacement) => { state.select(p.id); onEdit() } : undefined
  return <div className={cn('pointer-events-none absolute top-3 right-3 bottom-16 z-10 hidden w-83 flex-col gap-3 xl:flex', DARK_SCOPE)}>
    <MassCard state={state} operations={operations} />
    {operations.kind === 'loading' ? (
      <SelectedPackagePanel className={cn('pointer-events-auto', GLASS_PANEL)} placement={selected} placements={state.placements}
        totalSteps={state.totalSteps} stops={state.sceneModel.stops} zones={state.sceneModel.zones} tripId={tripId} issues={issues}
        orientationRules={selected ? state.sceneModel.orientationRulesById.get(selected.id) : undefined}
        onPick={() => onTab('package')} onEdit={onEdit} onFocus={onFocus} />
    ) : (
      <div className="pointer-events-auto flex min-h-0"><UnloadingPanel state={state} operations={operations} onSelect={onSelect} onEdit={editBlocker} /></div>
    )}
  </div>
}

function InspectorDialog({ state, operations, tripId, colorContext, issues, onEdit, onFocus, onSelect, tab, onTab, onClose }: InspectorProps) {
  const t = useT()
  const metrics = state.sceneModel.metrics
  const tabs: { value: InspectorTab; label: string }[] = [
    { value: 'operations', label: t('viewer.inspector.tabs.operations') }, { value: 'package', label: t('viewer.inspector.tabs.package') },
    { value: 'display', label: t('viewer.inspector.tabs.display') }, { value: 'packages', label: t('viewer.inspector.tabs.packages') },
    ...(metrics ? [{ value: 'metrics' as const, label: t('viewer.plan.metricsTab') }] : []),
  ]
  const editBlocker = onEdit ? (p: ScenePlacement) => { onClose(); state.select(p.id); onEdit() } : undefined
  return <Dialog open={tab !== null} onOpenChange={(open) => { if (!open) onClose() }}>
    <DialogPrimitive.Portal>
      {/* Lớp phủ trong suốt: bấm ra ngoài vẫn đóng như mọi hộp thoại, nhưng khung 3D không bị phủ tối */}
      <DialogPrimitive.Overlay className="fixed inset-0 z-300" />
      <DialogPrimitive.Content className={cn(
        'fixed inset-x-0 bottom-0 z-300 flex max-h-[75dvh] flex-col overflow-hidden rounded-t-xl border border-glass-dark-border bg-panel-dark shadow-e3 outline-none',
        'xl:inset-x-auto xl:top-17 xl:right-3 xl:bottom-24 xl:max-h-none xl:w-105 xl:rounded-xl',
        'data-[state=open]:animate-[lm-fade-in_220ms_var(--ease-standard)]', DARK_SCOPE)}>
        <div className="flex shrink-0 items-center justify-between gap-3 py-2.5 pr-2.5 pl-4">
          <DialogTitle className="font-display text-body-lg font-[650] text-sky-text xl:text-lede">{t('viewer.inspector.title')}</DialogTitle>
          <Button variant="glass" className="h-14 text-body-lg xl:h-8 xl:px-2.5 xl:text-small" onClick={onClose}><X strokeWidth={1.5} />{t('viewer.inspector.close')}</Button>
        </div>
        <DialogDescription className="sr-only">{t('viewer.inspector.description')}</DialogDescription>
        <GlassSegmented ariaLabel={t('viewer.inspector.tabsLabel')} options={tabs} value={tab} onChange={onTab}
          className={cn('mx-3 shrink-0', metrics ? 'grid grid-cols-3 xl:flex' : 'grid grid-cols-4')} itemClassName="px-1.5" />
        <div className="mt-2 min-h-0 flex-1 overflow-y-auto" aria-label={t('viewer.inspector.contentLabel')}>
          {tab === 'operations' ? <OperationsPanel state={state} operations={operations} onSelect={(p) => { onSelect(p); onClose() }} onEdit={editBlocker} /> : null}
          {tab === 'package' ? <>
            <label className={cn('mx-4 mt-2 mb-1 flex flex-col gap-2 text-body-lg xl:text-small', MUTED)}>{t('viewer.inspector.selectPackage')}
              <select aria-label={t('viewer.inspector.selectPackage')} value={state.selectedId ?? ''} onChange={(e) => state.select(e.target.value || null)}
                className={cn(DARK_FIELD, 'font-mono')}>
                <option value="">{t('viewer.inspector.selectPackage')}</option>{state.placements.map((p) => <option key={p.id} value={p.id}>{t('common.packageAtStop', { id: p.id, stop: p.stop })}</option>)}
              </select>
            </label>
            <SelectedPackagePanel placement={state.selected} placements={state.placements} totalSteps={state.totalSteps}
              orientationRules={state.selected ? state.sceneModel.orientationRulesById.get(state.selected.id) : undefined}
              stops={state.sceneModel.stops} zones={state.sceneModel.zones} tripId={tripId} issues={issues} onClose={() => state.select(null)}
              onEdit={onEdit ? () => { onClose(); onEdit() } : undefined} onFocus={() => { onClose(); onFocus() }} />
          </> : null}
          {tab === 'display' ? <div className="flex flex-col gap-3 p-4 text-body-lg xl:text-body">
            <h2 className="font-display font-[650] text-sky-text">{t('viewer.inspector.layers')}</h2>
            <Button variant="glass" aria-pressed={operations.showMass} onClick={() => operations.setShowMass(!operations.showMass)} className={cn('h-14 xl:h-9', GLASS_PRESSED)}>
              {t(operations.showMass ? 'viewer.inspector.hideMass' : 'viewer.inspector.showMass')}</Button>
            {state.sceneModel.zones.length > 0 ? <>
              <Button variant="glass" aria-pressed={operations.showZones} onClick={() => operations.setShowZones(!operations.showZones)} className={cn('h-14 xl:h-9', GLASS_PRESSED)}>
                {t(operations.showZones ? 'viewer.inspector.hideZones' : 'viewer.inspector.showZones')}</Button>
              <p className={MUTED}>{t('viewer.inspector.zonesHint')}</p>
            </> : null}
            <GlassSegmented ariaLabel={t('viewer.inspector.colorMode')} options={COLOR_MODES.map((mode) => ({ value: mode, label: t(`viewer.colorModes.${mode}`) }))}
              value={state.colorMode} onChange={state.setColorMode} className="flex-col" itemClassName="xl:min-h-9" />
            <StopLegend stops={[...state.sceneModel.stops]} colorMode={state.colorMode} colorContext={colorContext} />
            <ObstacleLegend obstacles={state.sceneModel.vehicle.obstacles} />
            <SlicePanel sliceCm={state.sliceCm} maxCm={state.sceneModel.vehicle.innerLengthCm} onChange={state.setSliceCm} />
            <p className={MUTED}>{t('viewer.inspector.shortcuts')}</p>
          </div> : null}
          {tab === 'packages' ? <PackageListPanel unplaced={state.sceneModel.unplaced} pinned={state.placements.filter((p) => p.pinned)}
            placements={state.placements} vehicle={state.sceneModel.vehicle} selectedId={state.selectedId}
            onSelect={(id) => { state.select(id); onTab('package') }} stops={state.sceneModel.stops} issues={issues} tripId={tripId} /> : null}
          {tab === 'metrics' && metrics ? <PlanMetricsPanel metrics={metrics} /> : null}
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </Dialog>
}
