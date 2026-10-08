import { describe, expect, test } from 'vitest'
import { SPEC_CARTON_A, SPEC_TRUCK_6M } from '@/domain/fixtures/spec-samples'
import { overlaps } from '@/domain/geometry'
import { placementToBox, type CargoPackage, type PackagePlacement, type VehicleConfig } from '@/domain/models'
import { freedZones } from '@/domain/pickup'
import { placed } from '@/test/placements'
import { reoptimizeFreedZone, type ReoptimizeFreedZoneInput } from './reoptimize-freed-zone'

/**
 * Tái tối ưu vùng trống (FE-BL-01). Thùng 600 × 240 × 250 cm, tải 3.000 kg, hai trục (−100 cm: rỗng 1.000 / tối đa 2.000 kg;
 * 500 cm: rỗng 1.000 / tối đa 2.500 kg). Ba vùng của phương án — điểm 1 sát cửa X 400–600 đã giao xong; điểm 2 X 200–390; điểm 3 X 0–190.
 * Thứ tự giao của kiện đang chở: điểm 2 và 3 giữ nguyên số; kiện nhận giao ở thứ tự 2 (ngay sau điểm hiện tại là điểm 1).
 */

const VEHICLE: VehicleConfig = {
  ...SPEC_TRUCK_6M, obstacles: [], innerHeightCm: 250, maxPayloadKg: 3000, doorWidthCm: 220, doorHeightCm: 230,
  axles: [
    { id: 'AX-1', name: 'Cầu trước', positionXCm: -100, emptyLoadKg: 1000, maxLoadKg: 2000 },
    { id: 'AX-2', name: 'Cầu sau', positionXCm: 500, emptyLoadKg: 1000, maxLoadKg: 2500 },
  ],
}
const ZONES = [
  { id: 'ZONE-3', stopId: 3, startXCm: 0, endXCm: 190 },
  { id: 'ZONE-2', stopId: 2, startXCm: 200, endXCm: 390 },
  { id: 'ZONE-1', stopId: 1, startXCm: 400, endXCm: 600 },
]

const cargo = (id: string, patch: Partial<CargoPackage> = {}): CargoPackage => ({
  ...SPEC_CARTON_A, id, name: id, lengthCm: 100, widthCm: 100, heightCm: 100, weightKg: 50, quantity: 1, allowedOrientations: ['LWH', 'WLH'],
  keepUpright: true, fragilityLevel: 'NONE', stackable: true, maxTopLoadKg: 500, maxStackCount: undefined, minSupportRatio: 0.7, deliveryStop: 3, ...patch,
})
const fragile = (id: string) => cargo(id, { fragilityLevel: 'HIGH', stackable: false, maxTopLoadKg: 0 })

/** 400 kg đang chở ở X 210–310 (điểm 3, vùng của điểm 2), tâm hàng x = 260. */
const ON_BOARD = { packages: [cargo('ON-1', { weightKg: 400, lengthCm: 100, widthCm: 240, deliveryStop: 3 })], placements: [placed('ON-1-01', [210, 0, 0], [100, 240, 100])] }

function run(patch: Partial<ReoptimizeFreedZoneInput> & { pickups: CargoPackage[] }, stopsDone = [{ number: 1, completed: true }]) {
  const base = { ...ON_BOARD, onboardKg: 400 }
  const packages = patch.packages ?? base.packages
  const onboard = patch.onboard ?? base.placements
  const freed = patch.freed ?? freedZones({ vehicle: VEHICLE, zones: ZONES, stops: stopsDone, onboardKg: base.onboardKg })
  return reoptimizeFreedZone({ vehicle: VEHICLE, freed, packages, onboard, loadedAfterStop: 1, ...patch })
}

describe('four 100 cm boxes of 50 kg go into the freed zone of stop 1 and leave the cargo alone', () => {
  const result = run({ pickups: ['P1', 'P2', 'P3', 'P4'].map((id) => cargo(id, { deliveryStop: 2 })) })

  test('they land on the floor of X 400–600, deepest and leftmost first, inside the freed box', () => {
    expect(result.unplaced).toStrictEqual([])
    expect(result.placements.map(({ xCm, yCm, zCm }) => [xCm, yCm, zCm])).toStrictEqual([[400, 0, 0], [400, 100, 0], [500, 0, 0], [500, 100, 0]])
    expect(result.stackingIssues).toStrictEqual([])
    expect(result.blockedCount).toBe(0)
  })

  test('centre of gravity 340 cm and axle loads 1.160 / 1.440 kg after the pickup, from 400 kg at x = 260 before', () => {
    expect(result.before.totalKg).toBe(400)
    expect(result.before.centerOfGravityCm).toStrictEqual({ x: 260, y: 120, z: 50 })
    expect(result.after.totalKg).toBe(600)
    expect(result.after.centerOfGravityCm?.x).toBeCloseTo(340, 9)
    expect(result.after.centerOfGravityCm?.y).toBeCloseTo(340 / 3, 9)
    expect(result.after.axle).toMatchObject({ status: 'computed', front: { loadKg: 1160 }, rear: { loadKg: 1440 } })
  })
})

