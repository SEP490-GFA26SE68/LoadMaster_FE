import { BoxGeometry, CylinderGeometry, type BufferGeometry } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { SceneMaterials } from './materials'
import { addCabDetails } from './truck-cab-details'
import { addChassisParts, partAdders } from './truck-chassis'
import { tintGeometry } from './tint-geometry'
import type { TruckLayout } from './truck-layout'

function merged(parts: BufferGeometry[]) {
  const geometry = mergeGeometries(parts)!
  parts.forEach((part) => part.dispose())
  return geometry
}

/**
 * Đuôi xe (cao độ theo mặt đất của hạng): tấm chắn bùn cao su sau bánh cuối kèm thanh treo, cụm đèn hậu (vỏ, đèn đỏ, xi-nhan hổ phách,
 * mắt phản quang tròn), cản sau chống luồn có dải phản quang đỏ / trắng xen kẽ ở mặt sau, khung biển số và chân đỡ cản. Thân có bửng
 * (`layout.tailgate`): cản và đèn nằm sau chỗ bửng thõng xuống, chân đỡ treo dưới đuôi khung sườn rồi chìa ra sau dưới mép bửng.
 */
function addRear(parts: BufferGeometry[], layout: TruckLayout, length: number, width: number, m: SceneMaterials) {
  const { box, cylinder } = partAdders(parts)
  const { wheelY, wheelRadius: r, groundY, rearBumperY: bumperY } = layout
  const truck = layout.profile.cab !== 'van', gate = layout.tailgate !== null
  const lastAxle = layout.axles.at(-1)?.x ?? length * 0.7
  const legTop = layout.frame.y[1]
  const bumperDepth = gate ? 0.14 : 0.18, bumperX = gate ? length + 0.18 : length + 0.16
  const lightX = length + 0.12, lightY = gate ? bumperY + 0.17 : Math.max(bumperY + 0.2, -0.2)
  const guardY = Math.min(-0.02, wheelY + r + 0.05)
  for (const side of [-1, 1]) {
    const z = side < 0 ? 0 : width
    if (truck) {
      const flapX = Math.min(length - 0.06, lastAxle + r * 1.3), flapZ = z - side * 0.36
      const flapTop = guardY - 0.02, flapBottom = groundY + 0.14
      if (flapTop - flapBottom > 0.1) {
        box([0.012, flapTop - flapBottom, 0.5], [flapX, (flapTop + flapBottom) / 2, flapZ], m.wheel)
        box([0.035, 0.035, 0.56], [flapX - 0.02, flapTop, flapZ], m.chassis)
      }
    }
    const lz = z - side * 0.25
    box([0.05, 0.16, 0.36], [lightX, lightY, lz], m.chassis)
    box([0.012, 0.11, 0.15], [lightX + 0.031, lightY, lz + side * 0.08], m.tailLight)
    box([0.012, 0.11, 0.1], [lightX + 0.031, lightY, lz - side * 0.1], m.marker)
    cylinder(0.032, 0.012, 'x', [lightX + 0.031, lightY - 0.13, lz], m.tailLight, 12)
  }
  box([bumperDepth, 0.15, width - 0.3], [bumperX, bumperY, width / 2], m.metal)
  const stripes = Math.max(2, Math.round((width - 0.4) / 0.22)), stripe = (width - 0.4) / stripes
  for (let i = 0; i < stripes; i++) {
    box([0.006, 0.07, stripe * 0.92], [bumperX + bumperDepth / 2 + 0.003, bumperY, 0.2 + stripe * (i + 0.5)], i % 2 ? m.light : m.tailLight)
  }
  // Khung giữ biển số trên cản (biển là tấm riêng `LicensePlate`, chỉ khi tên xe có biển số).
  box([0.08, 0.15, 0.58], [length + 0.155, Math.min(-0.105, bumperY + 0.17), width / 2], m.chassis)
  if (legTop - bumperY <= 0.1) return
  const legX = gate ? length - 0.04 : length + 0.1, bumperFront = bumperX - bumperDepth / 2
  for (const z of [width * 0.3, width * 0.7]) {
    box([0.06, legTop - bumperY, 0.06], [legX, (legTop + bumperY) / 2, z], m.chassis)
    if (gate) box([bumperFront - legX + 0.03, 0.05, 0.06], [(legX - 0.03 + bumperFront) / 2, bumperY, z], m.chassis)
  }
}

