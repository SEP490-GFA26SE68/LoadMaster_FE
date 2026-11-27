import { BoxGeometry, CylinderGeometry, SphereGeometry, type BufferGeometry } from 'three'
import type { SceneMaterials } from './materials'
import type { TruckLayout } from './truck-layout'
import { tintGeometry } from './tint-geometry'

export type Point = [number, number, number]

/** Hộp và trụ tô màu theo đỉnh, đẩy vào danh sách gộp. */
export function partAdders(parts: BufferGeometry[]) {
  const box = (size: Point, position: Point, color: string) =>
    parts.push(tintGeometry(new BoxGeometry(...size).translate(...position), color))
  /** Trụ theo trục x, y hoặc z. */
  const cylinder = (radius: number, span: number, axis: 'x' | 'y' | 'z', position: Point, color: string, segments = 16) => {
    const geometry = new CylinderGeometry(radius, radius, span, segments)
    if (axis === 'x') geometry.rotateZ(Math.PI / 2)
    if (axis === 'z') geometry.rotateX(Math.PI / 2)
    parts.push(tintGeometry(geometry.translate(...position), color))
  }
  return { box, cylinder }
}

/**
 * Khung gầm minh hoạ (AGENTS mục 7): gầm thùng, khung sườn, dầm ngang, trục, vi sai, nhíp, giảm chấn, các-đăng, động cơ/hộp số,
 * bình nhiên liệu, bình hơi, ắc quy, ống xả, lốp dự phòng, chắn bùn. Mọi độ cao suy từ `layout` (mặt dưới sàn, khung sườn, tâm bánh)
 * nên xe sàn thấp (van) hay sàn cao (tải nặng) đều khít. Gộp vào hình học chi tiết màu theo đỉnh (một draw call). Không phải dữ liệu
 * trục có thẩm quyền.
 */
