import { BoxGeometry, CylinderGeometry, ExtrudeGeometry, Shape, TorusGeometry, type BufferGeometry } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { SceneMaterials } from './materials'
import { tintGeometry } from './tint-geometry'
import type { TruckLayout } from './truck-layout'
import type { VanShape } from './van-shape'

/**
 * Chi tiết của van liền khối (AGENTS mục 7), gộp màu theo đỉnh vào **một** draw như `truckDetails`: thân dưới hai bên (từ sàn xuống chân
 * thân) cắt hốc bánh, viền hốc, mặt trước dưới mũi, cản trước liền thân, ga-lăng, đèn pha, kính **chỉ ở hai cửa trước**, khe cửa, tay
 * nắm, gương nhỏ, gạt mưa; đuôi: mặt sau dưới sàn, cản sau liền thân (màu thân, mép dưới tối), đèn hậu dựng đứng ở hai trụ D; gầm riêng của van
 * (tấm sàn, hai dầm phụ, trục, vi sai, các-đăng, máy, bình nhiên liệu, ống xả) — không khung sườn chữ C của xe tải. Bản gọn
 * (`vanSimpleDetails`, tier low) giữ dáng: thân dưới có hốc bánh, hai cản, mặt trước / sau, tấm sàn.
 *
 * Mọi khối ngoài lòng thùng: dưới sàn (y < 0), ngoài vách (z < 0, z > W), trước vách trước (x < 0) hoặc sau cửa (x > L).
 */

type P2 = readonly [number, number]
type P3 = readonly [number, number, number]

/** Thân dưới hai bên dày chừng này; viền hốc bánh nhô ra ngoài thân. */
const SKIRT = 0.04
const ARCH_RIM = 0.018
/** Mặt trước dưới mũi: khối thân từ chân thân lên tới sàn, sâu chừng này. */
const FASCIA_DEPTH = 0.12
/** Cản sau liền thân nhô sau cửa chừng này; biển số van dán lên mặt cản (`LicensePlate`). */
export const VAN_BUMPER_OUT = 0.07
const BUMPER_LIP = 0.04

function mergedFlat(parts: BufferGeometry[]) {
  // ExtrudeGeometry không có chỉ mục, BoxGeometry có: đổi hết về không chỉ mục để gộp
  const flat = parts.map((part) => { if (!part.index) return part; const plain = part.toNonIndexed(); part.dispose(); return plain })
  const geometry = mergeGeometries(flat)!
  flat.forEach((part) => part.dispose())
  return geometry
}

function adders(parts: BufferGeometry[]) {
  const block = (min: P3, max: P3, color: string) => {
    if (max[0] - min[0] <= 1e-4 || max[1] - min[1] <= 1e-4 || max[2] - min[2] <= 1e-4) return
    parts.push(tintGeometry(new BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2])
      .translate((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2), color))
  }
  const rod = (radius: number, axis: 'x' | 'z', span: readonly [number, number], at: P2, color: string) => {
    const geometry = new CylinderGeometry(radius, radius, span[1] - span[0], 10)
    const mid = (span[0] + span[1]) / 2
    if (axis === 'x') parts.push(tintGeometry(geometry.rotateZ(Math.PI / 2).translate(mid, at[0], at[1]), color))
    else parts.push(tintGeometry(geometry.rotateX(Math.PI / 2).translate(at[0], at[1], mid), color))
  }
  /** Tấm phẳng theo đa giác (x, y), đùn theo z từ `z0` dày `depth` */
  const plate = (points: readonly P2[], z0: number, depth: number, color: string) => {
    const shape = new Shape()
    points.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)))
    shape.closePath()
    parts.push(tintGeometry(new ExtrudeGeometry(shape, { depth, bevelEnabled: false }).translate(0, 0, z0), color))
  }
  return { block, rod, plate }
}

/** Thân dưới một bên: từ mũi tới cửa sau, từ chân thân tới sàn, cắt vòm trên mỗi bánh. */
function skirtShape(van: VanShape, from: number, to: number) {
  const { sillY, wheelY, archRadius: R } = van
  const dy = sillY - wheelY, dx = Math.sqrt(Math.max(0, R * R - dy * dy))
  const shape = new Shape()
  shape.moveTo(from, sillY)
  for (const x of van.axles) {
    if (x - dx <= from || x + dx >= to) continue
    shape.lineTo(x - dx, sillY)
    shape.absarc(x, wheelY, R, Math.atan2(dy, -dx), Math.atan2(dy, dx), true)
  }
  shape.lineTo(to, sillY)
  shape.lineTo(to, 0)
  shape.lineTo(from, 0)
  shape.closePath()
  return shape
}

