import { describe, expect, test } from 'vitest'
import { runMockOptimization } from '@/services/optimization'
import { LANDING_REQUEST } from '@/features/marketing/landing-sample.mock'
import { insetFrame, type Insets } from '@/features/viewer3d/scene/frame-fit'
import type { Vec3 } from '@/features/viewer3d/scene/units'
import {
  boxCorners, DIORAMA, DIORAMA_FRAME_POINTS, HERO_INSETS, laneBounds, laneSlots, laneVisible, prismCorners,
} from '@/features/viewer3d/landing/diorama-layout'

const result = runMockOptimization(LANDING_REQUEST, { clock: () => 0 })
const slots = laneSlots(LANDING_REQUEST, result)

describe('lane slots', () => {
  test('every package instance of the run has exactly one slot, in the lane of its stop', () => {
    const instances = LANDING_REQUEST.packages.flatMap((line) => Array.from({ length: line.quantity }, () => line.deliveryStop))
    expect(slots).toHaveLength(366)
    expect(new Set(slots.map((slot) => slot.instanceId)).size).toBe(366)
    expect(slots.map((slot) => slot.stop).sort()).toEqual(instances.sort())
    const cells = new Set(slots.map((slot) => `${slot.lane}:${slot.center.map((v) => v.toFixed(3)).join(',')}`))
    expect(cells.size).toBe(366)
    for (const slot of slots) expect(DIORAMA.lanes[slot.lane]!.stop).toBe(slot.stop)
  })

  test('lane counts and grids match the sample: 96 / 96 / 30 / 144, boxes the size of their package', () => {
    expect(DIORAMA.lanes.map((lane) => slots.filter((slot) => slot.lane === DIORAMA.lanes.indexOf(lane)).length)).toEqual([96, 96, 30, 144])
    expect(DIORAMA.lanes.map((lane) => lane.grid)).toEqual([[6, 4, 4], [6, 4, 4], [4, 3, 3], [9, 4, 4]])
    for (const lane of DIORAMA.lanes) {
      const line = LANDING_REQUEST.packages.find((p) => p.deliveryStop === lane.stop)!
      expect(lane.cell).toEqual([line.lengthCm / 100, line.heightCm / 100, line.widthCm / 100])
      expect(lane.grid[1] * lane.cell[2]).toBeCloseTo(lane.z[1] - lane.z[0], 9)
      expect(laneBounds(lane).height).toBeLessThanOrEqual(1.6 + 1e-9)
      expect(laneBounds(lane).x[1]).toBeLessThanOrEqual(11.6)
    }
  })

  test('occupied cells are the lowest ones, and the lane empties from the top in loading order', () => {
    for (let lane = 0; lane < DIORAMA.lanes.length; lane++) {
      const own = slots.filter((slot) => slot.lane === lane)
      for (const slot of own) {
        if (slot.layer === 0) continue
        const below = own.some((other) => other.layer === slot.layer - 1 && other.center[0] === slot.center[0] && other.center[2] === slot.center[2])
        expect(below).toBe(true)
      }
      for (let step = 0; step <= 366; step += 7) {
        const remaining = own.filter((slot) => laneVisible(slot, step))
        for (const slot of remaining) {
          if (slot.layer === 0) continue
          expect(remaining.some((other) => other.layer === slot.layer - 1 && other.center[0] === slot.center[0] && other.center[2] === slot.center[2])).toBe(true)
        }
      }
    }
  })

  test('conservation: at every step each package is drawn in its lane or in the truck, never both, never neither', () => {
    const orders = new Map(result.placements.map((p) => [p.packageInstanceId, p.loadingOrder]))
    for (const step of [0, 1, 50, 183, 365, 366]) {
      for (const slot of slots) {
        const order = orders.get(slot.instanceId)
        const inTruck = order !== undefined && order <= step
        expect(laneVisible(slot, step)).toBe(!inTruck)
      }
    }
    expect(slots.every((slot) => slot.loadingOrder !== null)).toBe(true)
    expect(new Set(result.placements.map((p) => p.loadingOrder))).toEqual(new Set(Array.from({ length: 366 }, (_, i) => i + 1)))
  })
})

