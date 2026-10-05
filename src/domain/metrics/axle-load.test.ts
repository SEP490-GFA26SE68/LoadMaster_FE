import { describe, expect, test } from 'vitest'
import { SPEC_CARTON_A } from '@/domain/fixtures/spec-samples'
import { axleLoads, axleLoadsOf, checkAxleLoads, computeMetrics } from '@/domain/metrics'
import type { CargoPackage, VehicleAxle, VehicleConfig } from '@/domain/models'
import { EMPTY_TRUCK_6M, placed } from '@/test/placements'

/**
 * Xe ba trục cho bài tính tay. Trục trước dưới cabin, 120 cm trước vách đầu thùng; hai trục sau ở 400 và 520 cm nên nhóm sau đặt tại
 * (400 + 520) / 2 = 460 cm. Khoảng cách hai nhóm: 460 − (−120) = 580 cm. Tải rỗng: trước 2.000 kg, sau 900 + 900 = 1.800 kg.
 */
const AXLES: VehicleAxle[] = [
  { id: 'AXLE-02', name: 'Trục sau 1', positionXCm: 400, emptyLoadKg: 900, maxLoadKg: 4500 },
  { id: 'AXLE-01', name: 'Trục trước', positionXCm: -120, emptyLoadKg: 2000, maxLoadKg: 3000 },
  { id: 'AXLE-03', name: 'Trục sau 2', positionXCm: 520, emptyLoadKg: 900, maxLoadKg: 4500 },
]
const TRUCK: VehicleConfig = { ...EMPTY_TRUCK_6M, axles: AXLES }

function cargo(id: string, weightKg: number): CargoPackage {
  return { ...SPEC_CARTON_A, id, weightKg, quantity: 1 }
}

describe('lever model with hand-computed numbers', () => {
  test('1,160 kg centred 290 cm behind the front axle, half the 580 cm wheelbase, splits evenly: 580 kg each', () => {
    // Hộp x 120..220 → tâm 170; cách trục trước 170 + 120 = 290. Sau = 1160 × 290 / 580 = 580; trước = 1160 − 580 = 580.
    const loads = axleLoads(TRUCK, [placed('HEAVY-01', [120, 0, 0], [100, 60, 45])], [cargo('HEAVY', 1160)])
    expect(loads).toStrictEqual({
      status: 'computed',
      front: { positionXCm: -120, emptyLoadKg: 2000, cargoLoadKg: 580, loadKg: 2580, limitKg: 3000 },
      rear: { positionXCm: 460, emptyLoadKg: 1800, cargoLoadKg: 580, loadKg: 2380, limitKg: 9000 },
    })
  })

  test('two packages act through their common centre of gravity', () => {
    // 580 kg tại x 25 và 870 kg tại x 315: trọng tâm (580 × 25 + 870 × 315) / 1450 = 288550 / 1450 = 199.
    // Sau = 1450 × (199 + 120) / 580 = 797,5; trước = 1450 − 797,5 = 652,5.
    const loads = axleLoads(
      TRUCK,
      [placed('A-01', [0, 0, 0], [50, 60, 45]), placed('B-01', [290, 0, 0], [50, 60, 45])],
      [cargo('A', 580), cargo('B', 870)],
    )
    if (loads.status !== 'computed') throw new Error('expected computed loads')
    expect([loads.front.cargoLoadKg, loads.rear.cargoLoadKg]).toStrictEqual([652.5, 797.5])
    expect([loads.front.loadKg, loads.rear.loadKg]).toStrictEqual([2652.5, 2597.5])
  })

  test('cargo behind the rear group takes load off the front axle; the total stays empty load plus cargo', () => {
    // Tâm 547, sau nhóm trục sau (460): sau = 580 × (547 + 120) / 580 = 667; trước = 580 − 667 = −87.
    const loads = axleLoads(TRUCK, [placed('TAIL-01', [522, 0, 0], [50, 60, 45])], [cargo('TAIL', 580)])
    if (loads.status !== 'computed') throw new Error('expected computed loads')
    expect([loads.front.loadKg, loads.rear.loadKg]).toStrictEqual([1913, 2467])
    expect(loads.front.loadKg + loads.rear.loadKg).toBe(2000 + 1800 + 580)
  })

  test('an empty plan leaves each group at its empty load', () => {
    const loads = axleLoads(TRUCK, [], [])
    if (loads.status !== 'computed') throw new Error('expected computed loads')
    expect([loads.front.loadKg, loads.rear.loadKg]).toStrictEqual([2000, 1800])
  })
})

