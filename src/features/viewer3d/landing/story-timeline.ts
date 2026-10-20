import { fillStep, LANDING_FILL_MS } from '../landing-fill'

/**
 * Kịch bản chuyện trong khung 3D trang giới thiệu: hàm thuần của thời gian (ms tính từ lúc chuyện bắt đầu, xem `story-clock`).
 * Không Three.js — cảnh đọc các hàm này trong `useFrame`, trang giới thiệu đọc `phaseAt` / `loadedCount` cho thẻ chuyến và lời Lumo.
 *
 *   0–2 s   nhập kiện: bốn làn chờ đầy dần, mỗi tầng hộp rơi nhẹ xuống chỗ của nó
 *   2–4 s   tối ưu: một mặt sáng quét dọc thùng; dải vùng điểm giao hiện ra từ 3,4 s
 *   4–9 s   xếp: kiện rời làn đúng lúc hiện trong thùng, theo `loadingOrder` (`fillStep`)
 *   ≥ 9 s   xếp xong, đứng yên
 */

export type StoryPhase = 'intake' | 'optimize' | 'loading' | 'ready'

export const OPTIMIZE_AT = 2000
export const LOADING_AT = 4000
/** Dải vùng điểm giao bật từ mốc này (cũng là lúc mặt quét tới cửa sau). */
export const ZONES_AT = 3400
/** Độ dài cả chuyện: pha xếp kết thúc đúng lúc `fillStep` xếp xong. */
export const STORY_MS = LOADING_AT + LANDING_FILL_MS

/** Một tầng hộp rơi từ chừng này mét trên chỗ nằm, trong chừng này ms. */
export const LANE_DROP_M = 0.5
export const LANE_DROP_MS = 250
const LANE_START_MS = 200
const LANE_STAGGER_MS = 250
const LAYER_STAGGER_MS = 180

const SWEEP_FROM_MS = 2200
const SWEEP_FADE_MS = 150
/** Chiều dài thùng của chuyến mẫu (m): mặt quét đi từ vách trước tới cửa sau. */
const SWEEP_LENGTH_M = 6

export function phaseAt(timeMs: number): StoryPhase {
  if (timeMs >= STORY_MS) return 'ready'
  if (timeMs >= LOADING_AT) return 'loading'
  if (timeMs >= OPTIMIZE_AT) return 'optimize'
  return 'intake'
}

/** Số kiện đã nằm trong thùng: 0 trước pha xếp, đủ `total` từ `STORY_MS`. */
export function loadedCount(total: number, timeMs: number): number {
  return fillStep(total, timeMs - LOADING_AT, LANDING_FILL_MS)
}

/** Mốc (ms) tầng `layer` (0 = tầng đáy) của làn `lane` (0 = điểm giao đầu) bắt đầu rơi; trước mốc này tầng đó chưa có trên làn. */
export function laneArrival(lane: number, layer: number): number {
  return LANE_START_MS + LANE_STAGGER_MS * lane + LAYER_STAGGER_MS * layer
}

/** Độ cao còn lại trên chỗ nằm (m): 0,5 tới mốc rơi, rồi giảm chậm dần (easeOutCubic) về 0 sau 250 ms. */
export function laneDrop(lane: number, layer: number, timeMs: number): number {
  const progress = (timeMs - laneArrival(lane, layer)) / LANE_DROP_MS
  if (progress <= 0) return LANE_DROP_M
  if (progress >= 1) return 0
  return LANE_DROP_M * (1 - progress) ** 3
}

/** Hoành độ (m, tính từ vách trước) của mặt quét; `null` ngoài 2,2–3,4 s. Đi chậm ở hai đầu. */
export function sweepX(timeMs: number, lengthM = SWEEP_LENGTH_M): number | null {
  if (!(timeMs >= SWEEP_FROM_MS && timeMs <= ZONES_AT)) return null
  const progress = (timeMs - SWEEP_FROM_MS) / (ZONES_AT - SWEEP_FROM_MS)
  return lengthM * (1 - Math.cos(Math.PI * progress)) / 2
}

/** Độ đậm (0–1) của mặt quét: hiện dần 150 ms đầu, tắt dần 150 ms cuối, 0 ngoài lúc quét. */
export function sweepFade(timeMs: number): number {
  if (sweepX(timeMs) === null) return 0
  return Math.min(1, (timeMs - SWEEP_FROM_MS) / SWEEP_FADE_MS, (ZONES_AT - timeMs) / SWEEP_FADE_MS)
}