describe('yard geometry', () => {
  test('dock and leveller clear the open rear doors; trees stand left of the bay', () => {
    expect(Math.min(...DIORAMA.dock.footprint.map(([x]) => x))).toBeGreaterThanOrEqual(7.4)
    expect(DIORAMA.truck.x[1]).toBeLessThan(7.4)
    expect(DIORAMA.leveller.z[0]).toBeGreaterThanOrEqual(0.2)
    expect(DIORAMA.leveller.z[1]).toBeLessThanOrEqual(2.2)
    expect(DIORAMA.leveller.x).toEqual([6, 7.4])
    for (const tree of DIORAMA.trees) expect(tree.x).toBeLessThan(-2)
    for (const tree of DIORAMA.trees) expect(tree.x + 0.45).toBeLessThan(DIORAMA.road.x[0])
    expect(DIORAMA.laneX).toBeGreaterThan(DIORAMA.leveller.x[1])
  })

  test('line of sight: nothing rises more than 0.3 m above the slab in front of the truck (z > 2.4, −2 < x < 7.4)', () => {
    const dockX = DIORAMA.dock.footprint.map(([x]) => x), dockZ = DIORAMA.dock.footprint.map(([, z]) => z)
    const tall: { x: readonly [number, number]; z: readonly [number, number] }[] = [
      { x: [Math.min(...dockX), Math.max(...dockX)], z: [Math.min(...dockZ), Math.max(...dockZ)] },
      { x: DIORAMA.leveller.x, z: DIORAMA.leveller.z },
      { x: DIORAMA.warehouse.x, z: DIORAMA.warehouse.z },
      ...DIORAMA.trees.map((tree) => ({ x: [tree.x - 0.45, tree.x + 0.45] as const, z: [tree.z - 0.45, tree.z + 0.45] as const })),
      ...DIORAMA.lanes.map((lane) => laneBounds(lane)),
    ]
    for (const { x, z } of tall) expect(x[0] < 7.4 && x[1] > -2 && z[1] > 2.4).toBe(false)
    expect(DIORAMA.road.top - DIORAMA.slab.top).toBeLessThanOrEqual(0.3)
  })
})

/** Phép chiếu phối cảnh như camera của `CameraRig` (`setLookAt` + `fov`), toạ độ thế giới gốc ở tâm thùng. */
function frame(width: number, height: number, insets: Insets) {
  const center: Vec3 = [3, 1.25, 1.2]
  const world = (p: Vec3): Vec3 => [p[0] - center[0], p[1] - center[1], p[2] - center[2]]
  const { position, target } = insetFrame(DIORAMA_FRAME_POINTS.map(world), [8.5, 5.2, 7], { fovDeg: 26, width, height, insets })
  const forward = unit([position[0] - target[0], position[1] - target[1], position[2] - target[2]])
  const right = unit([forward[2], 0, -forward[0]])
  const up: Vec3 = [forward[1] * right[2] - forward[2] * right[1], forward[2] * right[0] - forward[0] * right[2], forward[0] * right[1] - forward[1] * right[0]]
  const tanV = Math.tan(13 * Math.PI / 180), tanH = tanV * width / height
  const project = (p: Vec3) => {
    const q = world(p), v: Vec3 = [q[0] - position[0], q[1] - position[1], q[2] - position[2]]
    const w = -dot(v, forward)
    return [(dot(v, right) / (w * tanH) + 1) / 2 * width, (1 - dot(v, up) / (w * tanV)) / 2 * height] as const
  }
  const rect = (points: readonly Vec3[]) => {
    const xy = points.map(project)
    return [Math.min(...xy.map(([x]) => x)), Math.min(...xy.map(([, y]) => y)), Math.max(...xy.map(([x]) => x)), Math.max(...xy.map(([, y]) => y))] as const
  }
  const distance = Math.hypot(position[0] - target[0], position[1] - target[1], position[2] - target[2])
  return { rect, pxPerMetre: height / (2 * distance * tanV) }
}
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const unit = (a: Vec3): Vec3 => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l] }
type Rect = readonly [number, number, number, number]
const intersects = (a: Rect, b: Rect) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]