/** Thân dưới, mặt trước dưới mũi, cản trước, mặt sau dưới sàn, cản sau, tấm sàn: phần chung của hai bản. */
function addShell(parts: BufferGeometry[], van: VanShape, length: number, width: number, m: SceneMaterials, curveSegments: number) {
  const { block } = adders(parts)
  const { front, sillY, wall: w, rearBumper } = van
  for (const z0 of [-w, width + w - SKIRT]) {
    parts.push(tintGeometry(new ExtrudeGeometry(skirtShape(van, front + 0.04, length), { depth: SKIRT, bevelEnabled: false, curveSegments })
      .translate(0, 0, z0), m.cab))
  }
  const faceTop = van.outline.at(-1)![1]
  const bumperTop = sillY + (faceTop - sillY) * 0.42
  block([front, sillY, -w + 0.005], [front + FASCIA_DEPTH, 0.001, width + w - 0.005], m.cab)
  block([front - 0.06, sillY - 0.04, -w + 0.01], [front + 0.1, bumperTop, width + w - 0.01], m.cab)
  block([front - 0.07, sillY - 0.045, -w + 0.04], [front - 0.03, sillY + 0.03, width + w - 0.04], m.chassis)
  block([length - 0.03, sillY, -w], [length + 0.02, 0, width + w], m.cab)
  block([length - 0.01, rearBumper[0] + BUMPER_LIP, -w + 0.01], [length + VAN_BUMPER_OUT, rearBumper[1], width + w - 0.01], m.cab)
  block([length - 0.01, rearBumper[0], -w + 0.03], [length + VAN_BUMPER_OUT + 0.005, rearBumper[0] + BUMPER_LIP, width + w - 0.03], m.chassis)
  block([front + 0.15, -0.06, -w + SKIRT], [length - 0.03, -0.02, width + w - SKIRT], m.chassis)
  return { faceTop, bumperTop }
}

/** Mũi: ga-lăng, đèn pha, xi-nhan, gạt mưa. */
function addNose(parts: BufferGeometry[], van: VanShape, width: number, faceTop: number, bumperTop: number, m: SceneMaterials) {
  const { block } = adders(parts)
  const { front, wall: w } = van
  const mid = width / 2, grille = width * 0.55
  block([front - 0.015, bumperTop + 0.02, mid - grille / 2], [front + 0.01, faceTop - 0.05, mid + grille / 2], m.chassis)
  const lampW = Math.min(0.3, width * 0.17)
  for (const [outer, inward] of [[-w, 1], [width + w, -1]] as const) {
    const z0 = outer + inward * 0.05, z1 = z0 + inward * lampW
    block([front - 0.016, faceTop - 0.17, Math.min(z0, z1)], [front + 0.01, faceTop - 0.03, Math.max(z0, z1)], m.light)
    const zm = outer + inward * 0.02
    block([front - 0.014, bumperTop - 0.1, Math.min(zm, zm + inward * 0.12)], [front + 0.01, bumperTop - 0.04, Math.max(zm, zm + inward * 0.12)], m.marker)
  }
  const [cx, cy] = van.cowl
  for (const k of [0.3, 0.66]) block([cx + 0.02, cy + 0.02, width * k - width * 0.16], [cx + 0.035, cy + 0.04, width * k + width * 0.16], m.chassis)
}

/** Hai bên: viền hốc bánh, kính cửa trước, khe cửa, tay nắm, gương nhỏ. */
function addSides(parts: BufferGeometry[], van: VanShape, width: number, m: SceneMaterials) {
  const { block, plate } = adders(parts)
  const { wall: w, wheelY, archRadius: R, sillY } = van
  const [cx, cy] = van.cowl, [tx, ty] = van.windshieldTop
  const xAt = (y: number) => cx + (y - cy) * (tx - cx) / (ty - cy)
  const belt = cy + 0.05, top = Math.min(van.roofY - 0.12, ty - 0.02)
  const f0 = xAt(belt) + 0.09, f1 = xAt(top) + 0.09
  const back = Math.min(van.back - 0.09, f0 + 0.95)
  const steer = van.axles[0]!
  const dy = sillY - wheelY
  const arc = [Math.atan2(dy, Math.sqrt(Math.max(0, R * R - dy * dy))), Math.atan2(dy, -Math.sqrt(Math.max(0, R * R - dy * dy))) + Math.PI * 2]
  for (const [outer, side] of [[-w, -1], [width + w, 1]] as const) {
    const proud = (depth: number) => (side < 0 ? [outer - depth, outer] : [outer, outer + depth]) as [number, number]
    for (const x of van.axles) {
      parts.push(tintGeometry(new TorusGeometry(R + ARCH_RIM * 0.6, ARCH_RIM, 4, 20, arc[1]! - arc[0]!).rotateZ(arc[0]!)
        .translate(x, wheelY, outer + side * 0.004), m.chassis))
    }
    if (back > f1 + 0.15) {
      const [g0] = proud(0.012)
      plate([[f0, belt], [back, belt], [back, top], [f1, top]], g0, 0.01, m.windshield)
    }
    // Khe cửa trước: mép trước tránh vòm bánh trước, mép sau (trụ B) từ chân thân lên gần nóc
    const seamX = f0 - 0.05, near = Math.abs(seamX - steer)
    const seamBottom = near < R ? wheelY + Math.sqrt(R * R - near * near) + 0.03 : sillY + 0.04
    const [s0, s1] = proud(0.004)
    if (belt - seamBottom > 0.05) block([seamX, seamBottom, s0], [seamX + 0.012, belt, s1], m.chassis)
    block([back + 0.03, sillY + 0.04, s0], [back + 0.042, top + 0.04, s1], m.chassis)
    const [h0, h1] = proud(0.014)
    block([back - 0.18, belt - 0.1, h0], [back - 0.06, belt - 0.065, h1], m.chassis)
    // Gương nhỏ trên góc cửa trước
    const [a0, a1] = proud(0.08), [c0, c1] = side < 0 ? [outer - 0.15, outer - 0.07] : [outer + 0.07, outer + 0.15]
    block([f0 - 0.05, belt + 0.06, a0], [f0, belt + 0.09, a1], m.chassis)
    block([f0 - 0.07, belt + 0.04, c0], [f0 + 0.03, belt + 0.2, c1], m.chassis)
  }
}

