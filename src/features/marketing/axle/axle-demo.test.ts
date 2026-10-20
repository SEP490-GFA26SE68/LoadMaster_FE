import { expect, test } from 'vitest'
import { axleLoadsOf } from '@/domain/metrics'
import { axleDemo, centerRange, demoTruck, initialState, meterParts, weightRange } from './axle-demo'

/**
 * Tải trục của trang giới thiệu: thanh trượt → trọng tâm hàng → tải hai nhóm trục. Số kỳ vọng tính tay trên dữ liệu trục của xe mẫu trong seed
 * (thùng 720 cm, tải trọng 9.500 kg; trục trước −100 cm, rỗng 3.400 kg, giới hạn 6.500 kg; trục sau 475 cm, rỗng 2.300 kg, giới hạn 10.000 kg;
 * khoảng hai trục 575 cm) và đối chiếu với `axleLoadsOf` của domain.
 */
const truck = demoTruck()

test('the sample truck is the 7.2 m seed truck with two declared axles', () => {
  expect([truck.innerLengthCm, truck.maxPayloadKg]).toStrictEqual([720, 9500])
  expect(truck.axles?.map((axle) => [axle.positionXCm, axle.emptyLoadKg, axle.maxLoadKg])).toStrictEqual([
    [-100, 3400, 6500],
    [475, 2300, 10_000],
  ])
})

test('the slider value is the centre of mass: a block a third of the box long, from half a block behind the front wall to half a block before the door', () => {
  expect(centerRange(truck)).toStrictEqual({ min: 120, max: 600, step: 10 })
  expect(weightRange(truck)).toStrictEqual({ min: 500, max: 9500, step: 500 })
  expect(initialState(truck)).toStrictEqual({ centerXCm: 360, totalKg: 9500 })
})

test('a full load centred in the box stays within both limits', () => {
  const { front, rear } = axleDemo(truck, { centerXCm: 360, totalKg: 9500 })
  // Sau: 9.500 × (360 + 100) / 575 = 7.600 kg hàng + 2.300 kg rỗng; trước: 1.900 kg hàng + 3.400 kg rỗng
  expect([front.cargoLoadKg, front.loadKg, front.limitKg, front.overKg]).toStrictEqual([1900, 5300, 6500, null])
  expect([rear.cargoLoadKg, rear.loadKg, rear.limitKg, rear.overKg]).toStrictEqual([7600, 9900, 10_000, null])
})

test('ten centimetres further back the rear axle goes over; cargo against the front wall overloads the front axle', () => {
  // 9.500 × 470 / 575 = 7.765,217… → 10.065,22 kg, vượt 65,22 kg
  expect(axleDemo(truck, { centerXCm: 370, totalKg: 9500 }).rear.overKg).toBe(65.22)
  // 5.750 × 220 / 575 = 2.200 kg lên trục sau, 3.550 kg lên trục trước → 6.950 kg, vượt 450 kg
  const forward = axleDemo(truck, { centerXCm: 120, totalKg: 5750 })
  expect([forward.front.loadKg, forward.front.overKg, forward.rear.loadKg, forward.rear.overKg]).toStrictEqual([6950, 450, 4500, null])
})

test('cargo behind the rear axle lifts load off the front axle', () => {
  const { front, rear } = axleDemo(truck, { centerXCm: 600, totalKg: 9500 })
  expect(front.cargoLoadKg).toBeLessThan(0)
  expect(front.loadKg).toBeCloseTo(1334.78, 2)
  expect(rear.overKg).toBe(3865.22)
})

test('every slider position gives exactly what the domain lever model gives', () => {
  const center = centerRange(truck)
  const weight = weightRange(truck)
  for (let centerXCm = center.min; centerXCm <= center.max; centerXCm += center.step) {
    for (let totalKg = weight.min; totalKg <= weight.max; totalKg += weight.step) {
      const loads = axleLoadsOf(truck, { centerXCm, totalKg })
      if (loads.status !== 'computed') throw new Error('Xe mẫu phải tính được tải trục')
      const demo = axleDemo(truck, { centerXCm, totalKg })
      expect(demo.front.loadKg).toBe(loads.front.loadKg)
      expect(demo.rear.loadKg).toBe(loads.rear.loadKg)
      expect(demo.front.overKg !== null).toBe(demo.front.loadKg - 6500 > 1e-6)
      expect(demo.rear.overKg !== null).toBe(demo.rear.loadKg - 10_000 > 1e-6)
    }
  }
})

test('values outside the slider are clamped like a range input', () => {
  expect(axleDemo(truck, { centerXCm: 0, totalKg: 99_999 })).toStrictEqual(axleDemo(truck, { centerXCm: 120, totalKg: 9500 }))
})

test('the meter puts the limit at two thirds and splits empty load from cargo', () => {
  const parts = meterParts({ emptyLoadKg: 2300, cargoLoadKg: 7600, loadKg: 9900, limitKg: 10_000 })
  expect(parts.limit).toBeCloseTo(2 / 3)
  expect(parts.base).toBeCloseTo(2300 / 15_000)
  expect(parts.base + parts.cargo).toBeCloseTo(9900 / 15_000)
  // Hàng nhấc bớt tải khỏi trục trước: chỉ còn phần tải thật, không có phần hàng
  const lifted = meterParts({ emptyLoadKg: 3400, cargoLoadKg: -2065, loadKg: 1335, limitKg: 6500 })
  expect([lifted.base, lifted.cargo]).toStrictEqual([1335 / 9750, 0])
})
