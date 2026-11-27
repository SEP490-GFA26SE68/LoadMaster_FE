import { expect, test } from 'vitest'
import { cargoSurfaceIndex, standsUpright } from '@/features/viewer3d/scene/cargo-marks'

test('plain packages keep the three neutral tiles', () => {
  expect(cargoSurfaceIndex({ packaging: 'carton', fragile: false, orientation: 'LWH' })).toBe(0)
  expect(cargoSurfaceIndex({ packaging: 'pallet', fragile: false, keepUpright: false, orientation: 'HWL' })).toBe(1)
  expect(cargoSurfaceIndex({ packaging: 'crate', fragile: false, orientation: 'LWH' })).toBe(2)
})

test('fragile, keep-upright and both pick their marked tiles on top of the packaging tile', () => {
  expect(cargoSurfaceIndex({ packaging: 'carton', fragile: true, orientation: 'LHW' })).toBe(3)
  expect(cargoSurfaceIndex({ packaging: 'carton', fragile: false, keepUpright: true, orientation: 'LWH' })).toBe(6)
  expect(cargoSurfaceIndex({ packaging: 'carton', fragile: true, keepUpright: true, orientation: 'WLH' })).toBe(9)
  expect(cargoSurfaceIndex({ packaging: 'crate', fragile: true, keepUpright: true, orientation: 'LWH' })).toBe(11)
})

test('the upright arrows only appear when the nominal height really stands vertical', () => {
  expect(standsUpright('LWH')).toBe(true)
  expect(standsUpright('WLH')).toBe(true)
  for (const code of ['LHW', 'WHL', 'HLW', 'HWL'] as const) {
    expect(standsUpright(code)).toBe(false)
    expect(cargoSurfaceIndex({ packaging: 'carton', fragile: false, keepUpright: true, orientation: code })).toBe(0)
  }
})
