import { BoxGeometry, BufferAttribute, BufferGeometry, Color, InstancedBufferAttribute } from 'three'
import type { VehicleConfig } from '@/domain/models'
import { stopColor } from '@/lib/stops'
import { readToken } from '@/lib/tokens'
import { sceneMaterials } from '../scene/materials'
import { CAB_X, truckLayout, WHEEL_RADIUS, WHEEL_Y } from '../scene/truck-layout'
import { containerSize, type Vec3 } from '../scene/units'
import { CAB_PROFILE, DIORAMA, DIORAMA_COLORS, DIORAMA_LIFT, laneBounds, type Footprint } from './diorama-layout'

/**
 * Hình học của sân kho (`DIORAMA`) gộp vào **một** BufferGeometry tô màu theo đỉnh (một draw call, pháp tuyến phẳng); màu là token
 * (`DIORAMA_COLORS`) nhân `DIORAMA_LIFT`, ánh sáng dùng chung không đổi. Camera Toàn cảnh cách 33–42 m, bộ đệm độ sâu ở đó chỉ phân
 * biệt khoảng 1 mm: mặt cùng mặt phẳng là các mảnh cạnh nhau, không chồng lên nhau; vạch sơn và mặt cửa nhô lên `DECAL`.
 */

type Rgb = readonly [number, number, number]
type Palette = Record<keyof typeof DIORAMA_COLORS, Rgb>

/** Khoảng cách (m) của vạch sơn trên dock, mặt cửa và dải trên tường tới mặt nền: đủ nhiều bậc độ sâu ở 42 m. */
const DECAL = 0.006

function rgb(value: string, factor = 1): Rgb {
  const color = (value ? new Color(value) : new Color(0, 0, 0)).multiplyScalar(factor)
  return [color.r, color.g, color.b]
}

export function dioramaPalette(): Palette {
  const entries = Object.entries(DIORAMA_COLORS) as [keyof typeof DIORAMA_COLORS, `--${string}`][]
  return Object.fromEntries(entries.map(([key, token]) => [key, rgb(readToken(token), DIORAMA_LIFT[key] ?? 1)])) as Palette
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const UP: Vec3 = [0, 1, 0]

/** Gom tam giác không chỉ mục: vị trí, pháp tuyến phẳng, màu. */
function createBuilder() {
  const positions: number[] = [], normals: number[] = [], colors: number[] = []
  /** Đa giác lồi phẳng, quay mặt về phía `toward`. */
  const face = (points: readonly Vec3[], color: Rgb, toward: Vec3) => {
    let ring = points
    let normal = cross(sub(ring[1]!, ring[0]!), sub(ring[2]!, ring[0]!))
    if (dot(normal, toward) < 0) { ring = [...ring].reverse(); normal = [-normal[0], -normal[1], -normal[2]] }
    const length = Math.hypot(...normal) || 1
    for (let i = 1; i + 1 < ring.length; i++) {
      for (const p of [ring[0]!, ring[i]!, ring[i + 1]!]) {
        positions.push(...p)
        normals.push(normal[0] / length, normal[1] / length, normal[2] / length)
        colors.push(...color)
      }
    }
  }
  /** Lăng trụ đứng trên đa giác lồi: các mặt bên (quay ra, hoặc vào trong với `inward`) và mặt trên nếu có màu, không đáy. */
  const prism = (footprint: Footprint, bottom: number, top: number, topColor: Rgb | null, sideColor: Rgb, inward = false) => {
    if (topColor) face(footprint.map(([x, z]): Vec3 => [x, top, z]), topColor, UP)
    const cx = footprint.reduce((s, [x]) => s + x, 0) / footprint.length, cz = footprint.reduce((s, [, z]) => s + z, 0) / footprint.length
    footprint.forEach(([x, z], i) => {
      const [nx, nz] = footprint[(i + 1) % footprint.length]!, out = inward ? -1 : 1
      face([[x, bottom, z], [nx, bottom, nz], [nx, top, nz], [x, top, z]], sideColor, [out * ((x + nx) / 2 - cx), 0, out * ((z + nz) / 2 - cz)])
    })
  }
  const box = (min: Vec3, max: Vec3, topColor: Rgb, sideColor: Rgb = topColor) =>
    prism([[min[0], min[2]], [max[0], min[2]], [max[0], max[2]], [min[0], max[2]]], min[1], max[1], topColor, sideColor)
  const flat = (x0: number, x1: number, z0: number, z1: number, y: number, color: Rgb) =>
    face([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], color, UP)
  /** Khối đùn theo z từ một đa giác lồi (x, y) ngược chiều kim đồng hồ: hai mặt đầu và các mặt quanh. */
  const extrudeZ = (profile: Footprint, z0: number, z1: number, color: Rgb) => {
    for (const z of [z0, z1]) face(profile.map(([x, y]): Vec3 => [x, y, z]), color, [0, 0, z === z0 ? -1 : 1])
    profile.forEach(([x, y], i) => {
      const [nx, ny] = profile[(i + 1) % profile.length]!
      face([[x, y, z0], [nx, ny, z0], [nx, ny, z1], [x, y, z1]], color, [ny - y, x - nx, 0])
    })
  }
  /** Hình nón đa giác (tán cây): đỉnh ở `top`, đáy tròn bán kính `radius` ở `base`. */
  const cone = (x: number, z: number, base: number, top: number, radius: number, sides: number, color: Rgb) => {
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 + 0.3, b = ((i + 1) / sides) * Math.PI * 2 + 0.3
      const p: Vec3 = [x + radius * Math.cos(a), base, z + radius * Math.sin(a)], q: Vec3 = [x + radius * Math.cos(b), base, z + radius * Math.sin(b)]
      face([p, [x, top, z], q], color, [(p[0] + q[0]) / 2 - x, 0.3, (p[2] + q[2]) / 2 - z])
    }
  }
  const toGeometry = () => {
    const geometry = new BufferGeometry()
    for (const [name, values] of [['position', positions], ['normal', normals], ['color', colors]] as const)
      geometry.setAttribute(name, new BufferAttribute(new Float32Array(values), 3))
    geometry.computeBoundingSphere()
    return geometry
  }
  return { face, prism, box, flat, extrudeZ, cone, toGeometry }
}

