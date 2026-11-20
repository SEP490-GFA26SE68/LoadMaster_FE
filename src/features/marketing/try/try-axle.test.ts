import { expect, test } from 'vitest'
import { axleLoadsOf } from '@/domain/metrics'
import { axleRanges, axleSampleVehicle, axleTry } from './try-axle'

const vehicle = axleSampleVehicle()

test('the sample truck is the 3.5-tonne seed truck with two declared axles, the same body as the packing tab opens with', () => {
  expect(vehicle).toMatchObject({ innerLengthCm: 520, innerWidthCm: 200, innerHeightCm: 200, maxPayloadKg: 3500 })
  expect(vehicle.axles?.map(({ positionXCm, emptyLoadKg, maxLoadKg }) => [positionXCm, emptyLoadKg, maxLoadKg])).toEqual([
    [-100, 1900, 2800],
    [342.5, 1500, 5200],
  ])
})

test('the sliders run from an empty truck to full payload, and keep the centre of gravity half a pallet off each end', () => {
  expect(axleRanges(vehicle)).toEqual({
    massKg: { min: 0, max: 3500, step: 50, initial: 3500 },
    centerXCm: { min: 50, max: 470, step: 5, initial: 260 },
  })
})

test('every figure is what axleLoadsOf returns for the dragged weight and centre of gravity', () => {
  for (const [massKg, centerXCm] of [[3500, 260], [3500, 100], [1000, 100], [0, 260], [2000, 470]] as const) {
    const loads = axleLoadsOf(vehicle, { totalKg: massKg, centerXCm })
    const result = axleTry(vehicle, massKg, centerXCm)
    if (loads.status !== 'computed' || !result) throw new Error('Xe mẫu phải tính được tải trục')
    expect(result.front).toMatchObject(loads.front)
    expect(result.rear).toMatchObject(loads.rear)
    expect(result.front.cargoLoadKg + result.rear.cargoLoadKg).toBeCloseTo(massKg, 6)
  }
})

test('a full, evenly spread load keeps both axles within their limits', () => {
  const result = axleTry(vehicle, 3500, 260)
  // Trục sau nhận 3.500 × (260 + 100) ÷ 442,5 = 2.847,46 kg; trục trước nhận phần còn lại 652,54 kg
  expect(result?.wheelbaseCm).toBe(442.5)
  expect(result?.armCm).toBe(360)
  expect(result?.rear.loadKg).toBeCloseTo(4347.46, 2)
  expect(result?.front.loadKg).toBeCloseTo(2552.54, 2)
  expect(result?.front.percent).toBeCloseTo(91.16, 2)
  expect(result?.rear.percent).toBeCloseTo(83.6, 1)
  expect(result?.front.overKg).toBe(0)
  expect(result?.rear.overKg).toBe(0)
})

test('pushing a full load towards the cab overloads the front axle, and the overload is the load above the limit', () => {
  const result = axleTry(vehicle, 3500, 100)
  // Trục sau 1.500 + 3.500 × 200 ÷ 442,5 = 3.081,92 kg; trục trước 1.900 + 1.918,08 = 3.818,08 kg trên giới hạn 2.800 kg
  expect(result?.front.loadKg).toBeCloseTo(3818.08, 2)
  expect(result?.front.overKg).toBeCloseTo(1018.08, 2)
  expect(result?.rear.overKg).toBe(0)
})

test('a centre of gravity behind the rear axle lifts load off the front axle', () => {
  const result = axleTry(vehicle, 2000, 470)
  // 2.000 × 570 ÷ 442,5 = 2.576,27 kg lên trục sau: nhiều hơn cả khối hàng, nên trục trước nhẹ đi 576,27 kg
  expect(result?.rear.cargoLoadKg).toBeCloseTo(2576.27, 2)
  expect(result?.front.cargoLoadKg).toBeCloseTo(-576.27, 2)
  expect(result?.front.loadKg).toBeCloseTo(1323.73, 2)
})

test('a truck without declared axles has no figures at all', () => {
  expect(axleTry({ ...vehicle, axles: undefined }, 1000, 260)).toBeNull()
})
