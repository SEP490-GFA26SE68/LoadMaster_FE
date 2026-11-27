import { expect, test } from 'vitest'
import { groundLayout, GROUND_DROP, GROUND_MARGIN } from '@/features/viewer3d/scene/ground-plane'
import { groundFootprintOf } from '@/features/viewer3d/scene/ground-footprint'
import { SPEC_TRUCK_6M as SPEC_VEHICLE } from '@/domain/fixtures/spec-samples'

const FOOT = { groundY: -1.1, x0: -1.85, x1: 7.32, halfWidth: 1.225, centerZ: 1.175 }

test('the ground covers the truck plus a margin on every side and sits just under the tyres', () => {
  const layout = groundLayout(FOOT)
  expect(layout.size[0]).toBeCloseTo(7.32 + 1.85 + GROUND_MARGIN * 2, 6)
  expect(layout.size[1]).toBeCloseTo(2.45 + GROUND_MARGIN * 2, 6)
  expect(layout.center[0]).toBeCloseTo((7.32 - 1.85) / 2, 6)
  expect(layout.center[1]).toBeCloseTo(-1.1 - GROUND_DROP, 6)
  expect(layout.center[2]).toBe(1.175)
})

test('the contact shadow is the truck footprint mapped into the texture, aspect kept within a power of two', () => {
  const { texture, shadow, size } = groundLayout(FOOT)
  expect(texture.width).toBe(512)
  expect(Math.log2(texture.height) % 1).toBe(0)
  expect(shadow.x / texture.width).toBeCloseTo(GROUND_MARGIN / size[0], 6)
  expect((shadow.x + shadow.width) / texture.width).toBeCloseTo((size[0] - GROUND_MARGIN) / size[0], 6)
  expect((shadow.y + shadow.height) / texture.height).toBeCloseTo((size[1] - GROUND_MARGIN) / size[1], 6)
  expect(shadow.soft).toBeGreaterThan(0)
})

test('the footprint follows the truck: tyre bottom, cab front, rear frame end, body width', () => {
  const foot = groundFootprintOf(SPEC_VEHICLE)
  expect(foot.groundY).toBeCloseTo(-1.1, 6)
  expect(foot.x0).toBeLessThanOrEqual(-1.85)
  expect(foot.x1).toBeGreaterThan(SPEC_VEHICLE.innerLengthCm / 100)
  expect(foot.centerZ).toBeCloseTo(SPEC_VEHICLE.innerWidthCm / 200, 6)
  expect(foot.halfWidth).toBeGreaterThan(foot.centerZ)
})
