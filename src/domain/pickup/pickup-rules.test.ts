import { describe, expect, test } from 'vitest'
import { axleLoadsOf } from '@/domain/metrics'
import {
  evaluatePickup,
  insertPickupStops,
  type FreedZonePacking,
  type LoadSnapshot,
  type PickupCargo,
  type PickupContext,
  type PickupRouteStop,
} from '@/domain/pickup'

/**
 * Mười luật nhận hàng dọc đường (FE-7-02, D-88). Hình học của mọi ca nằm trên một đường đông–tây ở vĩ độ 10,9: xe ở kinh độ 106,65,
 * điểm hiện tại STOP-02 ở 106,70, điểm được bảo vệ STOP-03 ở 106,80. Một độ vĩ ≈ 111,1949 km (6371 km × π / 180), nên lệch vĩ độ
 * 0,044966 ≈ 5 km, 0,089932 ≈ 10 km — các hằng số tính bằng máy, không tính lại theo cách code tính.
 */

const LAT = 10.9
const AT = '2026-10-07T03:00:00.000Z'

const STANDARD_BOX: PickupCargo = { lengthCm: 100, widthCm: 100, heightCm: 100, weightKg: 50, handlingClass: 'STANDARD' }
const boxes = (count: number, patch: Partial<PickupCargo> = {}): PickupCargo[] => Array.from({ length: count }, () => ({ ...STANDARD_BOX, ...patch }))

const stop = (number: number, lng: number, patch: Partial<PickupRouteStop> = {}): PickupRouteStop => ({
  stopId: `STOP-0${number}`, number, location: { lat: LAT, lng }, completed: false, onboardCount: 10, ...patch,
})

/** STOP-01 đã giao xong (vùng của nó, X 400–600, là vùng trống); xe đang tới STOP-02; STOP-03 là điểm được bảo vệ. */
const STOPS = [stop(1, 106.55, { completed: true, onboardCount: 0 }), stop(2, 106.7), stop(3, 106.8, { onboardCount: 20 })]

/**
 * Kết quả xếp vào vùng trống (FE-BL-01) do mock tính — kiểm riêng ở `reoptimize-freed-zone.test.ts`; ở đây là số cho sẵn.
 * `snapshot(tổng kg, hoành độ trọng tâm)` trên hai trục của xe: trục trước −100 cm, trục sau 500 cm, trọng tâm ngang giữa thùng.
 */
const AXLES = [
  { id: 'AX-1', name: 'Cầu trước', positionXCm: -100, emptyLoadKg: 1000, maxLoadKg: 2000 },
  { id: 'AX-2', name: 'Cầu sau', positionXCm: 500, emptyLoadKg: 1000, maxLoadKg: 2500 },
]
const snapshot = (totalKg: number, centerX: number, axles = AXLES): LoadSnapshot => ({
  totalKg,
  centerOfGravityCm: { x: centerX, y: 120, z: 50 },
  axle: axleLoadsOf({ axles }, { totalKg, centerXCm: centerX }),
})
/** 400 kg đang chở có tâm ở x = 260; thêm 200 kg ở x = 500 thì tâm 340 cm, trục trước 1.160 kg, trục sau 1.440 kg. */
const PACKING: FreedZonePacking = { placements: [], unplaced: [], before: snapshot(400, 260), after: snapshot(600, 340), stackingIssues: [], blockedCount: 0 }

/** Thùng 600 × 240 × 240 cm, hai trục cách nhau 600 cm; tải trọng 3.000 kg. */
function context(patch: Partial<PickupContext> = {}): PickupContext {
  return {
    request: { pickup: { lat: LAT, lng: 106.75 }, delivery: { lat: LAT, lng: 106.75 }, deadline: '2026-10-07T12:00:00.000Z', packages: boxes(4) },
    vehicle: { innerLengthCm: 600, innerWidthCm: 240, innerHeightCm: 240, maxPayloadKg: 3000, axles: AXLES },
    position: { lat: LAT, lng: 106.65 },
    at: AT,
    stops: STOPS,
    zones: [
      { id: 'ZONE-3', stopId: 3, startXCm: 0, endXCm: 190 },
      { id: 'ZONE-2', stopId: 2, startXCm: 200, endXCm: 390 },
      { id: 'ZONE-1', stopId: 1, startXCm: 400, endXCm: 600 },
    ],
    // 400 kg nằm trong vùng của STOP-02 (X 210–310): tâm hàng x = 260
    onboard: [{ xCm: 210, yCm: 0, zCm: 0, lengthCm: 100, widthCm: 240, heightCm: 100, weightKg: 400 }],
    packing: PACKING,
    tripCargo: [{ id: 'PKG-001', quantity: 30, handlingClass: 'STANDARD' }],
    ...patch,
  }
}

