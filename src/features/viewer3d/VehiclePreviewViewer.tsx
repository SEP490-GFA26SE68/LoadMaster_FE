import { useCallback, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router'
import type { VehicleConfig } from '@/domain/models'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { ScenePlacement } from './scene-input'
import { DARK_SCOPE, GlassSegmented } from './panels/scene-ui'
import { ObstacleCallout } from './scene/ObstacleCallout'
import { SceneCanvas } from './scene/SceneCanvas'
import { VehicleSpecMarks } from './scene/VehicleSpecMarks'
import { HIDDEN_SPEC_LABELS, SPEC_LABELS } from './scene/vehicle-spec-marks'
import { usePerformanceFlags, type PerformanceFlags } from './usePerformanceFlags'
import { debugQualityTier } from './viewer-options'
import type { CameraPreset } from './viewer-types'

const NO_PLACEMENTS: readonly ScenePlacement[] = []
const noop = () => {}
/** Scene không có kiện nên vẽ ở đúng độ phân giải màn hình (tối đa 2×) vẫn nhẹ; DPR 0,5 của tier `low` làm hình nhoè. */
const PREVIEW_DPR: PerformanceFlags['dpr'] = [1, 2]
/** Bốn góc đủ để soát số đang nhập: tổng thể, trục và chiều dài, ô cửa, mặt bằng vật cản. */
const PREVIEW_PRESETS: readonly CameraPreset[] = ['goc-cheo', 'ben-hong', 'cua-sau', 'tren']

/**
 * Xem trước xe ở form xe (LM-042). Cùng `SceneCanvas` với Planner, kho và tài xế, không có kiện: tier `balanced` cố định ở DPR màn
 * hình (trừ khi `?debug&quality=` khoá tier khác), có cabin, bánh và khung gầm, vách sau có ô cửa đúng số, kèm đường kích thước
 * (`VehicleSpecMarks`) và nhãn của vật cản đang làm nổi. Camera chỉ canh lại theo `frameVehicle` hoặc khi người dùng bấm một góc nhìn.
 * Nút chọn góc nhìn vẽ vào `toolbarHost` — một hàng của form nằm ngoài khung hình, để không che nhãn kích thước ở mép trên.
 * `fleet` lazy-load component này; phần theo dõi form, debounce và kiểm hợp lệ nằm ở `fleet/VehiclePreview.tsx`.
 */
export function VehiclePreviewViewer({ vehicle, frameVehicle, toolbarHost, highlightedObstacleId, onObstacleSelect }: {
  vehicle: VehicleConfig
  frameVehicle: VehicleConfig
  toolbarHost: HTMLElement | null
  highlightedObstacleId: string | null
  onObstacleSelect: (id: string | null) => void
}) {
  const t = useT()
  const [search] = useSearchParams()
  const debugTier = debugQualityTier(search)
  const tierFlags = usePerformanceFlags(debugTier ?? 'balanced', 'fleet')
  const flags = useMemo(() => (debugTier ? tierFlags : { ...tierFlags, dpr: PREVIEW_DPR }), [debugTier, tierFlags])
  // Bấm lại góc đang chọn sau khi tự xoay: `request` tăng để camera về đúng góc đó. `free`: người dùng đã tự xoay / phóng to.
  const [view, setView] = useState<{ preset: CameraPreset; request: number; free: boolean }>({ preset: 'goc-cheo', request: 0, free: false })
  const handleUserControl = useCallback(() => setView((current) => (current.free ? current : { ...current, free: true })), [])
  const model = useMemo(() => ({ vehicle, stops: [], placements: NO_PLACEMENTS }), [vehicle])
  const highlighted = vehicle.obstacles.find((obstacle) => obstacle.id === highlightedObstacleId)
  // Đang làm nổi một vật cản: nhãn của vật cản đứng một mình, nhãn kích thước tạm ẩn (đường vẫn vẽ, bảng số bên dưới vẫn đủ).
  const hidden = highlighted ? SPEC_LABELS : view.free ? undefined : HIDDEN_SPEC_LABELS[view.preset]
  const options = useMemo(() => PREVIEW_PRESETS.map((value) => ({ value, label: t(`viewer.camera.${value}`) })), [t])

  return <>
    <SceneCanvas experience="fleet" model={model} placements={NO_PLACEMENTS} flags={flags} preset={view.preset} fitRequest={view.request}
      selectedId={null} onSelect={noop} step={0} animateLoading={false} specView onUserControl={handleUserControl}
      frameVehicle={frameVehicle} highlightedObstacleId={highlightedObstacleId} onObstacleSelect={onObstacleSelect}>
      <VehicleSpecMarks vehicle={vehicle} hidden={hidden} />
      {highlighted ? <ObstacleCallout key={highlighted.id} obstacle={highlighted} /> : null}
    </SceneCanvas>
    {toolbarHost ? createPortal(
      <GlassSegmented ariaLabel={t('viewer.toolbar.camera')} options={options} value={view.preset}
        onChange={(preset) => setView((current) => ({ preset, request: current.request + 1, free: false }))}
        className={cn('grid grid-cols-2 sm:flex', DARK_SCOPE)} />,
      toolbarHost,
    ) : null}
  </>
}
