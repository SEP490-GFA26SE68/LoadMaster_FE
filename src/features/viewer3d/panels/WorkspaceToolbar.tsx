import { Layers, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { SceneStop } from '../scene-input'
import type { CameraPreset } from '../viewer-types'
import { CameraSelect, PlannerSelect } from './PlannerSelect'
import { DARK_SCOPE, GlassSegmented } from './scene-ui'
import { memo } from 'react'

export type InspectorTab = 'operations' | 'package' | 'display' | 'packages' | 'metrics'

/** Radix Select không nhận `value=""`: dòng "Mọi điểm giao" dùng giá trị riêng rồi đổi về `null`. */
const ALL_STOPS = 'all'

/**
 * Chỉ đúng thứ hai thanh điều khiển đọc (giá trị + hàm giữ tham chiếu), không cả `OperationsState`: hai thanh bọc `memo`, bước phát lại
 * và chọn kiện không vẽ lại các ô Select của chúng.
 */
export type SimulationControlsProps = {
  kind: 'loading' | 'unloading'
  onKind: (kind: 'loading' | 'unloading') => void
  focusStop: number | null
  onFocusStop: (stop: number | null) => void
  stops: readonly SceneStop[]
  preset: CameraPreset
  onPreset: (preset: CameraPreset) => void
}

/**
 * Xếp/Dỡ, điểm giao đang tập trung và góc nhìn (LM-094). Từ 1.366 px chúng nằm ngay trong thanh trên (một hàng điều khiển,
 * D-51); hẹp hơn thì ở `WorkspaceToolbar`. Danh sách kiện, vận hành và lớp hiển thị chỉ mở từ nút "Chi tiết / Hiển thị" ở góc
 * khung 3D — thanh công cụ không lặp lại lối vào đó (U-4). Xếp/Dỡ là nhóm chọn một trên kính tối (V2.3 `.seg2`).
 */
export function SimulationControls({ kind, onKind, focusStop, onFocusStop, stops, preset, onPreset }: SimulationControlsProps) {
  const t = useT()
  const stopOptions = [
    ...(kind === 'loading' ? [{ value: ALL_STOPS, label: t('viewer.toolbar.allStops') }] : []),
    ...stops.map((stop) => ({ value: String(stop.number), label: t('common.stopWithName', { number: stop.number, name: stop.name }) })),
  ]
  return (
    <>
      <GlassSegmented ariaLabel={t('viewer.toolbar.simulation')} className={cn('shrink-0', DARK_SCOPE)} itemClassName="px-3 xl:min-h-8.5 xl:text-lede"
        value={kind} onChange={onKind}
        options={[
          { value: 'loading', label: t('viewer.operations.loading') },
          { value: 'unloading', label: t('viewer.operations.unloading') },
        ]} />
      <PlannerSelect
        tone="glass"
        label={t('viewer.toolbar.focusStop')}
        className="hidden w-48 min-w-28 md:flex xl:w-40"
        value={focusStop === null ? ALL_STOPS : String(focusStop)}
        options={stopOptions}
        onValueChange={(value) => onFocusStop(value === ALL_STOPS ? null : Number(value))}
      />
      <CameraSelect tone="glass" icon={Layers} label={t('viewer.toolbar.camera')} preset={preset} onPreset={onPreset} className="flex-1 sm:flex-none" />
    </>
  )
}

/**
 * Thanh công cụ riêng dưới thanh trên khi màn hẹp hơn 1.366 px: tablet giữ hai hàng điều khiển 56px (LM-094). Nút Chỉnh sửa từ
 * `lg`; màn hẹp hơn vào chỉnh sửa bằng nút bút ở thẻ kiện trên khung 3D. Nền tối nối liền khung 3D bên dưới.
 */
export const WorkspaceToolbar = memo(function WorkspaceToolbar({ onEdit, ...simulation }: SimulationControlsProps & { onEdit?: () => void }) {
  const t = useT()
  return (
    <div className={cn('flex flex-none items-center gap-2 border-b border-glass-dark-border bg-panel-dark px-2 py-1 min-[1366px]:hidden', DARK_SCOPE)} data-workspace-toolbar>
      <SimulationControls {...simulation} />
      {onEdit ? (
        <Button variant="glass" className="ml-auto hidden h-14 px-3 text-body-lg lg:flex xl:h-10 xl:text-body" onClick={onEdit}>
          <Pencil strokeWidth={1.5} />{t('viewer.toolbar.edit')}
        </Button>
      ) : null}
    </div>
  )
})
