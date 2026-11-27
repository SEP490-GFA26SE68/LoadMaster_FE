/**
 * DPR theo trạng thái cảnh (thuần, không React / Three.js). Lúc chuyển động cảnh vẽ ở DPR của tier (`dpr` của `PerformanceFlags`);
 * khi demand loop đã dừng (`isSceneIdle`) thì vẽ lại **một** khung nét ở `restDprOf`, rồi về DPR của tier khi cảnh chạy liên tục lại.
 * Tier `low` (0,5) là nơi duy nhất hai mức khác nhau; tier khác vốn đã vẽ ít nhất bằng mức nghỉ nên không đổi gì.
 */

/** DPR tối đa của khung nét lúc nghỉ: đủ nét trên màn 2× mà không tốn bằng DPR gốc. */
export const REST_DPR_MAX = 1.5

export type DprRange = readonly [number, number]
export type DprPhase = 'moving' | 'resting'
/**
 * `frame`: một khung vừa vẽ xong, `requestsNext` khi nó đã xin khung kế (chuyển động liên tục). Khung lẻ (bấm chọn kiện, khung nét
 * vừa đổi DPR, Canvas dựng lại) không xin khung kế nên không đưa cảnh về `moving` — nhờ vậy khung nét không tự kích hoạt lại chính nó.
 * `idle`: demand loop đã dừng đủ lâu.
 */
export type DprEvent = { kind: 'frame'; requestsNext: boolean } | { kind: 'idle' }

/** Đúng phép kẹp của R3F (`calculateDpr`) cho một khoảng DPR. */
export function motionDprOf([min, max]: DprRange, devicePixelRatio: number): number {
  return Math.min(Math.max(min, devicePixelRatio), max)
}

/** DPR của khung nét lúc nghỉ: không bao giờ thấp hơn DPR lúc chuyển động, không vượt DPR thiết bị hay `REST_DPR_MAX`. */
export function restDprOf(range: DprRange, devicePixelRatio: number): number {
  return Math.max(motionDprOf(range, devicePixelRatio), Math.min(devicePixelRatio, REST_DPR_MAX))
}

export function nextDprPhase(phase: DprPhase, event: DprEvent): DprPhase {
  if (event.kind === 'idle') return 'resting'
  return event.requestsNext ? 'moving' : phase
}

export function targetDprOf(phase: DprPhase, range: DprRange, devicePixelRatio: number): number {
  return phase === 'resting' ? restDprOf(range, devicePixelRatio) : motionDprOf(range, devicePixelRatio)
}
