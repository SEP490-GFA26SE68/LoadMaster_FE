import { fillStep, LANDING_FILL_MS } from '../landing-fill'

/**
 * Kịch bản chuyện trong khung 3D trang giới thiệu: hàm thuần của thời gian (ms tính từ lúc chuyện bắt đầu, xem `story-clock`).
 * Không Three.js — cảnh đọc các hàm này trong `useFrame`, trang giới thiệu đọc `phaseAt` / `loadedCount` / `unloadedCount` cho thẻ chuyến
 * và lời Lumo.
 *
 *   0–2 s    nhập kiện: bốn làn chờ đầy dần, mỗi tầng hộp rơi nhẹ xuống chỗ của nó
 *   2–4 s    tối ưu: một mặt sáng quét dọc thùng; dải vùng điểm giao hiện ra từ 3,4 s
 *   4–9 s    xếp: kiện rời làn đúng lúc hiện trong thùng, theo `loadingOrder` (`fillStep`)
 *   9–11 s   xếp xong, chờ xuất phát
 *   11–15 s  xuất phát: cửa thùng đóng, nổ máy (khói ở ống xả), xe lăn bánh 1,3 m về phía đầu xe, nhún một nhịp rồi đứng yên
 *   15–19 s  tới điểm 1: khung tối dần (thẻ "Tới điểm 1" giữa khung), sáng lại, xe lùi 1,3 m vào chỗ dỡ, cửa thùng mở
 *   19–23 s  dỡ: chỉ kiện của điểm 1 rời thùng, đúng `unloadingOrder` của phương án, thành chồng hàng ở làn của điểm 1
 *   23–24 s  đã giao điểm 1
 *
 * Giảm chuyển động dừng chuyện ở `READY_AT` (`story-clock` `finish`): xe đứng chỗ cũ, cửa mở, không lăn bánh, không khói, không dỡ.
 */

export type StoryPhase = 'intake' | 'optimize' | 'loading' | 'ready' | 'depart' | 'arrive' | 'unload' | 'delivered'

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
/** Sau khi dừng, thân xe nhún nốt một nhịp; khói tan hết trước `ARRIVE_AT` (`exhaust-smoke`). */
const SETTLE_MS = 900
/** Tới điểm 1: khung bắt đầu tối dần — xe đã dừng, thân xe đứng yên, khói đã tan. */
export const ARRIVE_AT = ROLL_AT + ROLL_MS + SETTLE_MS
/** Khung tối dần trong chừng này ms, tối hẳn tới `BACK_AT` (đủ đọc thẻ "Tới điểm 1"), rồi sáng lại trong `DIM_OUT_MS`. */
const DIM_IN_MS = 500
const DIM_HOLD_MS = 1500
const DIM_OUT_MS = 600
/** Xe lùi đúng `DEPART_M` mét vào chỗ dỡ (đuôi xe sát làn, như lúc xếp) trong `BACK_MS`, bắt đầu lúc khung sáng lại. */
export const BACK_AT = ARRIVE_AT + DIM_IN_MS + DIM_HOLD_MS
export const BACK_MS = 1600
/** Xe đã vào chỗ dỡ. */
export const DOCK_AT = BACK_AT + BACK_MS
/** Hai cánh cửa thùng mở ra (lò xo 500 ms của `ContainerDoor`). */
export const DOORS_OPEN_AT = DOCK_AT + 200
/** Dỡ: kiện của điểm 1 rời thùng lần lượt theo `unloadingOrder` trong `UNLOAD_MS` (`fillStep`). */
export const UNLOAD_AT = DOORS_OPEN_AT + 600
export const UNLOAD_MS = 3200
/** Đã giao điểm 1: kiện cuối của điểm đã ra khỏi thùng. */
export const DELIVERED_AT = UNLOAD_AT + UNLOAD_MS
/** Độ dài cả chuyện: hộp cuối đã nằm trên chồng hàng ở làn, thẻ chuyến và Lumo kịp nói đã giao. */
export const STORY_MS = DELIVERED_AT + 1000
/** Thân xe chúi tối đa (rad) lúc vừa lăn bánh và lúc phanh. */
const PITCH_RAD = 0.012

/** Một tầng hộp rơi từ chừng này mét trên chỗ nằm, trong chừng này ms. */
export const LANE_DROP_M = 0.5
export const LANE_DROP_MS = 250
const LANE_START_MS = 200
const LANE_STAGGER_MS = 250
const LAYER_STAGGER_MS = 180
/** Hộp dỡ xuống làn rơi từ chừng này mét trên chỗ nằm trong `LANE_DROP_MS`. */
export const UNLOAD_DROP_M = 0.3

const SWEEP_FROM_MS = 2200
const SWEEP_FADE_MS = 150
/** Chiều dài thùng của chuyến mẫu (m): mặt quét đi từ vách trước tới cửa sau. */
const SWEEP_LENGTH_M = 6

