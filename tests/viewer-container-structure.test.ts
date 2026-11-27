import { expect, test } from 'vitest'
import {
  containerEdges, containerFrame, containerShell, railHeights, roofBeamCenters, wallColumns, wallRows, POST_WIDTH, RIB_PITCH,
} from '@/features/viewer3d/scene/container-structure'

const BOX = { length: 7.2, width: 2.35, height: 2.4 }
const COLORS = { floor: [0.3, 0.3, 0.3], wall: [0.2, 0.2, 0.2], trim: [0.4, 0.4, 0.4] } as const

function triangles(positions: Float32Array) {
  const list: { a: number[]; b: number[]; c: number[] }[] = []
  for (let i = 0; i < positions.length; i += 9) {
    list.push({ a: [...positions.slice(i, i + 3)], b: [...positions.slice(i + 3, i + 6)], c: [...positions.slice(i + 6, i + 9)] })
  }
  return list
}
const sub = (p: number[], q: number[]) => p.map((v, i) => v - q[i]!)
const cross = (p: number[], q: number[]) => [p[1]! * q[2]! - p[2]! * q[1]!, p[2]! * q[0]! - p[0]! * q[2]!, p[0]! * q[1]! - p[1]! * q[0]!]

/** Pháp tuyến hướng vào lòng thùng của mặt chứa tam giác (sàn hướng lên), theo vị trí của tam giác. */
function inward({ a, b, c }: { a: number[]; b: number[]; c: number[] }) {
  const xs = [a[0]!, b[0]!, c[0]!], ys = [a[1]!, b[1]!, c[1]!], zs = [a[2]!, b[2]!, c[2]!]
  if (ys.every((y) => y === 0)) return [0, 1, 0]
  if (xs.every((x) => x === 0)) return [1, 0, 0]
  if (zs.every((z) => z === 0)) return [0, 0, 1]
  if (zs.every((z) => Math.abs(z - BOX.width) < 1e-5)) return [0, 0, -1]
  throw new Error('tam giác không nằm trên sàn hay vách nào')
}

test.each([true, false])('shell faces are single-sided and wound towards the inside, never leaving the box (detail %s)', (detail) => {
  const shell = containerShell(BOX, COLORS, detail)
  expect(shell.positions.length).toBe(shell.normals.length)
  expect(shell.positions.length).toBe(shell.colors.length)
  for (const tri of triangles(shell.positions)) {
    const n = cross(sub(tri.b, tri.a), sub(tri.c, tri.a))
    const want = inward(tri)
    expect(n[0]! * want[0]! + n[1]! * want[1]! + n[2]! * want[2]!).toBeGreaterThan(0)
  }
  for (let i = 0; i < shell.positions.length; i += 3) {
    expect(shell.positions[i]!).toBeGreaterThanOrEqual(0); expect(shell.positions[i]!).toBeLessThanOrEqual(BOX.length + 1e-5)
    expect(shell.positions[i + 1]!).toBeGreaterThanOrEqual(0); expect(shell.positions[i + 1]!).toBeLessThanOrEqual(BOX.height + 1e-5)
    expect(shell.positions[i + 2]!).toBeGreaterThanOrEqual(0); expect(shell.positions[i + 2]!).toBeLessThanOrEqual(BOX.width + 1e-5)
  }
})

test('without detail the shell is the old four flat faces (floor and three walls)', () => {
  expect(containerShell(BOX, COLORS, false).positions.length).toBe(4 * 6 * 3)
})

test('vertex normals stay on the inner side of every wall even where a rib half is tilted', () => {
  const shell = containerShell(BOX, COLORS, true)
  const tris = triangles(shell.positions)
  tris.forEach((tri, t) => {
    const want = inward(tri)
    for (let k = 0; k < 3; k++) {
      const n = [...shell.normals.slice((t * 3 + k) * 3, (t * 3 + k) * 3 + 3)]
      expect(n[0]! * want[0]! + n[1]! * want[1]! + n[2]! * want[2]!).toBeGreaterThan(0.9)
      expect(Math.hypot(...n)).toBeCloseTo(1, 5)
    }
  })
})

test('wall columns tile the span without gaps: a corner post at each end and one rib per pitch', () => {
  const columns = wallColumns(BOX.length)
  expect(columns[0]).toMatchObject({ from: 0, to: POST_WIDTH, kind: 'post' })
  expect(columns.at(-1)).toMatchObject({ to: BOX.length, kind: 'post' })
  for (let i = 1; i < columns.length; i++) expect(columns[i]!.from).toBeCloseTo(columns[i - 1]!.to, 9)
  const ribs = columns.filter((c) => c.kind === 'ribA').length
  expect(ribs).toBe(Math.round((BOX.length - POST_WIDTH * 2) / RIB_PITCH))
})

test('side walls carry two lashing rails from 1.6 m inner height, one below; rows tile the height', () => {
  expect(railHeights(2.4)).toHaveLength(2)
  expect(railHeights(1.4)).toHaveLength(1)
  for (const rails of [true, false]) {
    const rows = wallRows(2.4, rails)
    expect(rows[0]!.from).toBe(0)
    expect(rows.at(-1)).toMatchObject({ to: 2.4, kind: 'top' })
    for (let i = 1; i < rows.length; i++) expect(rows[i]!.from).toBeCloseTo(rows[i - 1]!.to, 9)
    expect(rows.filter((r) => r.kind === 'rail')).toHaveLength(rails ? 2 : 0)
  }
})

test('frame members added with detail sit outside the cargo space; low keeps only skirts and the door sill', () => {
  expect(containerFrame(BOX, false)).toHaveLength(3)
  const extra = containerFrame(BOX, true).slice(3)
  expect(extra.length).toBeGreaterThan(5)
  for (const { min, max } of extra) {
    const outside = max[0] <= 0 || min[1] >= BOX.height || max[2] <= 0 || min[2] >= BOX.width
    expect(outside).toBe(true)
  }
})

test('roof beams are evenly spaced strictly between the front and the rear', () => {
  const centers = roofBeamCenters(7.2)
  expect(centers).toHaveLength(4)
  expect(centers[0]).toBeCloseTo(1.44, 6)
  expect(centers.at(-1)).toBeCloseTo(5.76, 6)
  expect(roofBeamCenters(1)).toHaveLength(1)
})

test('edges are the twelve edges of the cargo box', () => {
  const edges = containerEdges(BOX)
  expect(edges.length).toBe(12 * 2 * 3)
  const lengths = []
  for (let i = 0; i < edges.length; i += 6) lengths.push(Math.hypot(edges[i + 3]! - edges[i]!, edges[i + 4]! - edges[i + 1]!, edges[i + 5]! - edges[i + 2]!))
  expect(lengths.filter((l) => Math.abs(l - 7.2) < 1e-5)).toHaveLength(4)
  expect(lengths.filter((l) => Math.abs(l - 2.35) < 1e-5)).toHaveLength(4)
  expect(lengths.filter((l) => Math.abs(l - 2.4) < 1e-5)).toHaveLength(4)
})