type Builder = ReturnType<typeof createBuilder>

function addYard(b: Builder, c: Palette) {
  const { slab, road, dock, leveller } = DIORAMA
  b.prism(slab.footprint, slab.bottom, slab.top, c.slabTop, c.slabSide)
  // Bãi đỗ: dải đầu bãi, rồi năm dải theo z — hai vạch mép nằm giữa mặt đường, không đè lên nó
  const [x0, x1] = road.x, [z0, z1] = road.z, edge = 0.14, line = road.line
  b.flat(x0, x0 + 0.1, z0, z1, road.top, c.road)
  const bands = [z0, z0 + edge, z0 + edge + line, z1 - edge - line, z1 - edge, z1]
  bands.slice(1).forEach((z, k) => b.flat(x0 + 0.1, x1, bands[k]!, z, road.top, k % 2 ? c.roadLine : c.road))
  // Dock: mép trước cyan là một dải riêng cạnh mặt dock
  const front = Math.min(...dock.footprint.map(([x]) => x)), zs = dock.footprint.map(([, z]) => z)
  b.prism(dock.footprint, slab.top, dock.top, null, c.dockFace)
  b.face(dock.footprint.map(([x, z]): Vec3 => [x === front ? front + dock.band : x, dock.top, z]), c.dockTop, UP)
  b.flat(front, front + dock.band, Math.min(...zs), Math.max(...zs), dock.top, c.dockEdge)
  b.box([leveller.x[0], leveller.top - leveller.thickness, leveller.z[0]], [leveller.x[1], leveller.top, leveller.z[1]], c.leveller)
}

/** Làn chờ: khung sơn và vạch đầu làn theo màu điểm giao — làn trống vẫn nhận ra là làn của điểm nào. */
function addLanes(b: Builder) {
  const y = DIORAMA.dock.top + DECAL, pad = 0.06, line = 0.05
  for (const lane of DIORAMA.lanes) {
    const { x, z } = laneBounds(lane), color = rgb(stopColor(lane.stop))
    const x0 = x[0] - pad, x1 = x[1] + pad, z0 = z[0] - pad, z1 = z[1] + pad
    b.flat(x0, x1, z0, z0 + line, y, color)
    b.flat(x0, x1, z1 - line, z1, y, color)
    b.flat(x1 - line, x1, z0 + line, z1 - line, y, color)
    b.flat(x0 - 0.1, x0 + line, z0 + line, z1 - line, y, color)
  }
}