export function addChassisParts(parts: BufferGeometry[], layout: TruckLayout, length: number, width: number, m: SceneMaterials) {
  const { box, cylinder } = partAdders(parts)
  const { frame, axles, driveshaft, wheelY, wheelRadius: r, cab, profile } = layout
  const frameLength = frame.toX - frame.fromX
  const frameMid = (frame.fromX + frame.toX) / 2
  const mid = width / 2
  const [railTop, railBottom] = frame.y
  const railY = (railTop + railBottom) / 2, railH = railTop - railBottom
  const van = profile.cab === 'van'
  /** Khoảng từ mặt dưới khung sườn tới tâm bánh: nơi nhíp, bình, ống xả nằm */
  const drop = Math.max(0.04, railBottom - wheelY)

  // Gầm thùng: tấm đáy, dầm ngang và hai thanh đỡ dọc nằm trên khung sườn.
  box([length, 0.012, width], [length / 2, -0.03, mid], m.wall)
  for (let x = 0.3; x < length; x += 0.6) box([0.06, 0.07, width - 0.06], [x, -0.07, mid], m.skirt)
  for (const z of frame.railZ) box([length, 0.06, 0.12], [length / 2, -0.12, z], m.skirt)

  // Khung sườn chữ C: bản bụng + hai cánh, và dầm ngang.
  for (const [i, z] of frame.railZ.entries()) {
    const outward = i === 0 ? -1 : 1
    box([frameLength, railH, 0.02], [frameMid, railY, z], m.chassis)
    for (const y of [railTop - 0.01, railBottom + 0.01]) box([frameLength, 0.02, 0.09], [frameMid, y, z + outward * 0.035], m.chassis)
  }
  const span = frame.railZ[1] - frame.railZ[0]
  for (let x = frame.fromX + 0.25; x < frame.toX; x += 1.1) box([0.08, railH * 0.6, span], [x, railY, mid], m.metal)
  box([0.12, 0.08, 0.2], [frame.fromX + 0.05, railBottom - 0.02, mid], m.metal)

  for (const axle of axles) {
    if (axle.kind === 'steer') {
      // Dầm cầu trước chữ I, thanh giằng lái và cam lái hai đầu.
      box([0.1, r * 0.26, width - 0.5], [axle.x, wheelY + 0.02, mid], m.metal)
      cylinder(0.025, width - 0.6, 'z', [axle.x + r * 0.44, wheelY - 0.05, mid], m.metal, 8)
      for (const z of [0.36, width - 0.36]) cylinder(r * 0.14, r * 0.44, 'y', [axle.x, wheelY, z], m.chassis, 12)
    } else {
      // Vỏ cầu sau, vi sai hình cầu và cổ bánh răng quả dứa hướng về các-đăng.
      cylinder(r * 0.15, width - 0.2, 'z', [axle.x, wheelY, mid], m.metal)
      parts.push(tintGeometry(new SphereGeometry(r * 0.4, 16, 12).scale(1, 0.9, 1.1).translate(axle.x, wheelY, mid), m.chassis))
      cylinder(r * 0.16, r * 0.52, 'x', [axle.x - r * 0.48, wheelY + 0.02, mid], m.chassis, 12)
    }
    for (const z of frame.railZ) {
      // Bó nhíp lá: các lá ngắn dần về phía dưới, quang nhíp và hai tai treo lên khung sườn.
      const leafTop = Math.min(railBottom - 0.01, wheelY + r * 0.34)
      const leaf = r * 2.4
      ;[1, 0.84, 0.67, 0.5].forEach((k, i) => box([leaf * k, 0.022, 0.08], [axle.x, leafTop - i * 0.026, z], m.metal))
      for (const dx of [-0.08, 0.08]) box([0.025, leafTop - wheelY + 0.05, 0.1], [axle.x + dx, (leafTop + wheelY) / 2, z], m.chassis)
      for (const dx of [-leaf / 2, leaf / 2]) box([0.06, railBottom - leafTop + 0.02, 0.06], [axle.x + dx, (railBottom + leafTop) / 2, z], m.chassis)
      // Giảm chấn.
      const shock = Math.max(0.12, railBottom - wheelY)
      cylinder(0.035, shock, 'y', [axle.x + r * 0.6, wheelY + shock / 2, z + (z < mid ? -0.12 : 0.12)], m.light, 10)
    }
  }

  // Động cơ dưới cabin (van: dưới nắp máy), hộp số, và các-đăng nghiêng từ hộp số xuống từng cầu chủ động.
  const engineX = van ? cab.frontX + 0.45 : (cab.frontX + cab.backX) / 2 + 0.05
  const engineTop = van ? cab.bottomY + 0.3 : Math.min(0.05, cab.bottomY + 0.4)
  const engineH = Math.max(0.2, engineTop - (wheelY - r * 0.1))
  box([van ? 0.6 : 1.0, engineH, Math.min(0.72, span + 0.2)], [engineX, engineTop - engineH / 2, mid], m.chassis)
  const gearY = railBottom - 0.05
  box([0.55, Math.min(0.34, drop + 0.1), 0.44], [layout.gearboxX, gearY, mid], m.metal)
  for (const segment of driveshaft) {
    const fromY = segment.fromX === layout.gearboxX ? gearY : wheelY + 0.02
    const toY = wheelY + 0.02
    const startX = segment.fromX + 0.1, endX = segment.toX - r * 0.76
    const dx = endX - startX, dy = toY - fromY
    if (dx <= 0.05) continue
    const shaft = new CylinderGeometry(0.045, 0.045, Math.hypot(dx, dy), 12).rotateZ(Math.PI / 2 + Math.atan2(dy, dx))
    parts.push(tintGeometry(shaft.translate(startX + dx / 2, fromY + dy / 2, mid), m.metal))
    for (const [x, y] of [[startX, fromY], [endX, toY]] as const) box([0.07, 0.1, 0.1], [x, y, mid], m.chassis)
  }

  // Bình nhiên liệu ngoài khung sườn trái, ắc quy bên phải, bình hơi giữa khung (xe có phanh hơi), bầu giảm thanh và ống xả.
  const [leftRail, rightRail] = frame.railZ
  const tankR = Math.min(0.25, Math.max(0.08, (drop + r * 0.5) / 2))
  const tankY = railBottom - tankR + 0.02
  const fuelX = Math.max(cab.backX + 0.9, length * 0.2)
  const tankZ = Math.max(tankR + 0.04, leftRail - tankR - 0.15)
  cylinder(tankR, van ? 0.6 : 1.1, 'x', [fuelX, tankY, tankZ], m.metal, 20)
  if (!van) {
    for (const dx of [-0.35, 0.35]) box([0.04, tankR * 2.08, tankR * 2.08], [fuelX + dx, tankY, tankZ], m.chassis)
    const batteryZ = Math.min(width - 0.2, rightRail + 0.36)
    box([0.6, tankR * 1.4, 0.38], [fuelX, railBottom - tankR * 0.7, batteryZ], m.chassis)
    box([0.62, 0.04, 0.4], [fuelX, railBottom + 0.01, batteryZ], m.metal)
    for (const dz of [-0.2, 0.2]) cylinder(Math.min(0.1, drop * 0.6), 0.8, 'x', [length * 0.38, railBottom - 0.06, mid + dz], m.light, 14)
  }
  const [ex, ey, ez] = layout.exhaust
  cylinder(Math.min(0.14, tankR * 0.6), 0.75, 'x', [ex - 0.55, ey + 0.04, rightRail + 0.18], m.metal, 16)
  cylinder(0.04, ez - rightRail - 0.18, 'z', [ex, ey, (ez + rightRail + 0.18) / 2], m.chassis, 8)
  if (!van) {
    // Lốp dự phòng treo dưới khung, giữa hai thanh.
    const spareR = Math.min(r * 0.9, span / 2 - 0.02)
    cylinder(spareR, 0.26, 'y', [length * 0.55, railBottom - 0.15, mid], m.wheel, 24)
    cylinder(spareR * 0.6, 0.27, 'y', [length * 0.55, railBottom - 0.15, mid], m.metal, 16)
  }

  // Chắn bùn trên các cầu chủ động, thanh chắn hông giữa cầu trước và cụm cầu sau.
  const drive = axles.filter((axle) => axle.kind === 'drive')
  // Van: thân liền khối che bánh, không chắn bùn rời
  if (!drive.length || van) return
  const first = drive[0]!.x - r * 1.24, last = drive.at(-1)!.x + r * 1.24
  const guardY = Math.min(-0.02, wheelY + r + 0.05)
  for (const z of [0.36, width - 0.36]) {
    box([last - first, 0.03, 0.74], [(first + last) / 2, guardY, z], m.chassis)
    for (const x of [first, last]) box([0.03, r * 0.6, 0.74], [x, guardY - r * 0.3, z], m.chassis)
  }
  const steer = axles.find((axle) => axle.kind === 'steer')
  const guardFrom = Math.max(cab.backX + 0.05, (steer?.x ?? cab.frontX) + r * 1.6), guardTo = first - 0.1
  if (guardTo <= guardFrom) return
  const rails = [wheelY + r * 0.6, wheelY + r * 0.15]
  for (const z of [0.02, width - 0.02]) {
    for (const y of rails) box([guardTo - guardFrom, 0.07, 0.04], [(guardFrom + guardTo) / 2, y, z], m.metal)
    for (let x = guardFrom + 0.05; x <= guardTo; x += 1.2) box([0.05, rails[0]! - rails[1]!, 0.04], [x, (rails[0]! + rails[1]!) / 2, z], m.chassis)
  }
}