export function phaseAt(timeMs: number): StoryPhase {
  if (timeMs >= DELIVERED_AT) return 'delivered'
  if (timeMs >= UNLOAD_AT) return 'unload'
  if (timeMs >= ARRIVE_AT) return 'arrive'
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

/** Số kiện của điểm 1 đã ra khỏi thùng: 0 trước `UNLOAD_AT`, đủ `total` từ `DELIVERED_AT`. */
export function unloadedCount(total: number, timeMs: number): number {
  return fillStep(total, timeMs - UNLOAD_AT, UNLOAD_MS)
}

/** Mốc (ms) kiện thứ `rank` (0 = ra đầu tiên) trong `total` kiện của điểm 1 rời thùng: nghịch đảo của `unloadedCount`. */
export function unloadArrival(rank: number, total: number): number {
  return UNLOAD_AT + (rank * UNLOAD_MS) / Math.max(1, total)
}

/** Độ cao còn lại (m) của hộp dỡ thứ `rank` trên chỗ nằm ở làn: rơi chậm dần trong `LANE_DROP_MS` kể từ lúc rời thùng. */
export function unloadDrop(rank: number, total: number, timeMs: number): number {
  const progress = (timeMs - unloadArrival(rank, total)) / LANE_DROP_MS
  if (progress <= 0) return UNLOAD_DROP_M
  if (progress >= 1) return 0
  return UNLOAD_DROP_M * (1 - progress) ** 3
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

/** Cửa thùng đóng từ `DEPART_AT` tới `DOORS_OPEN_AT` (cánh cửa tự quay trong 500 ms); ngoài khoảng đó cửa mở. */
export function doorsShut(timeMs: number): boolean {
  return timeMs >= DEPART_AT && timeMs < DOORS_OPEN_AT
}

const unitAt = (timeMs: number, from: number, span: number) => Math.min(1, Math.max(0, (timeMs - from) / span))
/** Nửa chu kỳ cos: tăng tốc rồi giảm tốc êm, 0 → 1. */
const ease = (unit: number) => (1 - Math.cos(Math.PI * unit)) / 2

/** Quãng xe đã lăn (m, ≥ 0) về phía đầu xe lúc rời kho: 0 trước `ROLL_AT`, đủ `DEPART_M` từ cuối lần lăn. */
export function departDistance(timeMs: number): number {
  return DEPART_M * ease(unitAt(timeMs, ROLL_AT, ROLL_MS))
}

/** Xe đang cách chỗ đứng lúc xếp bao nhiêu mét về phía đầu xe: lăn ra `DEPART_M` lúc rời kho, lùi về 0 khi vào chỗ dỡ của điểm 1. */
export function truckOffset(timeMs: number): number {
  return departDistance(timeMs) - DEPART_M * ease(unitAt(timeMs, BACK_AT, BACK_MS))
}

/** Một nhịp chúi về đúng 0 ở hai đầu: lên rồi xuống (`sin`), hoặc nảy ngược một nhịp nhỏ (`sin 2π` tắt dần). */
const nod = (unit: number) => Math.sin(Math.PI * unit)
const bounce = (unit: number) => Math.sin(2 * Math.PI * unit) * (1 - unit)

/**
 * Góc chúi của thân xe (rad, quanh trục ngang z): âm là đầu xe ngóc lên (đuôi nhún), dương là đầu chúi xuống. Rời kho: ngóc lúc vừa lăn
 * bánh, chúi lúc phanh rồi nảy ngược. Lùi vào chỗ dỡ: ngược chiều — chúi nhẹ lúc bắt đầu lùi, ngóc nhẹ lúc dừng. Mỗi nhịp về đúng 0 ở
 * hai đầu nên thân xe không giật; ngoài các nhịp là 0.
 */
export function departPitch(timeMs: number): number {
  const launch = unitAt(timeMs, ROLL_AT, 700)
  const stop = unitAt(timeMs, ROLL_AT + ROLL_MS - 300, 900)
  const back = unitAt(timeMs, BACK_AT, 700)
  const dock = unitAt(timeMs, DOCK_AT - 300, 900)
  return PITCH_RAD * (-nod(launch) + 0.8 * bounce(stop) + 0.6 * nod(back) - 0.5 * bounce(dock))
}

/** Độ tối (0–1) của khung lúc chuyển cảnh tới điểm 1: tối dần từ `ARRIVE_AT`, tối hẳn tới `BACK_AT`, sáng lại trong 600 ms. */
export function arriveDim(timeMs: number): number {
  return Math.min(unitAt(timeMs, ARRIVE_AT, DIM_IN_MS), 1 - unitAt(timeMs, BACK_AT, DIM_OUT_MS))
}

/** Từ mốc này sân kho là chỗ dỡ của điểm 1 (làn chỉ còn hàng đã dỡ): đổi cảnh lúc khung tối hẳn, người xem không thấy làn đổi. */
export const STOP_SCENE_AT = ARRIVE_AT + DIM_IN_MS

/** Điểm giao mà chuyện dừng lại dỡ hàng: điểm đầu của tuyến. */
export const UNLOAD_STOP = 1