/** Nhà kho: tường tới mép tường chắn mái, mái phẳng thấp hơn mép đó, dải cyan, hai cửa dock trên mặt +z. */
function addWarehouse(b: Builder, c: Palette) {
  const { warehouse: w, slab, dock } = DIORAMA
  const [x0, x1] = w.x, [z0, z1] = w.z, rim = w.top + w.parapet, i = w.parapetWidth
  const outer: Footprint = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]
  const inner: Footprint = [[x0 + i, z0 + i], [x1 - i, z0 + i], [x1 - i, z1 - i], [x0 + i, z1 - i]]
  b.prism(outer, slab.top, rim, null, c.wall)
  b.prism(inner, w.top, rim, null, c.wall, true)
  b.flat(x0 + i, x1 - i, z0 + i, z1 - i, w.top, c.roof)
  outer.forEach(([x, z], k) => {
    const [nx, nz] = outer[(k + 1) % 4]!, [ix, iz] = inner[k]!, [jx, jz] = inner[(k + 1) % 4]!
    b.face([[x, rim, z], [nx, rim, nz], [jx, rim, jz], [ix, rim, iz]], c.wall, UP)
  })
  const [lo, hi] = w.band, zf = z1 + DECAL, xf = x1 + DECAL
  b.face([[x0, lo, zf], [x1, lo, zf], [x1, hi, zf], [x0, hi, zf]], c.band, [0, 0, 1])
  b.face([[xf, lo, z0], [xf, lo, z1], [xf, hi, z1], [xf, hi, z0]], c.band, [1, 0, 0])
  for (const [d0, d1] of w.doors) b.face([[d0, dock.top, zf], [d1, dock.top, zf], [d1, w.doorTop, zf], [d0, w.doorTop, zf]], c.door, [0, 0, 1])
}

function addTrees(b: Builder, c: Palette) {
  const ground = DIORAMA.slab.top
  for (const { x, z, height } of DIORAMA.trees) {
    b.box([x - 0.06, ground, z - 0.06], [x + 0.06, ground + 0.32 * height, z + 0.06], c.trunk)
    b.cone(x, z, ground + 0.24 * height, ground + height, Math.min(0.45, 0.25 * height + 0.1), 7, c.canopy)
  }
}

/** Tier thấp không vẽ cabin, bánh, khung gầm (`TruckCab`): khối cùng dáng, cùng màu giữ thùng đứng trên mặt đường thay vì lơ lửng. */
function addTruckStandIn(b: Builder, vehicle: VehicleConfig) {
  const m = sceneMaterials(), { length: L, width: W } = containerSize(vehicle), chassis = rgb(m.chassis)
  b.extrudeZ(CAB_PROFILE.map(([x, y]) => [CAB_X + x, y] as const), 0.06, W - 0.06, rgb(m.cab))
  b.box([CAB_X - 0.85, WHEEL_Y - 0.1, W / 2 - 0.5], [L + 0.1, 0, W / 2 + 0.5], chassis)
  b.box([CAB_X - 0.8, WHEEL_Y, 0.08], [CAB_X + 0.8, 0.35, W - 0.08], chassis)
  for (const { x, z } of truckLayout(L, W, vehicle.axles).wheels) {
    const side = z < W / 2 ? -1 : 1
    const ring = Array.from({ length: 8 }, (_, k): Vec3 => [x + WHEEL_RADIUS * Math.cos(k * Math.PI / 4), WHEEL_Y + WHEEL_RADIUS * Math.sin(k * Math.PI / 4), z + side * 0.15])
    b.face(ring, rgb(m.wheel), [0, 0, side])
  }
}

/** Nền, đường, dock, cầu dẫn, làn, nhà kho, cây — một BufferGeometry. */
export function dioramaBaseGeometry(palette: Palette): BufferGeometry {
  const b = createBuilder()
  addYard(b, palette)
  addLanes(b)
  addWarehouse(b, palette)
  addTrees(b, palette)
  return b.toGeometry()
}

/** Khối xe giản lược của tier thấp, một BufferGeometry riêng: nó đi cùng nhóm xe (`SceneCanvas vehicleChildren`) khi xe rời kho. */
export function truckStandInGeometry(vehicle: VehicleConfig): BufferGeometry {
  const b = createBuilder()
  addTruckStandIn(b, vehicle)
  return b.toGeometry()
}

/** Hộp đơn vị của làn chờ, dùng chung atlas bề mặt với kiện (`packageSurface` = 0: ô thùng carton). */
export function laneBoxGeometry(count: number): BoxGeometry {
  const geometry = new BoxGeometry(1, 1, 1)
  geometry.setAttribute('packageSurface', new InstancedBufferAttribute(new Float32Array(count), 1))
  return geometry
}
