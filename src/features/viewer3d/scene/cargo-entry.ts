import type { ScenePlacement } from '@/features/viewer3d/scene-input'
import { toScene } from './units'

/**
 * Đường kiện đi vào thùng ở một bước phát lại xếp hàng (chất lượng `full`): kiện xuất hiện ngay ngoài cửa sau (X lớn), được
 * nhấc cao hơn chỗ đặt, chạy chậm dần vào tới đúng X của nó rồi mới hạ xuống chỗ — hạ cũng chậm dần, chạm chỗ không còn vận tốc.
 * Chỉ là minh hoạ: không va chạm, không né từng kiện; bay cao hơn chỗ đặt để không trông như xuyên qua hàng đã xếp.
 * Hàm thuần, đơn vị cảnh (m); placement là cm, đã áp orientation.
 */

/** Khe giữa cửa sau và mép trước của kiện lúc bắt đầu (m). */
export const ENTRY_GAP_M = 0.15
/** Độ nhấc tối đa trên chỗ đặt (m). */
export const ENTRY_LIFT_MAX_M = 0.35
/** Độ nhấc tối thiểu (m): kiện sát nóc vẫn nhấc chừng này, nên nhô quá nóc thùng tối đa đúng bằng nó. */
export const ENTRY_LIFT_MIN_M = 0.06
export const ENTRY_ROOF_OVERSHOOT_M = ENTRY_LIFT_MIN_M
/** Thời lượng một bước (ms) — AGENTS.md mục 8: 400–700 ms, giảm tốc. */
export const ENTRY_DURATION_MS = 600
/** Phần thời gian kiện chạy theo X; sau mốc này kiện đã ở đúng X. */
const X_END = 0.8
/** Mốc kiện bắt đầu hạ. */
const DESCENT_START = 0.55

export type CargoInterior = { innerLengthCm: number; innerHeightCm: number }
type EntryBox = Pick<ScenePlacement, 'position' | 'lengthCm' | 'heightCm'>

const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
const easeOutCubic = (u: number) => 1 - (1 - u) ** 3
const smoothstep = (u: number) => u * u * (3 - 2 * u)

/** Độ nhấc của kiện khi bay vào: theo khoảng trống tới nóc, kẹp trong [min, max]. */
export function entryLift(p: EntryBox, interior: CargoInterior): number {
  const headroom = toScene(interior.innerHeightCm - p.position.z - p.heightCm)
  return Math.min(ENTRY_LIFT_MAX_M, Math.max(ENTRY_LIFT_MIN_M, headroom))
}

/** Độ dời theo X lúc bắt đầu (m): đưa mép trước của kiện ra ngoài cửa sau một khe. */
export function entryStartDx(p: EntryBox, interior: CargoInterior): number {
  return Math.max(0, toScene(interior.innerLengthCm - p.position.x) + ENTRY_GAP_M)
}

/** Độ dời [dx, dy] (m, theo trục X và Y của cảnh) so với chỗ cuối, ở tiến độ `t` ∈ [0, 1] (ngoài khoảng thì kẹp). */
export function cargoEntryOffset(p: EntryBox, interior: CargoInterior, t: number): [number, number] {
  const u = clamp01(t)
  if (u >= 1) return [0, 0]
  const along = u >= X_END ? 1 : easeOutCubic(u / X_END)
  const dx = along >= 1 ? 0 : entryStartDx(p, interior) * (1 - along)
  const down = u <= DESCENT_START ? 0 : smoothstep((u - DESCENT_START) / (1 - DESCENT_START))
  return [dx, entryLift(p, interior) * (1 - down)]
}