const withRequest = (patch: Partial<PickupContext['request']>) => context({ request: { ...context().request, ...patch } })
const withPackages = (packages: PickupCargo[]) => withRequest({ packages })
const withPacking = (patch: Partial<FreedZonePacking>) => context({ packing: { ...PACKING, ...patch } })
const rule = (ctx: PickupContext, number: number) => evaluatePickup(ctx).find((result) => result.rule === number)

test('returns ten results in rule order, and none of them is an estimate', () => {
  const results = evaluatePickup(context())
  expect(results.map((result) => result.rule)).toStrictEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  expect(results.every((result) => !('estimated' in result))).toBe(true)
  expect(results.every((result) => result.passed)).toBe(true)
})

describe('rule 1: the pickup point is within 10 km of the route and ahead of the vehicle', () => {
  const at = (dLat: number, lng = 106.75) => withRequest({ pickup: { lat: LAT + dLat, lng } })

  test.each([
    { what: '5 km beside the route', ctx: at(0.044966080295936524), passed: true, code: 'PICKUP_ON_ROUTE' },
    { what: 'exactly 10 km beside the route', ctx: at(0.08993216059187305), passed: true, code: 'PICKUP_ON_ROUTE' },
    { what: '10.01 km beside the route', ctx: at(0.09002209275246492), passed: false, code: 'PICKUP_OFF_ROUTE' },
    { what: 'on the route but behind the vehicle', ctx: at(0, 106.64), passed: false, code: 'PICKUP_BEHIND_VEHICLE' },
  ])('$what', ({ ctx, passed, code }) => {
    expect(rule(ctx, 1)).toMatchObject({ rule: 1, passed, code })
  })

  test('no stop left on the route: nothing to be ahead of', () => {
    const ctx = context({ stops: STOPS.map((item) => ({ ...item, completed: true })) })
    expect(rule(ctx, 1)).toMatchObject({ passed: false, code: 'PICKUP_NO_REMAINING_STOP' })
  })
})

describe('rule 2: the delivery point is after the current stop and not beyond the next stop that still carries cargo', () => {
  const at = (lng: number, stops: PickupRouteStop[] = STOPS) => context({ request: { ...context().request, delivery: { lat: LAT, lng } }, stops })

  test.each([
    { what: 'between the current and the protected stop', ctx: at(106.75), passed: true, code: 'PICKUP_DELIVERY_IN_RANGE' },
    { what: 'on the protected stop itself', ctx: at(106.8), passed: true, code: 'PICKUP_DELIVERY_IN_RANGE' },
    { what: 'beyond the protected stop', ctx: at(106.85), passed: false, code: 'PICKUP_DELIVERY_BEYOND_PROTECTED' },
    { what: 'behind the current stop', ctx: at(106.65), passed: false, code: 'PICKUP_DELIVERY_NOT_AFTER_CURRENT' },
    { what: 'on the current stop itself', ctx: at(106.7), passed: false, code: 'PICKUP_DELIVERY_NOT_AFTER_CURRENT' },
  ])('$what', ({ ctx, passed, code }) => {
    expect(rule(ctx, 2)).toMatchObject({ rule: 2, passed, code })
  })

  test('a stop with no cargo left is not protected: the protected stop is the next one that still carries cargo', () => {
    const stops = [...STOPS.slice(0, 2), stop(3, 106.8, { onboardCount: 0 }), stop(4, 106.9, { onboardCount: 5 })]
    expect(rule(at(106.8, stops), 2)).toMatchObject({ passed: true })
    expect(rule(at(106.85, stops), 2)).toMatchObject({ passed: true })
    expect(rule(at(106.95, stops), 2)).toMatchObject({ passed: false, code: 'PICKUP_DELIVERY_BEYOND_PROTECTED' })
  })

  test('the current stop is the last one of the route: any delivery point passes, even one behind it', () => {
    const lastLeg = STOPS.slice(0, 2)
    expect(rule(at(106.9, lastLeg), 2)).toMatchObject({ passed: true, code: 'PICKUP_DELIVERY_IN_RANGE' })
    expect(rule(at(106.6, lastLeg), 2)).toMatchObject({ passed: true, code: 'PICKUP_DELIVERY_IN_RANGE' })
  })
})

