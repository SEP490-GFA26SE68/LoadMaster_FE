/**
 * "Xoay một vòng" của Planner: camera quay đúng 360° quanh tâm nhìn, theo thời gian thật. Thuần, không Three.js: `CameraRig` gọi mỗi
 * khung hình với thời gian của khung đó rồi xoay camera đúng `step` (rad).
 */

/** Một vòng mất chừng này; máy chạy dưới 4 khung hình mỗi giây mất lâu hơn vì mỗi khung bị kẹp ở `ORBIT_SPIN_MAX_DT`. */
export const ORBIT_SPIN_MS = 9_000
/** Khung hình dài hơn (tab ẩn, GC) chỉ tính chừng này giây: mỗi khung quay tối đa 10°, và máy chạy từ 4 khung hình mỗi giây vẫn xong một vòng đúng giờ. */
export const ORBIT_SPIN_MAX_DT = 0.25

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