describe('limits', () => {
  test('the vehicle type limits win over the axle maxima', () => {
    const loads = axleLoadsOf({ ...TRUCK, frontAxleLimitKg: 2500, rearAxleLimitKg: 8000 }, { totalKg: 0 })
    if (loads.status !== 'computed') throw new Error('expected computed loads')
    expect([loads.front.limitKg, loads.rear.limitKg]).toStrictEqual([2500, 8000])
  })

  test('without type limits the front limit is the first axle maximum and the rear limit the sum of the others', () => {
    const loads = axleLoadsOf(TRUCK, { totalKg: 0 })
    if (loads.status !== 'computed') throw new Error('expected computed loads')
    expect([loads.front.limitKg, loads.rear.limitKg]).toStrictEqual([3000, 9000])
  })

  test('an axle maximum of 0 kg is an undeclared limit, not a limit of zero', () => {
    const loads = axleLoadsOf({ axles: AXLES.map((axle) => ({ ...axle, maxLoadKg: 0 })) }, { totalKg: 1160, centerXCm: 170 })
    if (loads.status !== 'computed') throw new Error('expected computed loads')
    expect(loads.front).not.toHaveProperty('limitKg')
    expect(loads.rear).not.toHaveProperty('limitKg')
    expect(checkAxleLoads(loads)).toStrictEqual([])
  })
})

describe('AXLE_OVERLOAD', () => {
  const loaded = { totalKg: 1160, centerXCm: 170 } // trước 2.580 kg, sau 2.380 kg

  test('a group over its limit is an error with the load, the limit and the excess', () => {
    expect(checkAxleLoads(axleLoadsOf({ ...TRUCK, frontAxleLimitKg: 2500, rearAxleLimitKg: 2300 }, loaded))).toStrictEqual([
      { code: 'AXLE_OVERLOAD', severity: 'error', params: { group: 'front', loadKg: 2580, limitKg: 2500, overKg: 80 } },
      { code: 'AXLE_OVERLOAD', severity: 'error', params: { group: 'rear', loadKg: 2380, limitKg: 2300, overKg: 80 } },
    ])
  })

  test('a load exactly on the limit, or below it, is not an overload', () => {
    expect(checkAxleLoads(axleLoadsOf({ ...TRUCK, frontAxleLimitKg: 2580, rearAxleLimitKg: 2380 }, loaded))).toStrictEqual([])
    expect(checkAxleLoads(axleLoadsOf(TRUCK, loaded))).toStrictEqual([])
  })
})

describe('a vehicle without enough axle data is not computed, with the reason', () => {
  const [rearOne, front] = AXLES as [VehicleAxle, VehicleAxle, VehicleAxle]

  test.each([
    ['no axles field', undefined, 'NO_AXLES'],
    ['an empty axle list', [], 'NO_AXLES'],
    ['a single axle', [front], 'SINGLE_AXLE'],
    ['every axle at the same position', [front, { ...rearOne, positionXCm: -120 }], 'AXLES_COINCIDE'],
  ] as const)('%s', (_, axles, reason) => {
    const loads = axleLoadsOf({ axles: axles === undefined ? undefined : [...axles] }, { totalKg: 1160, centerXCm: 170 })
    expect(loads).toStrictEqual({ status: 'unavailable', reason })
    expect(checkAxleLoads(loads)).toStrictEqual([])
  })
})

describe('result metrics', () => {
  const input = { placements: [placed('HEAVY-01', [120, 0, 0], [100, 60, 45])], weightByInstanceId: new Map([['HEAVY-01', 1160]]), unplacedCount: 0, runtimeMs: 0 }

  test('carry the front and rear axle loads when the vehicle declares axles', () => {
    const { frontAxleLoadKg, rearAxleLoadKg } = computeMetrics({ vehicle: TRUCK, ...input })
    expect({ frontAxleLoadKg, rearAxleLoadKg }).toStrictEqual({ frontAxleLoadKg: 2580, rearAxleLoadKg: 2380 })
  })

  test('have no axle load fields for a vehicle without axles', () => {
    const metrics = computeMetrics({ vehicle: EMPTY_TRUCK_6M, ...input })
    expect(metrics).not.toHaveProperty('frontAxleLoadKg')
    expect(metrics).not.toHaveProperty('rearAxleLoadKg')
  })
})
