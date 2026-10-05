import { expect, test } from 'vitest'
import { zoneStrips } from '@/features/viewer3d/operations/stop-map'
import { editorMeasurements, overlapRegions, snapFeedbackBoxes } from '@/features/viewer3d/editor/spatial-feedback'
import { snapPosition } from '@/features/viewer3d/editor/snapping'
import { containerSize } from '@/features/viewer3d/scene/units'
import { resolveEffectiveScene } from '@/features/viewer3d/viewer-draft'
import { benchmarkScene, sceneBox as box } from '@/test/scene'

const vehicle = benchmarkScene(1000).vehicle

test('a 600 × 240 × 250 cm cargo space becomes 6 × 2.5 × 2.4 scene units (length × height × width)', () => {
  expect(containerSize({ innerLengthCm: 600, innerWidthCm: 240, innerHeightCm: 250 })).toStrictEqual({ length: 6, height: 2.5, width: 2.4 })
})

test('zone strips: one per stop zone, every vertex and label anchor inside the bay, for 1, 4 and 8 stops and a narrow bay', () => {
  for (const stops of [1, 4, 8] as const) {
    const p = benchmarkScene(1000, stops)
    expect(p.zones.length).toBe(stops)
    for (const v of [p.vehicle, { ...p.vehicle, innerWidthCm: 5 }]) {
      const strips = zoneStrips(p.zones, v)
      expect(strips.map((strip) => strip.stop)).toStrictEqual(p.zones.map((zone) => zone.stopId))
      for (const { vertices, labelAt } of strips) for (const point of [...Array.from({ length: 6 }, (_, i) => vertices.slice(i * 3, i * 3 + 3)), labelAt]) {
        expect(point[0]! >= 0 && point[0]! <= v.innerLengthCm).toBeTruthy()
        expect(point[1]! > 0 && point[1]! < 1, 'strips belong to the floor, not an exterior truck stripe').toBeTruthy()
        expect(point[2]! > 0 && point[2]! < v.innerWidthCm).toBeTruthy()
      }
    }
  }
  expect(zoneStrips([], vehicle)).toStrictEqual([])
  expect(benchmarkScene(1000).zones, 'the default fixture has no zones').toStrictEqual([])
})

test('a zone strip spans exactly its zone along the box, leaves the 10 cm buffer bare and anchors its label mid-zone at the floor edge', () => {
  const zones = [{ stopId: 1, startXCm: 305, endXCm: 600 }, { stopId: 3, startXCm: 0, endXCm: 295 }, { stopId: 5, startXCm: 600, endXCm: 600 }]
  const strips = zoneStrips(zones, { innerLengthCm: 600, innerWidthCm: 240 })
  const xs = (vertices: readonly number[]) => vertices.filter((_, index) => index % 3 === 0)
  // the zero-length zone of stop 5 has no strip
  expect(strips.map(({ stop, vertices, labelAt }) => [stop, Math.min(...xs(vertices)), Math.max(...xs(vertices)), labelAt]))
    .toStrictEqual([[1, 305, 600, [452.5, 0.4, 238]], [3, 0, 295, [147.5, 0.4, 238]]])
})

test('a package dragged into the zone of another stop becomes a rehandling in the effective scene, and back again when it returns', () => {
  const plan = benchmarkScene(132, 4)
  const own = plan.placements.find((p) => !p.outOfZone)!
  const other = plan.zones.find((zone) => zone.stopId !== own.stop)!
  const moved = resolveEffectiveScene(plan, { patches: new Map([[own.id, { position: { ...own.position, x: other.startXCm } }]]) }).placementById.get(own.id)!
  expect([own.zoneId, own.outOfZone, moved.zoneId, moved.outOfZone]).toStrictEqual([`ZONE-${own.stop}`, false, other.id, true])
  expect(resolveEffectiveScene(plan, { patches: new Map() }).placementById.get(own.id)).toBe(own)
})

test('snap feedback identifies the actual neighbor face and bounded face geometry', () => {
  const p = box('a'), neighbor = box('b', 26.7)
  const snap = snapPosition(p, { x: 17.2, y: 0, z: 0 }, [neighbor], vehicle)
  const target = snap.targets.find((t) => t.axis === 'x')!
  expect(target.placementId).toBe('b')
  expect(target.coordinateCm).toBe(26.7)
  const faces = snapFeedbackBoxes({ ...p, position: snap.position }, snap.targets, [neighbor])
  expect(faces.length <= 3).toBeTruthy()
  expect(faces[0]).toStrictEqual({ position: { x: 26.5, y: 0, z: 0 }, lengthCm: 0.4, widthCm: 10, heightCm: 10 })
})

test('overlap feedback renders the intersection, not the whole collided package', () => {
  const p = box('a'), q = box('b', 9, 2, 3)
  expect(overlapRegions(p, [q], ['b'])).toStrictEqual([{ position: { x: 9, y: 2, z: 3 }, lengthCm: 1, widthCm: 8, heightCm: 7 }])
  expect(overlapRegions(p, [q], ['missing']).length).toBe(0)
  expect(overlapRegions(p, [q], Array(8).fill('b')).length).toBe(4)
})

test('distance guides use the closest walls and highest actual supporting footprint', () => {
  const top = box('top', 710, 225, 30), below = box('below', 710, 225, 10)
  const unrelated = box('remote', 600, 0, 19)
  const guides = editorMeasurements(top, [top, below, unrelated], vehicle)
  expect(guides.map((g) => [g.label, g.cm])).toStrictEqual([['door', 0], ['rightWall', 0], ['support', 10]])
  expect(editorMeasurements(box('floor'), [], vehicle)[2]!.cm).toBe(0)
})
