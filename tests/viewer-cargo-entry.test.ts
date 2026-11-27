import { expect, test } from 'vitest'
import { Vector3 } from 'three'
import type { ScenePlacement } from '@/features/viewer3d/scene-input'
import { cargoBounds } from '@/features/viewer3d/scene/cargo-buffers'
import { cargoEntryOffset, ENTRY_GAP_M, ENTRY_LIFT_MAX_M, ENTRY_ROOF_OVERSHOOT_M } from '@/features/viewer3d/scene/cargo-entry'
import { boxCenter, boxSize, toScene } from '@/features/viewer3d/scene/units'
import { selectPulseGrowth, SELECT_PULSE_MS, SELECT_PULSE_PEAK_M } from '@/features/viewer3d/scene/select-pulse'

const INTERIOR = { innerLengthCm: 600, innerHeightCm: 240 }
/** Kiện sâu sát vách trước, trên sàn. */
const FLOOR = { position: { x: 0, y: 0, z: 0 }, lengthCm: 120, widthCm: 100, heightCm: 100 }
/** Kiện xếp chồng gần nóc. */
const HIGH = { position: { x: 200, y: 0, z: 120 }, lengthCm: 60, widthCm: 60, heightCm: 110 }
const SAMPLES = Array.from({ length: 101 }, (_, i) => i / 100)

test('at t = 0 the box sits outside the rear door, at t = 1 the offset is exactly zero', () => {
  for (const p of [FLOOR, HIGH]) {
    const [dx0] = cargoEntryOffset(p, INTERIOR, 0)
    // mép gần vách trước của kiện ở ngoài cửa sau, cách cửa một khe
    expect(toScene(p.position.x) + dx0).toBeCloseTo(toScene(INTERIOR.innerLengthCm) + ENTRY_GAP_M, 9)
    expect(cargoEntryOffset(p, INTERIOR, 1)).toEqual([0, 0])
  }
})

test('the box travels monotonically toward its slot along X and never goes below its final height or the floor', () => {
  for (const p of [FLOOR, HIGH]) {
    let previous = Infinity
    for (const t of SAMPLES) {
      const [dx, dy] = cargoEntryOffset(p, INTERIOR, t)
      expect(dx).toBeLessThanOrEqual(previous)
      expect(dx).toBeGreaterThanOrEqual(0)
      expect(dy).toBeGreaterThanOrEqual(0)
      expect(toScene(p.position.z) + dy).toBeGreaterThanOrEqual(0)
      previous = dx
    }
  }
})

test('the box flies above its slot and only lowers at the end, landing with no vertical speed', () => {
  const [, liftStart] = cargoEntryOffset(FLOOR, INTERIOR, 0)
  const [, liftMid] = cargoEntryOffset(FLOOR, INTERIOR, 0.5)
  expect(liftStart).toBeGreaterThan(0)
  expect(liftMid).toBeCloseTo(liftStart, 9)
  const [, nearEnd] = cargoEntryOffset(FLOOR, INTERIOR, 0.99)
  expect(nearEnd).toBeLessThan(liftStart * 0.01)
  // X đã tới chỗ trước khi kiện hạ hết
  const [dxLate] = cargoEntryOffset(FLOOR, INTERIOR, 0.85)
  expect(dxLate).toBe(0)
})

test('the lift is capped: at most ENTRY_LIFT_MAX_M, and the box never pokes far above the roof', () => {
  for (const p of [FLOOR, HIGH, { ...HIGH, position: { ...HIGH.position, z: 130 } }]) {
    for (const t of SAMPLES) {
      const [, dy] = cargoEntryOffset(p, INTERIOR, t)
      expect(dy).toBeLessThanOrEqual(ENTRY_LIFT_MAX_M + 1e-9)
      expect(toScene(p.position.z + p.heightCm) + dy).toBeLessThanOrEqual(toScene(INTERIOR.innerHeightCm) + ENTRY_ROOF_OVERSHOOT_M + 1e-9)
    }
  }
})

test('t outside [0, 1] is clamped', () => {
  expect(cargoEntryOffset(FLOOR, INTERIOR, -1)).toEqual(cargoEntryOffset(FLOOR, INTERIOR, 0))
  expect(cargoEntryOffset(FLOOR, INTERIOR, 2)).toEqual([0, 0])
})

test('raycast bounds cover the whole entry path, not only the final slot', () => {
  const placement = { ...FLOOR, id: 'P1' } as unknown as ScenePlacement
  const sphere = cargoBounds([placement], INTERIOR)
  const [cx, cy, cz] = boxCenter(placement)
  const [l, h, w] = boxSize(placement)
  for (const t of SAMPLES) {
    const [dx, dy] = cargoEntryOffset(placement, INTERIOR, t)
    for (const sx of [-0.5, 0.5]) for (const sy of [-0.5, 0.5]) for (const sz of [-0.5, 0.5]) {
      const point = new Vector3(cx + dx + sx * l, cy + dy + sy * h, cz + sz * w)
      expect(sphere.distanceToPoint(point)).toBeLessThanOrEqual(1e-9)
    }
  }
  // không có thùng thì như cũ: không bao quãng ngoài cửa
  expect(cargoBounds([placement]).radius).toBeLessThan(sphere.radius)
})

test('the selection pulse grows once and returns to the resting outline', () => {
  expect(selectPulseGrowth(0)).toBe(0)
  expect(selectPulseGrowth(1)).toBe(0)
  expect(selectPulseGrowth(1.5)).toBe(0)
  expect(selectPulseGrowth(0.5)).toBeCloseTo(SELECT_PULSE_PEAK_M, 9)
  expect(SELECT_PULSE_MS).toBeLessThanOrEqual(600)
})
