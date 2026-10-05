import { expect, test } from 'vitest'
import { axleImbalance, axleLoadsOf, balancedCenterXCm } from '@/domain/metrics'
import type { VehicleAxle } from '@/domain/models'

/** Trục trước ở −120 cm, nhóm sau ở (400 + 520) / 2 = 460 cm: khoảng cách hai nhóm 580 cm. */
function axles(frontEmptyKg: number, frontMaxKg: number, rearEmptyKg: number, rearMaxKg: number): VehicleAxle[] {
  return [
    { id: 'AXLE-01', name: 'Trục trước', positionXCm: -120, emptyLoadKg: frontEmptyKg, maxLoadKg: frontMaxKg },
    { id: 'AXLE-02', name: 'Trục sau 1', positionXCm: 400, emptyLoadKg: rearEmptyKg / 2, maxLoadKg: rearMaxKg / 2 },
    { id: 'AXLE-03', name: 'Trục sau 2', positionXCm: 520, emptyLoadKg: rearEmptyKg / 2, maxLoadKg: rearMaxKg / 2 },
  ]
}

test('imbalance is the gap between the two utilisation ratios', () => {
  // Trước 1.500 / 3.000 = 0,5; sau 2.250 / 9.000 = 0,25
  const group = { positionXCm: 0, emptyLoadKg: 0, cargoLoadKg: 0 }
  expect(axleImbalance({ status: 'computed', front: { ...group, loadKg: 1500, limitKg: 3000 }, rear: { ...group, loadKg: 2250, limitKg: 9000 } })).toBe(0.25)
})

test('imbalance is unknown without axle loads or without a limit on either group', () => {
  const group = { positionXCm: 0, emptyLoadKg: 0, cargoLoadKg: 0, loadKg: 100 }
  expect(axleImbalance({ status: 'unavailable', reason: 'NO_AXLES' })).toBeUndefined()
  expect(axleImbalance({ status: 'computed', front: { ...group, limitKg: 3000 }, rear: group })).toBeUndefined()
})

test('empty truck already at equal utilisation: the balanced centre is the limit-weighted mean of the two groups', () => {
  // 1.000 / 3.000 = 3.000 / 9.000 → x* = (9.000 × 460 + 3.000 × (−120)) / 12.000 = 315
  const vehicle = { axles: axles(1000, 3000, 3000, 9000) }
  expect(balancedCenterXCm(vehicle, 1160)).toBe(315)
  // Kiểm chéo bằng mô hình đòn bẩy: 1.160 kg tại 315 → trước 1.290 / 3.000 = sau 3.870 / 9.000 = 0,43
  expect(axleImbalance(axleLoadsOf(vehicle, { totalKg: 1160, centerXCm: 315 }))).toBeCloseTo(0, 12)
})

test('a front-heavy empty truck pushes the balanced centre rearwards, past the box if need be', () => {
  // (580 × (9.000 × 2.000 − 3.000 × 1.800) / 1.160 + 9.000 × 460 − 3.000 × 120) / 12.000 = (6.300.000 + 3.780.000) / 12.000 = 840
  const vehicle = { axles: axles(2000, 3000, 1800, 9000) }
  expect(balancedCenterXCm(vehicle, 1160)).toBe(840)
  expect(axleImbalance(axleLoadsOf(vehicle, { totalKg: 1160, centerXCm: 840 }))).toBeCloseTo(0, 12)
})

test('vehicle type limits replace the limits of the axles', () => {
  // Giới hạn loại xe 2.000 / 6.000 cùng tỷ lệ 1 : 3 với tải rỗng 1.000 / 3.000 → x* = (6.000 × 460 − 2.000 × 120) / 8.000 = 315
  expect(balancedCenterXCm({ axles: axles(1000, 9999, 3000, 9999), frontAxleLimitKg: 2000, rearAxleLimitKg: 6000 }, 500)).toBe(315)
})

test('no balanced centre without usable axle data, a limit on both groups, or cargo', () => {
  expect(balancedCenterXCm({}, 1000)).toBeUndefined()
  expect(balancedCenterXCm({ axles: axles(1000, 0, 3000, 9000) }, 1000)).toBeUndefined()
  expect(balancedCenterXCm({ axles: axles(1000, 3000, 3000, 9000) }, 0)).toBeUndefined()
})
