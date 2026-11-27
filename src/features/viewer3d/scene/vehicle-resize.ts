import type { Vec3 } from './units'

/**
 * Đổi cỡ thùng mượt khi xe đổi kích thước lòng thùng (form xe, đổi xe): geometry mới dựng một lần như mọi lần, rồi nhóm thùng được
 * co / giãn từ tỉ lệ cũ ÷ mới về 1, neo ở góc thùng (vách trước x = 0, sàn y = 0, vách trái z = 0), còn cả cảnh dời theo tâm của thùng
 * đang hiện — nên thùng luôn nằm giữa gốc toạ độ, như camera đang canh. Thuần, không Three.js; đơn vị scene (m).
 */

/** Ba kích thước lòng thùng theo trục scene: x dài, y cao, z ngang. */
export type SceneBox = { readonly length: number; readonly height: number; readonly width: number }

export const VEHICLE_RESIZE_MS = 500
/** Mọi trục đổi ít hơn chừng này (0,5 cm) thì nhảy thẳng: không có gì để thấy. */
export const RESIZE_MIN_DELTA = 0.005
/** Tỉ lệ cũ ÷ mới vượt khỏi [1/5, 5] ở một trục thì nhảy thẳng: thường là số đang gõ dở ở form xe, co giãn cả quãng đó trông như lỗi. */
export const RESIZE_MAX_RATIO = 5

const usable = (box: SceneBox) => [box.length, box.height, box.width].every((v) => Number.isFinite(v) && v > 0)

/**
 * Tỉ lệ đầu (cũ ÷ mới theo x, y, z) của lần đổi cỡ từ thùng đang hiện `from` sang thùng mới `to`; `null` là nhảy thẳng — lần dựng đầu,
 * cỡ không dùng được, đổi quá nhỏ hoặc quá lớn. Đổi hạng xe (cabin, trục, chiều cao sàn) không đổi gì ở đây: hình xe nhảy sang hạng
 * mới, thùng vẫn đổi cỡ mượt.
 */
export function resizeStart(from: SceneBox | null, to: SceneBox): Vec3 | null {
  if (!from || !usable(from) || !usable(to)) return null
  const pairs: [number, number][] = [[from.length, to.length], [from.height, to.height], [from.width, to.width]]
  if (pairs.every(([a, b]) => Math.abs(a - b) < RESIZE_MIN_DELTA)) return null
  const ratios = pairs.map(([a, b]) => a / b) as Vec3
  return ratios.every((r) => r <= RESIZE_MAX_RATIO && r >= 1 / RESIZE_MAX_RATIO) ? ratios : null
}

/** Thùng đang hiện khi nhóm thùng của thùng `to` mang tỉ lệ `scale`. */
export function visualBox(to: SceneBox, scale: Vec3): SceneBox {
  return { length: to.length * scale[0], height: to.height * scale[1], width: to.width * scale[2] }
}

/**
 * Tư thế ở tiến độ `t` (0 → 1, đã qua easing): tỉ lệ của nhóm thùng đi thẳng từ `start` về 1, và độ dời của cả cảnh là âm tâm thùng
 * đang hiện. `t = 1` trả đúng tỉ lệ 1 và đúng âm tâm thùng mới, để raycast và bounds không lệch khi chuyển động xong.
 */
export function resizePose(start: Vec3, to: SceneBox, t: number): { scale: Vec3; offset: Vec3 } {
  if (t >= 1) return { scale: [1, 1, 1], offset: [-to.length / 2, -to.height / 2, -to.width / 2] }
  const scale = start.map((s) => s + (1 - s) * t) as Vec3
  const box = visualBox(to, scale)
  return { scale, offset: [-box.length / 2, -box.height / 2, -box.width / 2] }
}