test('a box already lying inside the freed span is never moved or overlapped: the pickup goes behind it', () => {
  const lying = cargo('ON-2', { deliveryStop: 3, lengthCm: 100, widthCm: 240, heightCm: 100 })
  const onboard: PackagePlacement[] = [...ON_BOARD.placements, placed('ON-2-01', [400, 0, 0], [100, 240, 100])]
  const result = run({ packages: [...ON_BOARD.packages, lying], onboard, pickups: [cargo('P1', { deliveryStop: 2 }), cargo('P2', { deliveryStop: 2 })] })
  expect(result.unplaced).toStrictEqual([])
  for (const spot of result.placements) {
    const box = { xCm: spot.xCm, yCm: spot.yCm, zCm: spot.zCm, lengthCm: spot.placedLengthCm, widthCm: spot.placedWidthCm, heightCm: spot.placedHeightCm }
    expect(overlaps(box, placementToBox(onboard[1] as PackagePlacement))).toBe(false)
    expect(box.xCm).toBeGreaterThanOrEqual(500)
  }
})

describe('packages that cannot be placed say why', () => {
  const unplacedOf = (pickup: CargoPackage) => run({ pickups: [pickup] }).unplaced

  test.each([
    { what: '300 cm long: longer than the 200 cm freed zone, no turning helps', pickup: cargo('P1', { lengthCm: 300, deliveryStop: 2 }), reasonCode: 'NO_SPACE' },
    { what: '3.000 kg: more than the payload left (2.600 kg)', pickup: cargo('P1', { weightKg: 3000, deliveryStop: 2 }), reasonCode: 'OVER_PAYLOAD' },
    { what: '240 cm tall and kept upright: does not pass the 230 cm door', pickup: cargo('P1', { heightCm: 240, deliveryStop: 2 }), reasonCode: 'DOOR_TOO_SMALL' },
  ])('$what', ({ pickup, reasonCode }) => {
    expect(unplacedOf(pickup)).toStrictEqual([{ packageIndex: 0, reasonCode }])
  })

  test('no stop delivered yet: there is no freed space at all', () => {
    expect(run({ pickups: [cargo('P1', { deliveryStop: 2 })] }, [{ number: 1, completed: false }]).unplaced).toStrictEqual([{ packageIndex: 0, reasonCode: 'NO_SPACE' }])
  })
})

describe('a fragile package is never stacked under another', () => {
  // Chỉ một vùng rộng 100 cm trống: sàn nhận hai kiện 100 × 100, kiện thứ ba chỉ còn cách xếp lên trên
  const narrow = freedZones({ vehicle: VEHICLE, zones: [{ id: 'ZONE-1', stopId: 1, startXCm: 400, endXCm: 500 }], stops: [{ number: 1, completed: true }], onboardKg: 400 })
  const three = (kinds: ('F' | 'S')[]) =>
    run({ freed: narrow, pickups: kinds.map((kind, index) => ({ ...(kind === 'F' ? fragile : cargo)(`P${index + 1}`), deliveryStop: 2 })) })

  test('two fragile boxes on the floor: the third has nowhere to go', () => {
    expect(three(['F', 'F', 'S']).unplaced).toStrictEqual([{ packageIndex: 2, reasonCode: 'STACKING_VIOLATION' }])
  })

  test('two standard boxes on the floor: the fragile one rests on top, with full support and no stacking issue', () => {
    const result = three(['S', 'S', 'F'])
    expect(result.unplaced).toStrictEqual([])
    expect(result.placements.map(({ xCm, yCm, zCm }) => [xCm, yCm, zCm])).toStrictEqual([[400, 0, 0], [400, 100, 0], [400, 0, 100]])
    expect(result.stackingIssues).toStrictEqual([])
  })
})

describe('the pickup does not block cargo that is still on board', () => {
  // Kiện 100 cm của điểm 3 ở X 300–400, ngay trước vùng trống; kiện nhận giao ở thứ tự 4 (sau nó) đặt ở X 400 che kín mặt sau của nó
  const behind = cargo('ON-3', { deliveryStop: 3 })
  const onboard = [placed('ON-3-01', [300, 0, 0], [100, 100, 100])]
  const pickups = [cargo('P1', { deliveryStop: 4 })]

  test('a pickup delivered after it blocks it', () => {
    expect(run({ packages: [behind], onboard, pickups, loadedAfterStop: 2 }).blockedCount).toBe(1)
  })

  test('cargo of the stop the vehicle is at leaves before the pickup is loaded: it does not count', () => {
    expect(run({ packages: [behind], onboard, pickups, loadedAfterStop: 3 }).blockedCount).toBe(0)
  })
})

test('the same input gives the same result', () => {
  const pickups = ['P1', 'P2', 'P3'].map((id, index) => cargo(id, { deliveryStop: 2, widthCm: 80 + index * 10 }))
  expect(run({ pickups })).toStrictEqual(run({ pickups }))
})

test('with 1.000 packages on board and four pickups it answers in well under a second', () => {
  const row = cargo('BULK', { quantity: 1000, lengthCm: 25, widthCm: 25, heightCm: 25, weightKg: 1, deliveryStop: 3, maxTopLoadKg: 1000 })
  const onboard: PackagePlacement[] = []
  for (let index = 0; onboard.length < 1000; index += 1) {
    const x = Math.floor(index / 90) % 15, y = Math.floor(index / 10) % 9, z = index % 10
    onboard.push(placed(`BULK-${String(onboard.length + 1).padStart(4, '0')}`, [x * 25, y * 25, z * 25], [25, 25, 25]))
  }
  const started = performance.now()
  const result = run({ packages: [row], onboard, freed: freedZones({ vehicle: VEHICLE, zones: ZONES, stops: [{ number: 1, completed: true }], onboardKg: 1000 }), pickups: ['P1', 'P2', 'P3', 'P4'].map((id) => cargo(id, { deliveryStop: 2 })) })
  const elapsedMs = performance.now() - started
  expect(result.unplaced).toStrictEqual([])
  expect(elapsedMs).toBeLessThan(1000)
})
