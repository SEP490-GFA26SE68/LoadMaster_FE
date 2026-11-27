import type { BufferGeometry } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { SceneMaterials } from './materials'
import { partAdders } from './truck-chassis'

/** Cánh cửa sau: `box` thùng kín (tôn 3 cm), `reefer` đông lạnh (cách nhiệt 6 cm). */
export type DoorVariant = 'box' | 'reefer'
export const DOOR_LEAF: Record<DoorVariant, number> = { box: 0.03, reefer: 0.06 }

/**
 * Phụ kiện mặt ngoài của một cánh (hệ của cánh: bản lề trên trục y qua gốc, cánh nằm ở x ∈ [0, dày], z ∈ side × [0, rộng cánh]) gộp
 * **một** hình học màu theo đỉnh: mỗi cánh hai thanh khoá tròn kiểu container (cả cửa bốn thanh) có tai giữ trên / dưới và tay khoá,
 * bản lề kèm chốt (thùng kín ba, đông lạnh bốn); thùng kín thêm nẹp khung cánh, đông lạnh thêm gioăng tối quanh mép.
 */
export function doorHardware(height: number, width: number, side: -1 | 1, variant: DoorVariant, m: SceneMaterials): BufferGeometry {
  const parts: BufferGeometry[] = []
  const { box, cylinder } = partAdders(parts)
  const face = DOOR_LEAF[variant], leaf = width / 2
  const at = (z: number) => z * side
  if (variant === 'box') {
    for (const z of [0.04, leaf - 0.04]) box([0.025, height, 0.05], [face + 0.005, height / 2, at(z)], m.skirt)
    for (const y of [0.04, height - 0.04]) box([0.025, 0.05, leaf], [face + 0.005, y, at(leaf / 2)], m.skirt)
  } else {
    for (const y of [0.0125, height - 0.0125]) box([0.008, 0.025, leaf], [face + 0.004, y, at(leaf / 2)], m.chassis)
    box([0.008, height, 0.025], [face + 0.004, height / 2, at(leaf - 0.0125)], m.chassis)
  }
  for (const z of [leaf * 0.28, leaf * 0.72]) {
    cylinder(0.016, Math.max(0.1, height - 0.16), 'y', [face + 0.03, height / 2, at(z)], m.metal, 10)
    for (const y of [0.06, height - 0.06]) box([0.045, 0.05, 0.06], [face + 0.022, y, at(z)], m.metal)
    box([0.03, 0.06, 0.05], [face + 0.02, height * 0.42, at(z)], m.chassis)
    box([0.035, 0.035, 0.18], [face + 0.06, height * 0.42, at(z + 0.07)], m.metal)
  }
  for (const k of variant === 'reefer' ? [0.12, 0.38, 0.62, 0.88] : [0.15, 0.5, 0.85]) {
    box([0.02, 0.12, 0.14], [face + 0.01, height * k, at(0.07)], m.metal)
    cylinder(0.014, 0.14, 'y', [face + 0.014, height * k, at(0.012)], m.chassis, 8)
  }
  const geometry = mergeGeometries(parts)!
  parts.forEach((part) => part.dispose())
  return geometry
}