/** Dàn lạnh ngoài vách trước (xe khai vật cản `COOLING_UNIT`): vỏ, mặt quạt tối, hai quạt và khe gió. */
function addReefer(parts: BufferGeometry[], layout: TruckLayout, m: SceneMaterials) {
  if (!layout.reefer) return
  const { box, cylinder } = partAdders(parts)
  const { x, y, z } = layout.reefer
  const cx = (x[0] + x[1]) / 2, cy = (y[0] + y[1]) / 2, cz = (z[0] + z[1]) / 2
  const sx = x[1] - x[0], sy = y[1] - y[0], sz = z[1] - z[0]
  box([sx, sy, sz], [cx, cy, cz], m.light)
  box([0.02, sy * 0.72, sz * 0.86], [x[0] - 0.005, cy, cz], m.chassis)
  const fan = Math.min(sy * 0.3, sz * 0.18)
  for (const dz of [-0.24, 0.24]) cylinder(fan, 0.02, 'x', [x[0] - 0.015, cy, cz + sz * dz], m.metal, 20)
  for (let i = 0; i < 3; i++) box([0.022, 0.012, sz * 0.8], [x[0] - 0.02, y[0] + sy * (0.12 + i * 0.04), cz], m.metal)
}

/** Chi tiết cabin, đuôi xe, dàn lạnh và khung gầm gộp màu theo đỉnh vào một vật liệu/một draw. Không phải hình học trục thật. */
export function truckDetails(length: number, width: number, layout: TruckLayout, m: SceneMaterials) {
  const parts: BufferGeometry[] = []
  addCabDetails(parts, layout, width, m)
  addRear(parts, layout, length, width, m)
  addReefer(parts, layout, m)
  addChassisParts(parts, layout, length, width, m)
  return merged(parts)
}

/** Lốp dựng ở bán kính 0,5 m, rộng 0,3 m rồi co theo cỡ bánh của hạng (trục trụ là y trước khi dựng đứng). */
const BASE_RADIUS = 0.5, BASE_WIDTH = 0.3
const sized = (geometry: BufferGeometry, layout: TruckLayout) =>
  geometry.scale(layout.wheelRadius / BASE_RADIUS, layout.tireWidth / BASE_WIDTH, layout.wheelRadius / BASE_RADIUS)

/** Lốp có gai và hông lốp, mâm có lỗ thông gió, moay-ơ và 10 ốc — một hình học instanced cho mọi bánh. */
export function truckWheel(layout: TruckLayout, m: SceneMaterials) {
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
  return sized(merged(parts), layout)
}

/**
 * Xe bản gọn (tier low, `vehicleDetail: 'simple'`): tấm gầm thùng, hai thanh khung sườn, cản trước và ga-lăng tối — đủ nối cabin với
 * bánh theo đúng cao độ của hạng, một draw, vài chục tam giác thay cho hàng chục nghìn của `truckDetails`.
 */
export function truckSimpleDetails(length: number, width: number, layout: TruckLayout, m: SceneMaterials) {
  const { frame, cab } = layout
  const [railTop, railBottom] = frame.y
  const bumperBottom = Math.max(layout.groundY + 0.22, layout.wheelY - layout.wheelRadius * 0.1)
  const cabW = cab.z[1] - cab.z[0]
  const parts = [
    tintGeometry(new BoxGeometry(length, 0.04, width).translate(length / 2, -0.04, width / 2), m.skirt),
    ...frame.railZ.map((z) => tintGeometry(new BoxGeometry(frame.toX - frame.fromX, railTop - railBottom, 0.1)
      .translate((frame.fromX + frame.toX) / 2, (railTop + railBottom) / 2, z), m.chassis)),
    tintGeometry(new BoxGeometry(0.16, cab.bottomY + 0.06 - bumperBottom, cabW)
      .translate(cab.frontX - 0.04, (cab.bottomY + 0.06 + bumperBottom) / 2, width / 2), m.metal),
    tintGeometry(new BoxGeometry(0.04, (cab.beltY - cab.bottomY) * 0.38, cabW * 0.6)
      .translate(cab.frontX - 0.01, cab.bottomY + (cab.beltY - cab.bottomY) * 0.46, width / 2), m.chassis),
  ]
  return merged(parts)
}

/** Bánh bản gọn: lốp trơn và mâm, một hình học instanced cho mọi bánh. */
export function truckWheelSimple(layout: TruckLayout, m: SceneMaterials) {
  const parts = [
    tintGeometry(new CylinderGeometry(0.5, 0.5, 0.3, 16), m.wheel),
    tintGeometry(new CylinderGeometry(0.3, 0.3, 0.31, 12), m.metal),
  ]
  return sized(merged(parts), layout)
}
