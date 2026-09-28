import { Layers } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { CameraSelect, PlannerSelect } from './panels/PlannerSelect'
import type { SimulationControlsProps } from './panels/WorkspaceToolbar'

/** Radix Select không nhận `value=""`: dòng "Mọi điểm giao" dùng giá trị riêng rồi đổi về `null` (như `SimulationControls`). */
const ALL_STOPS = 'all'

/**
 * Điều khiển mô phỏng trong thanh trên kính tối của Planner từ 1.366 px (V2.3 `Planner3D`, D-51): nút đôi Xếp hàng / Dỡ hàng (`.seg2`),
 * điểm giao đang tập trung và góc nhìn. Cùng hành vi với `SimulationControls` của thanh công cụ màn hẹp — chỉ khác lớp kính tối;
 * tên truy cập giữ nguyên để test và trình đọc màn hình không phân biệt hai chỗ.
 */
export function PlannerSimulationControls({ operations, stops, preset, onPreset }: SimulationControlsProps) {
  const t = useT()
  const stopOptions = [
    ...(operations.kind === 'loading' ? [{ value: ALL_STOPS, label: t('viewer.toolbar.allStops') }] : []),
    ...stops.map((stop) => ({ value: String(stop.number), label: t('common.stopWithName', { number: stop.number, name: stop.name }) })),
  ]
  return (
    <>
      <div role="group" aria-label={t('viewer.toolbar.simulation')}
        className="flex shrink-0 gap-0.5 rounded-[11px] border border-sky-glass-border bg-cyan-950/40 p-0.75">
        {(['loading', 'unloading'] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            aria-pressed={operations.kind === kind}
            onClick={() => operations.setKind(kind)}
            className={cn(
              'h-8.5 rounded-sm px-2.5 text-small 2xl:px-3 font-semibold whitespace-nowrap text-sky-text-2 transition-colors duration-(--dur-fast) ease-standard',
              'hover:text-sky-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300',
              // Bản mẫu tô gradient cho nút đang bật; AGENTS mục 5 chỉ cho gradient ở nút chính nên dùng nền cyan đặc mờ
              'aria-pressed:bg-cyan-400/25 aria-pressed:text-sky-text',
              'aria-pressed:ring-1 aria-pressed:ring-cyan-300/50 aria-pressed:ring-inset',
            )}
          >
            {t(kind === 'loading' ? 'viewer.operations.loading' : 'viewer.operations.unloading')}
          </button>
        ))}
      </div>
      <PlannerSelect
        tone="glass"
        label={t('viewer.toolbar.focusStop')}
        className="w-36 min-w-28 xl:h-9.5"
        value={operations.focusStop === null ? ALL_STOPS : String(operations.focusStop)}
        options={stopOptions}
        onValueChange={(value) => operations.setFocusStop(value === ALL_STOPS ? null : Number(value))}
      />
      <CameraSelect tone="glass" icon={Layers} label={t('viewer.toolbar.camera')} preset={preset} onPreset={onPreset} className="xl:h-9.5 xl:w-28 2xl:w-36" />
    </>
  )
}
