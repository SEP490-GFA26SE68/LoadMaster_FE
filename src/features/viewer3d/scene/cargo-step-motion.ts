import { easings } from '@react-spring/three'
import type { ScenePlacement } from '@/features/viewer3d/scene-input'
import type { AnimationQuality } from '../usePerformanceFlags'
import { DROP_HEIGHT } from './cargo-buffers'
import { cargoEntryOffset, ENTRY_DURATION_MS, type CargoInterior } from './cargo-entry'

const DROP_DURATION_MS = 500
export const REDUCED_DROP_HEIGHT = 0.16

/**
 * Chuyển động của kiện ở một bước phát lại xếp hàng: `entry` — vào thùng từ cửa sau theo đường cong (chất lượng `full`, khi nơi
 * gọi đưa lòng thùng); `drop` — rơi ngắn tại chỗ (chất lượng `reduced`, hay khi không có lòng thùng, như khung 3D trang giới thiệu).
 */
export type StepMotion =
  | { id: string; kind: 'drop'; height: number }
  | { id: string; kind: 'entry'; interior: CargoInterior }

export function stepMotionFor(id: string, quality: AnimationQuality, interior: CargoInterior | null | undefined): StepMotion {
  if (quality === 'full' && interior) return { id, kind: 'entry', interior }
  return { id, kind: 'drop', height: quality === 'full' ? DROP_HEIGHT : REDUCED_DROP_HEIGHT }
}

/** Spring `t` 0 → 1: đường vào tự giảm tốc trong `cargoEntryOffset` nên `t` chạy đều; rơi ngắn giảm tốc bằng easing. */
export function stepMotionConfig(motion: StepMotion) {
  return motion.kind === 'entry'
    ? { duration: ENTRY_DURATION_MS, easing: easings.linear }
    : { duration: DROP_DURATION_MS, easing: easings.easeOutCubic }
}

/** Độ dời [dx, dy] (m) so với chỗ cuối ở tiến độ `t`. */
export function stepMotionOffset(motion: StepMotion, placement: ScenePlacement, t: number): [number, number] {
  return motion.kind === 'entry' ? cargoEntryOffset(placement, motion.interior, t) : [0, (1 - t) * motion.height]
}
