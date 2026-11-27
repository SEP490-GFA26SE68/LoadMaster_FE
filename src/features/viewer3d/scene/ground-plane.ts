/**
 * Mặt đất dưới xe (thuần): kích thước mặt phẳng và hình chữ nhật của bóng tiếp xúc trên texture. Mặt đất phủ hộp bao xe cộng
 * `GROUND_MARGIN` mỗi phía và mờ dần ra rìa nên không thấy mép; bóng tiếp xúc là hộp bao xe nhìn từ trên, mép mềm `SHADOW_SOFTNESS`.
 */

/** Hệ góc thùng, m: cao độ mặt đất, từ mũi xe `x0` tới đuôi `x1`, nửa bề rộng quanh tâm ngang `centerZ`. */
export type GroundFootprint = { readonly groundY: number; readonly x0: number; readonly x1: number; readonly halfWidth: number; readonly centerZ: number }

export const GROUND_MARGIN = 7
export const SHADOW_SOFTNESS = 0.45
/** Mặt đất nằm thấp hơn đáy lốp một chút: mặt nhận bóng thật (tier high, `TruckCab`) ở −1 cm phải nằm trên nó. */
export const GROUND_DROP = 0.015
/** Điểm ảnh của texture trên một mét theo chiều dài; chiều ngang theo cùng tỉ lệ, cả hai làm tròn lên lũy thừa 2 không quá 512. */
const TEXTURE_PX = 512

export type GroundLayout = {
  /** Tâm mặt phẳng (hệ góc thùng) và kích thước theo x, z. */
  readonly center: readonly [number, number, number]
  readonly size: readonly [number, number]
  /** Texture: cỡ điểm ảnh và hình chữ nhật bóng (tính theo điểm ảnh, gốc góc trên trái = x nhỏ nhất, z nhỏ nhất). */
  readonly texture: { readonly width: number; readonly height: number }
  readonly shadow: { readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly soft: number }
}

export function groundLayout({ groundY, x0, x1, halfWidth, centerZ }: GroundFootprint): GroundLayout {
  const sizeX = x1 - x0 + GROUND_MARGIN * 2
  const sizeZ = halfWidth * 2 + GROUND_MARGIN * 2
  const width = TEXTURE_PX
  const height = Math.max(64, Math.min(TEXTURE_PX, 2 ** Math.round(Math.log2((TEXTURE_PX * sizeZ) / sizeX))))
  const pxX = width / sizeX, pxZ = height / sizeZ
  return {
    center: [(x0 + x1) / 2, groundY - GROUND_DROP, centerZ],
    size: [sizeX, sizeZ],
    texture: { width, height },
    shadow: { x: GROUND_MARGIN * pxX, y: GROUND_MARGIN * pxZ, width: (x1 - x0) * pxX, height: halfWidth * 2 * pxZ, soft: SHADOW_SOFTNESS * Math.min(pxX, pxZ) },
  }
}
