import { memo, useMemo, type ReactNode } from 'react'
import { AlertTriangle, Focus, Maximize, Pencil, Rotate3d, Settings2, SkipForward, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { VehicleConfig } from '@/domain/models'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { VehicleBodyStyle } from '@/types/vehicle-body-style'
import type { LoadPlanViewerState } from '../useLoadPlanViewer'
import type { OperationsState } from './useOperations'
import { MassCard } from './GravityCards'
import { PinnedRerun } from './PinnedRerun'
import { VehicleCard } from '../vehicle/VehicleCard'
import type { InspectorTab } from '../panels/WorkspaceToolbar'
import { DARK_SCOPE, GLASS_PANEL, GLASS_PRESSED, MUTED, StopMark } from '../panels/scene-ui'
import type { ScenePlacement, SceneStop } from '@/features/viewer3d/scene-input'

const HUD_BUTTON = cn('pointer-events-auto h-14 px-3 text-body-lg xl:h-8 xl:px-2.5 xl:text-small', GLASS_PRESSED)

/**
 * Bối cảnh ở mép khung 3D (V2.3 `.legend`): điểm giao theo thứ tự dỡ với số kiện, bước đang mô phỏng, theo bước / xem toàn xe /
 * quay lại kiện cần dỡ và lối dỡ bị che kín. Thông tin không gian nằm trên chính kiện (nhãn neo). Thẻ kiện đang chọn và panel
 * dỡ hàng nổi bên phải nằm ở `SceneInspector` (cần lỗi ràng buộc của phương án). Dưới 1.280 px bỏ danh sách điểm giao và dùng
 * thanh kiện gọn ở góc dưới trái. Góc dưới phải: thẻ xe (`VehicleCard`, từ 768 px — xe của phương án đang xem, `sceneModel.vehicle`,
 * cho mọi người xem được Planner; bấm mở bảng thông số xe, chân bảng có nút phụ "Đổi xe" khi `onChangeVehicle` có — FE-5b-08, D-80;
 * thanh trên của Planner không còn chỗ cho xe ở 1.536–1.760 px) cạnh "Chi tiết / Hiển thị". Cùng hàng, bên trái hai thứ đó: nhãn kiện
 * đã ghim và "Chạy lại giữ ghim" khi phương án có kiện ghim (FE-BL-02) — hàng này nằm dưới cột nổi bên phải nên không bị nó che.
 * Planner bản máy chủ đặt thêm nút "Trợ lý AI" (`assistant`) ngay trước "Chi tiết / Hiển thị". Nút công tắc "Xoay một vòng" (`spin`,
 * `aria-pressed`) đứng ngay trước "Chi tiết / Hiển thị": camera quay đúng một vòng rồi dừng; nơi gọi không truyền khi người xem chọn
 * giảm chuyển động. HUD chỉ có ở chế độ Xem.
 *
 * Bốn phần (điểm giao, thẻ G, thanh kiện, góc dưới phải) bọc `memo` và chỉ nhận đúng thứ chúng đọc: bước phát lại chỉ vẽ lại phần có
 * số đổi, chọn kiện chỉ vẽ lại thanh kiện. Nơi gọi giữ tham chiếu cho các hàm và cho `spin`, `assistant`.
 */
export function SceneHud({ state, operations, onInspect, onFocus, onEdit, onResetFocus, onChangeVehicle, onRerunPinned, rerunBlockedReason, assistant, spin,
  vehicleBodyStyle }: {
  state: LoadPlanViewerState; operations: OperationsState; onInspect: (tab: InspectorTab) => void
  onFocus: (p?: ScenePlacement) => void; onEdit?: () => void; onResetFocus?: () => void
  /** Mở hộp thoại Đổi xe (nút ở chân bảng thông số xe); vắng khi chuyến không ở trạng thái Đã lập kế hoạch hoặc người xem không sửa được chuyến. */
  onChangeVehicle?: () => void
  /** Mở Thiết lập tối ưu để chạy lại giữ kiện đã ghim (FE-BL-02); vắng khi người xem không chạy tối ưu được hoặc chuyến đã sang pha vận hành. */
  onRerunPinned?: () => void
  /** Lý do "Chạy lại giữ ghim" đang bị chặn (nút mờ, câu đứng cạnh); vắng là chạy được. */
  rerunBlockedReason?: string
  /** Nút "Trợ lý AI" (Planner bản máy chủ khi nhóm `assistant` nối máy chủ), đứng trước "Chi tiết / Hiển thị". */
  assistant?: ReactNode
  /** "Xoay một vòng" (công tắc); vắng là không có nút (giảm chuyển động). */
  spin?: { active: boolean; onToggle: () => void }
  /** Kiểu thân xe của loại đang gắn với xe: dòng "Kiểu thân xe" của thẻ xe; vắng là dáng tự chọn, thẻ không nói gì. */
  vehicleBodyStyle?: VehicleBodyStyle
}) {
  const p = operations.current, stopNumber = operations.focusStop ?? p?.stop
  const counts = useMemo(() => {
    const byStop = new Map<number, number>()
    for (const placement of state.placements) byStop.set(placement.stop, (byStop.get(placement.stop) ?? 0) + 1)
    return byStop
  }, [state.placements])
  const pinnedCount = useMemo(() => state.placements.filter((placement) => placement.pinned).length, [state.placements])
  const pinsUnsaved = useMemo(() => [...state.draft.patches.values()].some((patch) => patch.pinned !== undefined), [state.draft])
  const unloading = operations.kind === 'unloading'
  const { unload } = operations
  const backTo = unloading && p && state.selectedId !== p.id ? p : undefined
  const vehicle = state.sceneModel.vehicle
  return <div data-scene-hud className={cn('pointer-events-none absolute inset-0 flex flex-col justify-between p-3', DARK_SCOPE)}>
    <div className="flex items-start justify-between gap-3">
      <HudStops stops={state.sceneModel.stops} counts={counts} stopNumber={stopNumber} unloading={unloading} fromResult={unload.fromResult}
        follow={operations.follow} setFollow={operations.setFollow} onResetFocus={onResetFocus}
        onBack={backTo ? () => { state.select(backTo.id); onFocus(backTo) } : undefined}
        onSkip={unloading && unload.warning ? () => unload.setCursor(unload.cursor + 1) : undefined} />
      {/* Từ 1.280 px thẻ trọng tâm hàng G nằm trong cột nổi bên phải (SceneInspector) */}
      <MassCard cargo={operations.cargo} showMass={operations.showMass} vehicle={vehicle} className="max-w-60 xl:hidden" />
    </div>
    <div className="flex items-end justify-between gap-2">
      <HudPackageBar selectedId={state.selected?.id ?? null} unloading={unloading} onInspect={onInspect} onFocus={onFocus} onEdit={onEdit} />
      <HudCorner pinnedCount={pinnedCount} pinsUnsaved={pinsUnsaved} rerunBlockedReason={rerunBlockedReason} onRerunPinned={onRerunPinned}
        vehicle={vehicle} bodyStyle={vehicleBodyStyle} onChangeVehicle={onChangeVehicle} assistant={assistant} spin={spin} onInspect={onInspect} />
    </div>
  </div>
}

/** Điểm giao theo thứ tự, điểm đang mô phỏng và các nút theo bước / toàn xe / quay lại; `onBack`, `onSkip` chỉ có lúc cần (dỡ hàng). */
const HudStops = memo(function HudStops({ stops, counts, stopNumber, unloading, fromResult, follow, setFollow, onResetFocus, onBack, onSkip }: {
  stops: readonly SceneStop[]; counts: ReadonlyMap<number, number>; stopNumber: number | undefined; unloading: boolean; fromResult: boolean
  follow: OperationsState['follow']; setFollow: OperationsState['setFollow']; onResetFocus?: () => void; onBack?: () => void; onSkip?: () => void
}) {
  const format = useFormat()
  const t = useT()
  const stop = stops.find((s) => s.number === stopNumber)
  const count = stopNumber === undefined ? 0 : counts.get(stopNumber) ?? 0
  const kind = t(!unloading ? 'viewer.operations.loading' : fromResult ? 'viewer.operations.unloading' : 'viewer.operations.suggestedUnloading')
  return <section aria-label={t('viewer.hud.stopsTitle')}
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
      <Button variant="glass" className={HUD_BUTTON} aria-pressed={follow === 'on'}
        onClick={() => setFollow(follow === 'on' ? 'off' : 'on')}>
        <Focus strokeWidth={1.5} />{follow === 'paused' ? t('viewer.hud.resumeFollow') : t('viewer.hud.follow', { state: t(follow === 'on' ? 'common.on' : 'common.off') })}
      </Button>
      {onResetFocus ? <Button variant="glass" className={HUD_BUTTON} onClick={onResetFocus}><Maximize strokeWidth={1.5} />{t('viewer.hud.overview')}</Button> : null}
      {onBack ? <Button variant="glass" className={HUD_BUTTON} onClick={onBack}>
        <Undo2 strokeWidth={1.5} />{t('viewer.hud.backToTarget')}
      </Button> : null}
    </div>
    {onSkip ? <div role="status" className="mt-2.5 rounded-lg border border-amber-500/60 bg-amber-700/35 p-2.5">
      <p className="mb-2 flex items-center gap-2 font-semibold text-amber-200">
        <AlertTriangle className="size-4 flex-none text-amber-500" strokeWidth={1.5} aria-hidden />{t('viewer.operations.blockers.paused')}
      </p>
      <Button variant="glass" className={cn(HUD_BUTTON, 'w-full')} onClick={onSkip}>
        <SkipForward strokeWidth={1.5} />{t('viewer.hud.skipStep')}
      </Button>
    </div> : null}
  </section>
})

/** Thanh kiện gọn: tablet và điện thoại; từ 1.280 px lúc xếp hàng thẻ kiện nổi bên phải thay nó, lúc dỡ hàng vẫn giữ (kiện chắn đang xem). */
const HudPackageBar = memo(function HudPackageBar({ selectedId, unloading, onInspect, onFocus, onEdit }: {
  selectedId: string | null; unloading: boolean; onInspect: (tab: InspectorTab) => void; onFocus: (p?: ScenePlacement) => void; onEdit?: () => void
}) {
  const t = useT()
  return <div data-hud-package-bar className={cn('pointer-events-auto flex max-w-full items-center gap-1 p-1', !unloading && 'xl:hidden', GLASS_PANEL)}>
    <Button variant="skyGhost" aria-label={t('viewer.hud.selectPackage')} className="h-14 min-w-0 px-2 text-body-lg xl:h-10 xl:text-body" onClick={() => onInspect('package')}>
      <span className="max-w-32 truncate font-mono xl:max-w-48">{selectedId ?? t('viewer.hud.selectPackage')}</span>
    </Button>
    <Button variant="skyGhost" className="size-14 p-0 xl:size-10" aria-label={t('viewer.hud.focus')} disabled={selectedId === null} onClick={() => onFocus()}><Focus strokeWidth={1.5} /></Button>
    {onEdit ? <Button variant="skyGhost" className="size-14 p-0 xl:size-10" aria-label={t('viewer.hud.edit')} disabled={selectedId === null} onClick={onEdit}><Pencil strokeWidth={1.5} /></Button> : null}
  </div>
})

/** Góc dưới phải: kiện đã ghim + chạy lại, thẻ xe, trợ lý, xoay một vòng, "Chi tiết / Hiển thị". */
const HudCorner = memo(function HudCorner({ pinnedCount, pinsUnsaved, rerunBlockedReason, onRerunPinned, vehicle, bodyStyle, onChangeVehicle, assistant, spin,
  onInspect }: {
  pinnedCount: number; pinsUnsaved: boolean; rerunBlockedReason?: string; onRerunPinned?: () => void
  vehicle: VehicleConfig; bodyStyle?: VehicleBodyStyle; onChangeVehicle?: () => void; assistant?: ReactNode
  spin?: { active: boolean; onToggle: () => void }; onInspect: (tab: InspectorTab) => void
}) {
  const t = useT()
  return <div data-hud-corner className="ml-auto flex shrink-0 items-end gap-2">
    {onRerunPinned ? <PinnedRerun count={pinnedCount} unsaved={pinsUnsaved} blockedReason={rerunBlockedReason} onRerun={onRerunPinned} /> : null}
    <VehicleCard vehicle={vehicle} bodyStyle={bodyStyle} onChangeVehicle={onChangeVehicle} />
    {assistant}
    {spin ? <Button variant="glass" className={cn('pointer-events-auto size-14 shrink-0 p-0 glass-dark xl:h-10 xl:w-auto xl:px-3.5', GLASS_PRESSED)} aria-pressed={spin.active}
      aria-label={t(spin.active ? 'viewer.hud.stopSpin' : 'viewer.hud.spin')} onClick={spin.onToggle}>
      <Rotate3d strokeWidth={1.5} /><span className="hidden xl:inline">{t(spin.active ? 'viewer.hud.stopSpin' : 'viewer.hud.spin')}</span>
    </Button> : null}
    <Button variant="glass" className="pointer-events-auto size-14 shrink-0 p-0 glass-dark xl:h-10 xl:w-auto xl:px-3.5" aria-label={t('viewer.hud.detailsLabel')} onClick={() => onInspect('operations')}>
      <Settings2 strokeWidth={1.5} /><span className="hidden xl:inline">{t('viewer.hud.detailsLabel')}</span>
    </Button>
  </div>
})
