import { fillStep, LANDING_FILL_MS } from '../landing-fill'

/**
 * Kịch bản chuyện trong khung 3D trang giới thiệu: hàm thuần của thời gian (ms tính từ lúc chuyện bắt đầu, xem `story-clock`).
 * Không Three.js — cảnh đọc các hàm này trong `useFrame`, trang giới thiệu đọc `phaseAt` / `loadedCount` cho thẻ chuyến và lời Lumo.
 *
 *   0–2 s    nhập kiện: bốn làn chờ đầy dần, mỗi tầng hộp rơi nhẹ xuống chỗ của nó
 *   2–4 s    tối ưu: một mặt sáng quét dọc thùng; dải vùng điểm giao hiện ra từ 3,4 s
 *   4–9 s    xếp: kiện rời làn đúng lúc hiện trong thùng, theo `loadingOrder` (`fillStep`)
 *   9–11 s   xếp xong, chờ xuất phát
 *   11–15 s  xuất phát: cửa thùng đóng, nổ máy (khói ở ống xả), xe lăn bánh 1,3 m về phía đầu xe, nhún một nhịp rồi đứng yên
 *
 * Giảm chuyển động dừng chuyện ở `READY_AT` (`story-clock` `finish`): xe đứng chỗ cũ, cửa mở, không lăn bánh, không khói.
 */

export type StoryPhase = 'intake' | 'optimize' | 'loading' | 'ready' | 'depart'

export const OPTIMIZE_AT = 2000
export const LOADING_AT = 4000
/** Dải vùng điểm giao bật từ mốc này (cũng là lúc mặt quét tới cửa sau). */
export const ZONES_AT = 3400
/** Xếp xong: pha xếp kết thúc đúng lúc `fillStep` xếp xong. Giảm chuyển động dừng chuyện ở đây. */
export const READY_AT = LOADING_AT + LANDING_FILL_MS
/** Xuất phát: hai cánh cửa thùng quay về (lò xo 500 ms của `ContainerDoor`). */
export const DEPART_AT = READY_AT + 2000
/** Nổ máy: cụm khói đầu tiên ở ống xả (`exhaust-smoke`). */
export const ENGINE_AT = DEPART_AT + 500
/** Xe lăn bánh trong `ROLL_MS`, đi đúng `DEPART_M` mét về phía đầu xe (−x). */
export const ROLL_AT = ENGINE_AT + 400
export const ROLL_MS = 2200
export const DEPART_M = 1.3
/** Sau khi dừng, thân xe nhún nốt một nhịp; khói tan hết trước cuối chuyện (`exhaust-smoke`). */
const SETTLE_MS = 900
/** Độ dài cả chuyện: xe đã dừng, thân xe đứng yên, khói tan hết. */
export const STORY_MS = ROLL_AT + ROLL_MS + SETTLE_MS
/** Thân xe chúi tối đa (rad) lúc vừa lăn bánh và lúc phanh. */
const PITCH_RAD = 0.012

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
  if (timeMs >= DEPART_AT) return 'depart'
  if (timeMs >= READY_AT) return 'ready'
  if (timeMs >= LOADING_AT) return 'loading'
  if (timeMs >= OPTIMIZE_AT) return 'optimize'
  return 'intake'
}

/** Số kiện đã nằm trong thùng: 0 trước pha xếp, đủ `total` từ `READY_AT`. */
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

/** Cửa thùng đã đóng chưa: từ `DEPART_AT` (cánh cửa tự quay về trong 500 ms). */
export function doorsShut(timeMs: number): boolean {
  return timeMs >= DEPART_AT
}

const unitAt = (timeMs: number, from: number, span: number) => Math.min(1, Math.max(0, (timeMs - from) / span))

/** Quãng xe đã lăn (m, ≥ 0) về phía đầu xe: 0 trước `ROLL_AT`, tăng tốc rồi giảm tốc êm (nửa chu kỳ cos), đủ `DEPART_M` từ cuối lần lăn. */
export function departDistance(timeMs: number): number {
  return DEPART_M * (1 - Math.cos(Math.PI * unitAt(timeMs, ROLL_AT, ROLL_MS))) / 2
}

/**
 * Góc chúi của thân xe (rad, quanh trục ngang z): âm là đầu xe ngóc lên (đuôi nhún) lúc vừa lăn bánh, dương là đầu chúi xuống lúc phanh
 * rồi nảy ngược một nhịp nhỏ. Mỗi nhịp về đúng 0 ở hai đầu nên thân xe không giật; ngoài hai nhịp là 0.
 */
export function departPitch(timeMs: number): number {
  const launch = unitAt(timeMs, ROLL_AT, 700)
  const stop = unitAt(timeMs, ROLL_AT + ROLL_MS - 300, 900)
  return -PITCH_RAD * Math.sin(Math.PI * launch) + 0.8 * PITCH_RAD * Math.sin(2 * Math.PI * stop) * (1 - stop)
}