describe('overview framing (fov 26, wide insets)', () => {
  const truck = boxCorners(DIORAMA.truck.x, DIORAMA.truck.y, DIORAMA.truck.z)
  const lanes = DIORAMA.lanes.flatMap((lane) => { const b = laneBounds(lane); return boxCorners(b.x, [0, b.height], b.z) })
  const dock = prismCorners(DIORAMA.dock.footprint, DIORAMA.slab.top, DIORAMA.dock.top)
  const slab = prismCorners(DIORAMA.slab.footprint, DIORAMA.slab.bottom, DIORAMA.slab.top)
  const warehouse = boxCorners(DIORAMA.warehouse.x, [DIORAMA.slab.top, DIORAMA.warehouse.top + DIORAMA.warehouse.parapet], DIORAMA.warehouse.z)
  const trees = DIORAMA.trees.flatMap((t) => boxCorners([t.x - 0.45, t.x + 0.45], [DIORAMA.slab.top, DIORAMA.slab.top + t.height], [t.z - 0.45, t.z + 0.45]))
  const sizes = [
    { width: 824, height: 600, lumo: 144, bubble: 352 },
    { width: 750, height: 560, lumo: 128, bubble: 320 },
    { width: 664, height: 560, lumo: 128, bubble: 320 },
    { width: 1112, height: 600, lumo: 144, bubble: 352 },
  ]

  test.each(sizes)('$width×$height: truck left of the lanes, overlays clear of the yard, everything inside the stage', ({ width, height, lumo, bubble }) => {
    const { rect } = frame(width, height, HERO_INSETS.wide)
    const r = { truck: rect(truck), lanes: rect(lanes), dock: rect(dock), slab: rect(slab), warehouse: rect(warehouse), trees: rect(trees) }
    expect(r.truck[2]).toBeLessThan(r.lanes[0])
    const controls: Rect = [16, 16, 16 + 480, 16 + 56]
    const lumoBox: Rect = [16, height - 16 - lumo, 16 + lumo, height - 16]
    const bubbleBox: Rect = [16 + lumo + 8, height - 16 - 120, 16 + lumo + 8 + bubble, height - 16]
    const card: Rect = [width - 16 - 288, 16, width - 16, 16 + 140]
    // Nút ba trạng thái ở góc dưới phải: rộng nhất 160 px, cao 56 px trên máy cảm ứng
    const storyButton: Rect = [width - 16 - 160, height - 16 - 56, width - 16, height - 16]
    for (const overlay of [controls, lumoBox, bubbleBox, storyButton]) for (const part of [r.truck, r.lanes, r.dock]) expect(intersects(overlay, part)).toBe(false)
    for (const part of [r.truck, r.lanes, r.dock, r.slab, r.trees]) expect(intersects(card, part)).toBe(false)
    for (const part of Object.values(r)) {
      expect(part[0]).toBeGreaterThanOrEqual(0)
      expect(part[1]).toBeGreaterThanOrEqual(0)
      expect(part[2]).toBeLessThanOrEqual(width)
      expect(part[3]).toBeLessThanOrEqual(height)
    }
  })

  test('the yard stays large enough to read', () => {
    expect(frame(824, 600, HERO_INSETS.wide).pxPerMetre).toBeGreaterThanOrEqual(34)
    expect(frame(664, 560, HERO_INSETS.wide).pxPerMetre).toBeGreaterThanOrEqual(28)
    expect(frame(976, 610, HERO_INSETS.medium).pxPerMetre).toBeGreaterThanOrEqual(40)
  })
})
