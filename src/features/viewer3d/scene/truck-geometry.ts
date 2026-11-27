import { BoxGeometry, CylinderGeometry, type BufferGeometry } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { SceneMaterials } from './materials'
import { addChassisParts } from './truck-chassis'
import { tintGeometry } from './tint-geometry'
import { CAB_X, type TruckLayout } from './truck-layout'

type Point = [number, number, number]

/** Chi tiết cabin, đuôi xe và khung gầm gộp màu theo đỉnh vào một vật liệu/một draw. Không phải hình học trục thật. */
export function truckDetails(length: number, width: number, layout: TruckLayout, m: SceneMaterials) {
  const parts: BufferGeometry[] = []
  const add = (size: Point, position: Point, color: string) => {
    parts.push(tintGeometry(new BoxGeometry(...size).translate(...position), color))
  }
  const cabX = CAB_X
  const front = cabX - 0.75
  // Lưới tản nhiệt, cản, đèn, tấm che nắng, khung biển số.
  add([0.05, 0.35, width - 0.7], [front - 0.01, 0.84, width / 2], m.chassis)
  for (let i = 0; i < 4; i++) add([0.06, 0.018, width - 0.78], [front - 0.04, 0.71 + i * 0.075, width / 2], m.metal)
  add([0.16, 0.22, width - 0.02], [front - 0.05, 0.39, width / 2], m.metal)
  add([0.17, 0.08, width], [front + 0.2, 2.28, width / 2], m.cab)
  add([0.02, 0.12, 0.38], [front - 0.14, 0.39, width / 2], m.chassis)
  // Cánh gió nóc cabin, năm đèn cờ nóc và hai cần gạt nước trên kính chắn gió.
  // Cánh gió: tấm nghiêng về phía sau trên nóc, hai chân đỡ.
  parts.push(tintGeometry(new BoxGeometry(0.04, 0.8, width - 0.4).rotateZ(-1.28).translate(cabX + 0.2, 2.42, width / 2), m.cab))
  for (const z of [0.4, width - 0.4]) add([0.12, 0.14, 0.04], [cabX + 0.5, 2.36, z], m.chassis)
  for (let i = 0; i < 5; i++) add([0.05, 0.035, 0.09], [front + 0.33, 2.34, width * (0.3 + i * 0.1)], m.marker)
  for (const z of [width * 0.32, width * 0.62]) add([0.015, 0.018, 0.55], [front + 0.03, 1.46, z], m.chassis)
  for (const side of [-1, 1]) {
    const z = side < 0 ? 0 : width
    add([0.045, 0.18, 0.3], [front - 0.04, 0.6, z - side * 0.25], m.light)
    add([0.045, 0.07, 0.12], [front - 0.04, 0.47, z - side * 0.2], m.marker)
    // Kính hông, khe cửa, tay nắm, gương, bậc lên xuống, tay vịn và vè bánh trước.
    add([0.92, 0.63, 0.018], [cabX + 0.12, 1.76, z - side * 0.042], m.windshield)
    add([0.02, 1.52, 0.02], [cabX + 0.65, 1.27, z - side * 0.04], m.skirt)
    add([0.2, 0.045, 0.04], [cabX + 0.43, 1.3, z - side * 0.02], m.chassis)
    add([0.03, 0.7, 0.03], [cabX + 0.7, 1.05, z + side * 0.01], m.metal)
    add([0.04, 0.04, 0.28], [cabX - 0.35, 1.55, z + side * 0.1], m.metal)
    add([0.15, 0.35, 0.1], [cabX - 0.35, 1.67, z + side * 0.25], m.chassis)
    add([0.12, 0.29, 0.015], [cabX - 0.35, 1.67, z + side * 0.305], m.metal)
    for (let i = 0; i < 2; i++) add([0.5, 0.06, 0.24], [cabX + 0.52, 0.18 - i * 0.19, z - side * 0.01], m.metal)
    const steer = layout.axles.find((axle) => axle.kind === 'steer')
    if (steer) {
      add([1.05, 0.04, 0.4], [steer.x, 0.02, z - side * 0.2], m.chassis)
      add([0.04, 0.34, 0.4], [steer.x - 0.52, -0.13, z - side * 0.2], m.chassis)
    }
    // Chắn bùn sau cùng, đèn hậu và đèn phản quang.
    const lastAxle = layout.axles.at(-1)?.x ?? length * 0.72 + 1.15
    add([0.07, 0.54, 0.42], [Math.min(length - 0.05, lastAxle + 0.6), -0.62, z - side * 0.2], m.wheel)
    add([0.06, 0.13, 0.3], [length + 0.12, -0.18, z - side * 0.25], m.tailLight)
    add([0.02, 0.06, 0.1], [length + 0.15, -0.06, z - side * 0.25], m.marker)
  }
  add([0.18, 0.15, width - 0.3], [length + 0.16, -0.65, width / 2], m.metal)
  for (const z of [width * 0.3, width * 0.7]) add([0.06, 0.45, 0.06], [length + 0.1, -0.44, z], m.chassis)
  addChassisParts(parts, layout, length, width, m)
  const geometry = mergeGeometries(parts)!
  parts.forEach((part) => part.dispose())
  return geometry
}