describe('rule 3: the vehicle still has payload', () => {
  // 400 kg on board + 4 × 50 kg = 600 kg
  test.each([
    { maxPayloadKg: 3000, passed: true, code: 'PICKUP_PAYLOAD_OK', overKg: 0 },
    { maxPayloadKg: 600, passed: true, code: 'PICKUP_PAYLOAD_OK', overKg: 0 },
    { maxPayloadKg: 599.99, passed: false, code: 'PICKUP_PAYLOAD_EXCEEDED', overKg: 0.01 },
  ])('payload $maxPayloadKg kg', ({ maxPayloadKg, passed, code, overKg }) => {
    const ctx = context()
    expect(rule({ ...ctx, vehicle: { ...ctx.vehicle, maxPayloadKg } }, 3)).toMatchObject({ passed, code, params: { totalKg: 600, overKg } })
  })

  test('pickup packages approved earlier that have no place on the vehicle yet still weigh', () => {
    expect(rule({ ...context(), looseKg: 100 }, 3)).toMatchObject({ params: { totalKg: 700 } })
  })
})

describe('rule 4: every pickup package has a place in the freed zones', () => {
  test('all four placed', () => {
    expect(rule(context(), 4)).toMatchObject({
      passed: true, code: 'PICKUP_FREED_SPACE_OK', params: { pickupCm3: 4_000_000, freedCm3: 11_520_000, totalCount: 4, unplacedCount: 0 },
    })
  })

  test('one without a place fails and says how many', () => {
    expect(rule(withPacking({ unplaced: [{ packageIndex: 3, reasonCode: 'NO_SPACE' }] }), 4)).toMatchObject({
      passed: false, code: 'PICKUP_FREED_SPACE_INSUFFICIENT', params: { totalCount: 4, unplacedCount: 1 },
    })
  })

  test('a package left out only because it would be stacked on a fragile one is rule 7, not rule 4', () => {
    const packing = withPacking({ unplaced: [{ packageIndex: 3, reasonCode: 'STACKING_VIOLATION' }] })
    expect(rule(packing, 4)).toMatchObject({ passed: true })
    expect(rule(packing, 7)).toMatchObject({ passed: false })
  })
})

describe('rules 5 and 6: axle load and centre of gravity of the packed result', () => {
  test('600 kg with centre 340 cm: rear axle 1.440 kg of 2.500, centre inside the limit', () => {
    expect(rule(context(), 5)).toMatchObject({ passed: true, code: 'PICKUP_AXLE_OK', params: { frontLoadKg: 1160, rearLoadKg: 1440 } })
    expect(rule(context(), 6)).toMatchObject({ passed: true, code: 'PICKUP_COG_OK' })
  })

  test('2.400 kg with centre 460 cm: rear axle 3.240 kg of 2.500', () => {
    expect(rule(withPacking({ after: snapshot(2400, 460) }), 5)).toMatchObject({
      passed: false, code: 'PICKUP_AXLE_OVERLOAD', params: { rearLoadKg: 3240, overKg: 740 },
    })
  })

  test('1.600 kg with centre 440 cm is 140 cm from the middle, more than 15 % of 600 cm', () => {
    expect(rule(withPacking({ after: snapshot(1600, 440) }), 6)).toMatchObject({ passed: false, code: 'PICKUP_COG_OFF_CENTER' })
  })

  test('cargo already off-centre before the pickup (centre 160 cm) does not fail a pickup that leaves it just as off-centre', () => {
    expect(rule(withPacking({ before: snapshot(400, 160), after: snapshot(412, 170) }), 6)).toMatchObject({
      passed: true, code: 'PICKUP_COG_NOT_WORSE', params: { reasons: 'COG_LONGITUDINAL' },
    })
  })

  test('a vehicle that declares no axle is not checked, not failed', () => {
    expect(rule(withPacking({ after: snapshot(600, 340, []) }), 5)).toMatchObject({ passed: true, code: 'PICKUP_AXLE_UNAVAILABLE', params: { reason: 'NO_AXLES' } })
  })
})

describe('rule 7: stacking of the packed result', () => {
  test('no stacking issue and nothing left out for stacking passes', () => {
    expect(rule(context(), 7)).toMatchObject({ passed: true, code: 'PICKUP_STACK_OK', params: { count: 0 } })
  })

  test('an issue of the constraint engine on a pickup package fails', () => {
    const issue = { code: 'NOT_STACKABLE', severity: 'error', packageInstanceId: 'PICKUP-1-01', relatedIds: ['PICKUP-2-01'], params: {} } as const
    expect(rule(withPacking({ stackingIssues: [issue] }), 7)).toMatchObject({ passed: false, code: 'PICKUP_FRAGILE_STACKED', params: { count: 1 } })
  })
})