/** Đuôi: đèn hậu dựng đứng trên hai trụ D (đèn đỏ + xi-nhan hổ phách). */
function addRear(parts: BufferGeometry[], van: VanShape, length: number, width: number, height: number, m: SceneMaterials) {
  const { block } = adders(parts)
  const { wall: w, rearBumper } = van
  const lamp0 = Math.max(0.04, rearBumper[1] + 0.04), lamp1 = lamp0 + Math.min(0.6, Math.max(0.28, height * 0.35))
  for (const [z0, z1] of [[-w + 0.006, -0.004], [width + 0.004, width + w - 0.006]] as const) {
    block([length + 0.02, lamp0, z0], [length + 0.045, lamp1, z1], m.tailLight)
    block([length + 0.02, lamp1, z0], [length + 0.045, lamp1 + 0.07, z1], m.marker)
  }
}

/** Gầm của van: dầm phụ, máy dưới mũi, trục, vi sai, các-đăng, bình nhiên liệu, ống xả. */
function addUnderbody(parts: BufferGeometry[], van: VanShape, layout: TruckLayout, length: number, width: number, m: SceneMaterials) {
  const { block, rod } = adders(parts)
  const { wheelY, wheelRadius: r, axles, front, wall: w } = van
  const mid = width / 2, [railA, railB] = layout.frame.railZ
  for (const z of [railA, railB]) block([axles[0]! - 0.35, -0.14, z - 0.03], [length - 0.1, -0.06, z + 0.03], m.chassis)
  const engine = Math.min(0.9, (van.back - front) * 0.45)
  block([front + 0.3, wheelY - r * 0.2, mid - 0.3], [front + 0.3 + engine, -0.06, mid + 0.3], m.chassis)
  for (const [i, x] of axles.entries()) {
    rod(r * 0.12, 'z', van.wheelZ, [x, wheelY], m.metal)
    if (i > 0) block([x - r * 0.28, wheelY - r * 0.28, mid - r * 0.3], [x + r * 0.28, wheelY + r * 0.28, mid + r * 0.3], m.chassis)
  }
  const last = axles.at(-1)!
  if (last - r * 0.3 > layout.gearboxX + 0.1) rod(0.035, 'x', [layout.gearboxX, last - r * 0.3], [wheelY + 0.04, mid], m.metal)
  const tank0 = -w + SKIRT + 0.05, tank1 = railA - 0.06, tankBottom = Math.max(wheelY - r * 0.3, -0.3)
  if (tank1 - tank0 > 0.15 && -0.06 - tankBottom > 0.08) block([length * 0.2, tankBottom, tank0], [length * 0.2 + 0.6, -0.06, tank1], m.metal)
  const [ex, ey, ez] = layout.exhaust
  rod(0.03, 'x', [van.back + 0.3, ex], [ey, ez], m.metal)
  block([length * 0.5 - 0.22, ey - 0.06, ez - 0.08], [length * 0.5 + 0.22, ey + 0.06, ez + 0.08], m.metal)
}

export function vanDetails(length: number, width: number, height: number, layout: TruckLayout, m: SceneMaterials) {
  const van = layout.van!
  const parts: BufferGeometry[] = []
  const { faceTop, bumperTop } = addShell(parts, van, length, width, m, 12)
  addNose(parts, van, width, faceTop, bumperTop, m)
  addSides(parts, van, width, m)
  addRear(parts, van, length, width, height, m)
  addUnderbody(parts, van, layout, length, width, m)
  return mergedFlat(parts)
}

/** Bản gọn (tier low): vẫn đúng dáng — thân dưới có hốc bánh, mặt trước, hai cản, mặt sau, tấm sàn — vài trăm tam giác. */
export function vanSimpleDetails(length: number, width: number, layout: TruckLayout, m: SceneMaterials) {
  const parts: BufferGeometry[] = []
  addShell(parts, layout.van!, length, width, m, 5)
  return mergedFlat(parts)
}