/** Lốp có gai và hông lốp, mâm có lỗ thông gió, moay-ơ và 10 ốc — một hình học instanced cho mọi bánh. */
export function truckWheel(m: SceneMaterials) {
  const parts = [tintGeometry(new CylinderGeometry(0.5, 0.5, 0.3, 32), m.wheel)]
  for (let i = 0; i < 24; i++) {
    const angle = i * Math.PI / 12
    parts.push(tintGeometry(new BoxGeometry(0.018, 0.24, 0.075)
      .rotateY(-angle).translate(Math.cos(angle) * 0.503, 0, Math.sin(angle) * 0.503), m.chassis))
  }
  for (const side of [-1, 1]) {
    parts.push(tintGeometry(new CylinderGeometry(0.44, 0.44, 0.006, 32).translate(0, side * 0.151, 0), m.chassis))
    parts.push(tintGeometry(new CylinderGeometry(0.32, 0.32, 0.02, 24).translate(0, side * 0.158, 0), m.metal))
    parts.push(tintGeometry(new CylinderGeometry(0.14, 0.16, 0.06, 16).translate(0, side * 0.18, 0), m.chassis))
    parts.push(tintGeometry(new CylinderGeometry(0.06, 0.06, 0.03, 10).translate(0, side * 0.215, 0), m.light))
    for (let i = 0; i < 8; i++) {
      const angle = (i + 0.5) * Math.PI / 4
      parts.push(tintGeometry(new CylinderGeometry(0.04, 0.04, 0.024, 8)
        .translate(Math.cos(angle) * 0.25, side * 0.16, Math.sin(angle) * 0.25), m.wheel))
    }
    for (let i = 0; i < 10; i++) {
      const angle = i * Math.PI / 5
      parts.push(tintGeometry(new CylinderGeometry(0.018, 0.018, 0.03, 6)
        .translate(Math.cos(angle) * 0.1, side * 0.2, Math.sin(angle) * 0.1), m.light))
    }
  }
  const geometry = mergeGeometries(parts)!
  parts.forEach((part) => part.dispose())
  return geometry
}

/**
 * Xe bản gọn (tier low, `vehicleDetail: 'simple'`): tấm gầm thùng, hai thanh khung sườn và cản trước — đủ nối cabin với bánh, một draw,
 * vài chục tam giác thay cho hàng chục nghìn của `truckDetails`.
 */
export function truckSimpleDetails(length: number, width: number, layout: TruckLayout, m: SceneMaterials) {
  const { frame } = layout
  const parts = [
    tintGeometry(new BoxGeometry(length, 0.04, width).translate(length / 2, -0.04, width / 2), m.skirt),
    ...frame.railZ.map((z) => tintGeometry(new BoxGeometry(frame.toX - frame.fromX, 0.24, 0.1)
      .translate((frame.fromX + frame.toX) / 2, -0.27, z), m.chassis)),
    tintGeometry(new BoxGeometry(0.16, 0.22, width - 0.02).translate(CAB_X - 0.8, 0.39, width / 2), m.metal),
  ]
  const geometry = mergeGeometries(parts)!
  parts.forEach((part) => part.dispose())
  return geometry
}

/** Bánh bản gọn: lốp trơn và mâm, một hình học instanced cho mọi bánh. */
export function truckWheelSimple(m: SceneMaterials) {
  const parts = [
    tintGeometry(new CylinderGeometry(0.5, 0.5, 0.3, 16), m.wheel),
    tintGeometry(new CylinderGeometry(0.3, 0.3, 0.31, 12), m.metal),
  ]
  const geometry = mergeGeometries(parts)!
  parts.forEach((part) => part.dispose())
  return geometry
}