describe('rule 8: same handling class as the trip, or the trip already has a reason to override', () => {
  const fragile = withPackages([{ ...STANDARD_BOX, handlingClass: 'FRAGILE' }])

  test('same class passes', () => {
    expect(rule(context(), 8)).toMatchObject({ passed: true, code: 'PICKUP_CLASS_OK' })
  })

  test('a different class fails', () => {
    expect(rule(fragile, 8)).toMatchObject({ passed: false, code: 'PICKUP_CLASS_CONFLICT', params: { lockedClass: 'STANDARD' } })
  })

  test('a different class passes when the trip carries an override reason', () => {
    expect(rule({ ...fragile, overrideReason: 'Khách gom chung một xe' }, 8)).toMatchObject({ passed: true, code: 'PICKUP_CLASS_OVERRIDDEN' })
  })
})

describe('rule 9: on time at the delivery point, with the ETA of the route after the insertion', () => {
  /** Xe đứng ở STOP-02 từ đúng lúc `AT`, điểm nhận và điểm giao cùng toạ độ: không có chặng đường, ETA chỉ là 15 phút dừng mỗi điểm. */
  function standing(deadline: string): PickupContext {
    const here = { lat: LAT, lng: 106.7 }
    const base = context({ position: here, stops: [STOPS[0] as PickupRouteStop, { ...stop(2, 106.7), arrivedAt: AT }, STOPS[2] as PickupRouteStop] })
    return { ...base, request: { ...base.request, pickup: here, delivery: here, deadline } }
  }

  test.each([
    { deadline: '2026-10-07T03:30:00.000Z', passed: true, code: 'PICKUP_DEADLINE_OK' },
    { deadline: '2026-10-07T03:29:59.999Z', passed: false, code: 'PICKUP_DEADLINE_MISSED' },
  ])('delivery ETA is 03:30:00 — deadline $deadline', ({ deadline, passed, code }) => {
    expect(rule(standing(deadline), 9)).toMatchObject({ passed, code, params: { eta: '2026-10-07T03:30:00.000Z' } })
  })

  test('a request without a deadline has nothing to miss', () => {
    expect(rule(withRequest({ deadline: undefined }), 9)).toMatchObject({ passed: true, code: 'PICKUP_NO_DEADLINE' })
  })
})

describe('rule 10: the packed pickup does not block cargo that is still on board', () => {
  test('nothing blocked', () => {
    expect(rule(context(), 10)).toMatchObject({ passed: true, code: 'PICKUP_NOT_BLOCKING', params: { blockedCount: 0 } })
  })

  test('cargo the packed pickup covers fails and says how many', () => {
    expect(rule(withPacking({ blockedCount: 2 }), 10)).toMatchObject({ passed: false, code: 'PICKUP_BLOCKS_CARGO', params: { blockedCount: 2 } })
  })
})

describe('insertPickupStops', () => {
  const ids = { pickupStopId: 'NEW-PICKUP', deliveryStopId: 'NEW-DELIVERY' }
  const between = { lat: LAT, lng: 106.75 }

  test('puts the pickup and its delivery right after the current stop, the pickup first, and moves no existing stop', () => {
    expect(insertPickupStops(STOPS, ids, between)).toStrictEqual({
      orderedStopIds: ['STOP-01', 'STOP-02', 'NEW-PICKUP', 'NEW-DELIVERY', 'STOP-03'],
      pickupStopId: 'NEW-PICKUP',
      deliveryStopId: 'NEW-DELIVERY',
      deliveryReused: false,
    })
  })

  test('keeps the order of the old stops, including a stop with no cargo between the current and the protected stop', () => {
    const stops = [...STOPS.slice(0, 2), stop(3, 106.8, { onboardCount: 0 }), stop(4, 106.9, { onboardCount: 5 })]
    const inserted = insertPickupStops(stops, ids, between)
    const old = new Set(stops.map((item) => item.stopId))
    expect(inserted?.orderedStopIds.filter((id) => old.has(id))).toStrictEqual(stops.map((item) => item.stopId))
    expect(inserted?.orderedStopIds.slice(0, 4)).toStrictEqual(['STOP-01', 'STOP-02', 'NEW-PICKUP', 'NEW-DELIVERY'])
  })

  test('a delivery on the protected stop reuses it: only the pickup is new', () => {
    expect(insertPickupStops(STOPS, ids, { lat: LAT, lng: 106.8 })).toStrictEqual({
      orderedStopIds: ['STOP-01', 'STOP-02', 'NEW-PICKUP', 'STOP-03'],
      pickupStopId: 'NEW-PICKUP',
      deliveryStopId: 'STOP-03',
      deliveryReused: true,
    })
  })

  test('nothing left on the route: no insertion', () => {
    expect(insertPickupStops(STOPS.map((item) => ({ ...item, completed: true })), ids, between)).toBeNull()
  })
})
