import { expect, test } from 'vitest'
import { groundLayout, GROUND_DROP, GROUND_MARGIN } from '@/features/viewer3d/scene/ground-plane'
import { groundFootprintOf } from '@/features/viewer3d/scene/ground-footprint'
import { truckLayout } from '@/features/viewer3d/scene/truck-layout'
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

test('the footprint follows the truck drawn: ground under its tyres, cab nose to past the rear bumper, body width', () => {
  const foot = groundFootprintOf(SPEC_VEHICLE)
  const layout = truckLayout(SPEC_VEHICLE)
  expect(foot.groundY).toBe(layout.groundY)
  expect(foot.groundY).toBeCloseTo(layout.wheelY - layout.wheelRadius, 6)
  expect(foot.x0).toBeLessThanOrEqual(layout.cab.frontX)
  expect(foot.x1).toBeGreaterThan(SPEC_VEHICLE.innerLengthCm / 100)
  expect(foot.centerZ).toBeCloseTo(SPEC_VEHICLE.innerWidthCm / 200, 6)
  expect(foot.halfWidth).toBeGreaterThan(foot.centerZ)
})

test('the ground sits higher under a van than under a heavy truck', () => {
  const van = groundFootprintOf({ ...SPEC_VEHICLE, innerLengthCm: 280, maxPayloadKg: 600 })
  const heavy = groundFootprintOf({ ...SPEC_VEHICLE, innerLengthCm: 950, maxPayloadKg: 15000 })
  expect(van.groundY).toBeGreaterThan(heavy.groundY)
  expect(van.x1 - van.x0).toBeLessThan(heavy.x1 - heavy.x0)
})
