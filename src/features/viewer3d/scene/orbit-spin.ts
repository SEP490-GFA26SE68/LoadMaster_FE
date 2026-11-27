/**
 * "Xoay một vòng" của Planner: camera quay đúng 360° quanh tâm nhìn, theo thời gian thật. Thuần, không Three.js: `CameraRig` gọi mỗi
 * khung hình với thời gian của khung đó rồi xoay camera đúng `step` (rad).
 */

/** Một vòng mất chừng này ở tốc độ khung hình bình thường; máy chậm mất lâu hơn vì mỗi khung bị kẹp ở `ORBIT_SPIN_MAX_DT`. */
export const ORBIT_SPIN_MS = 9_000
/** Khung hình dài hơn (tab ẩn, máy chậm, GC) chỉ tính chừng này giây: camera không nhảy một đoạn lớn. */
export const ORBIT_SPIN_MAX_DT = 0.1

const TURN = Math.PI * 2

/**
 * Góc quay của khung hình kế tiếp khi đã quay `rotated` rad và khung này dài `dtSeconds`. Bước cuối đúng bằng phần còn lại, nên tổng các
 * bước là đúng một vòng và camera dừng ở tư thế ban đầu.
 */
export function orbitSpinStep(rotated: number, dtSeconds: number): { step: number; done: boolean } {
  if (!(dtSeconds > 0)) return { step: 0, done: false }
  const step = (TURN * Math.min(dtSeconds, ORBIT_SPIN_MAX_DT) * 1000) / ORBIT_SPIN_MS
  const remaining = TURN - rotated
  return step >= remaining ? { step: remaining, done: true } : { step, done: false }
}
