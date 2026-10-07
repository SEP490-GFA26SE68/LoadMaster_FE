import { describe, expect, test } from 'vitest'
import {
  evaluatePickup,
  insertPickupStops,
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

/** Thùng 600 × 240 × 240 cm, hai trục cách nhau 600 cm; tải trọng 3.000 kg. */
function context(patch: Partial<PickupContext> = {}): PickupContext {
  return {
    request: { pickup: { lat: LAT, lng: 106.75 }, delivery: { lat: LAT, lng: 106.75 }, deadline: '2026-10-07T12:00:00.000Z', packages: boxes(4) },
    vehicle: {
      innerLengthCm: 600, innerWidthCm: 240, innerHeightCm: 240, maxPayloadKg: 3000,
      axles: [
        { id: 'AX-1', name: 'Cầu trước', positionXCm: -100, emptyLoadKg: 1000, maxLoadKg: 2000 },
        { id: 'AX-2', name: 'Cầu sau', positionXCm: 500, emptyLoadKg: 1000, maxLoadKg: 2500 },
      ],
    },
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
    tripCargo: [{ id: 'PKG-001', quantity: 30, handlingClass: 'STANDARD' }],
    ...patch,
  }
}

const withRequest = (patch: Partial<PickupContext['request']>) => context({ request: { ...context().request, ...patch } })
const withPackages = (packages: PickupCargo[]) => withRequest({ packages })
const rule = (ctx: PickupContext, number: number) => evaluatePickup(ctx).find((result) => result.rule === number)

test('returns ten results in rule order; rules 4-7 and 10 are estimates, the others are not', () => {
  const results = evaluatePickup(context())
  expect(results.map((result) => result.rule)).toStrictEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  expect(results.filter((result) => result.estimated).map((result) => result.rule)).toStrictEqual([4, 5, 6, 7, 10])
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
    expect(rule(ctx, 1)).toMatchObject({ rule: 1, passed, code, estimated: false })
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
    expect(rule(ctx, 2)).toMatchObject({ rule: 2, passed, code, estimated: false })
  })

  test('a stop with no cargo left is not protected: the protected stop is the next one that still carries cargo', () => {
    const stops = [...STOPS.slice(0, 2), stop(3, 106.8, { onboardCount: 0 }), stop(4, 106.9, { onboardCount: 5 })]
    expect(rule(at(106.8, stops), 2)).toMatchObject({ passed: true })
    expect(rule(at(106.85, stops), 2)).toMatchObject({ passed: true })
    expect(rule(at(106.95, stops), 2)).toMatchObject({ passed: false, code: 'PICKUP_DELIVERY_BEYOND_PROTECTED' })
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
    expect(rule({ ...ctx, vehicle: { ...ctx.vehicle, maxPayloadKg } }, 3)).toMatchObject({ passed, code, estimated: false, params: { totalKg: 600, overKg } })
  })
})

describe('rule 4: the freed zones have room (estimate by volume)', () => {
  test('4 boxes of 1 m³ fit into the 11.52 m³ freed by STOP-01', () => {
    expect(rule(context(), 4)).toMatchObject({ passed: true, code: 'PICKUP_FREED_SPACE_OK', estimated: true, params: { pickupCm3: 4_000_000, freedCm3: 11_520_000 } })
  })

  test('12 boxes of 1 m³ do not', () => {
    expect(rule(withPackages(boxes(12)), 4)).toMatchObject({ passed: false, code: 'PICKUP_FREED_SPACE_INSUFFICIENT' })
  })

  test('nothing delivered yet: no freed zone, no room', () => {
    const ctx = context({ stops: STOPS.map((item) => ({ ...item, completed: false })) })
    expect(rule(ctx, 4)).toMatchObject({ passed: false, params: { freedCm3: 0 } })
  })
})

describe('rules 5 and 6: axle load and centre of gravity with the pickup placed in the middle of the freed zones (estimate)', () => {
  test('200 kg at x = 500 behind 400 kg at x = 260: centre 340 cm, rear axle 1.440 kg of 2.500', () => {
    expect(rule(context(), 5)).toMatchObject({ passed: true, code: 'PICKUP_AXLE_OK', estimated: true, params: { frontLoadKg: 1160, rearLoadKg: 1440 } })
    expect(rule(context(), 6)).toMatchObject({ passed: true, code: 'PICKUP_COG_OK', estimated: true })
  })

  test('2.000 kg at x = 500: centre 460 cm, rear axle 3.240 kg of 2.500', () => {
    expect(rule(withPackages(boxes(4, { weightKg: 500 })), 5)).toMatchObject({
      passed: false, code: 'PICKUP_AXLE_OVERLOAD', params: { rearLoadKg: 3240, overKg: 740 },
    })
  })

  test('1.200 kg at x = 500: centre 440 cm is 140 cm from the middle, more than 15 % of 600 cm', () => {
    expect(rule(withPackages(boxes(4, { weightKg: 300 })), 6)).toMatchObject({ passed: false, code: 'PICKUP_COG_OFF_CENTER' })
  })

  test('a vehicle that declares no axle is not checked, not failed', () => {
    const ctx = context()
    const { axles: _axles, ...vehicle } = ctx.vehicle
    expect(rule({ ...ctx, vehicle }, 5)).toMatchObject({ passed: true, code: 'PICKUP_AXLE_UNAVAILABLE' })
  })
})

describe('rule 7: stacking — a fragile box is not stacked under another (estimate)', () => {
  // Vùng trống rộng 200 × 240 = 48.000 cm²; mỗi thùng chiếm 10.000 cm²
  const fragile = (count: number) => [...boxes(count - 1), { ...STANDARD_BOX, handlingClass: 'FRAGILE' as const }]

  test('four boxes fit in one layer, fragile or not', () => {
    expect(rule(withPackages(fragile(4)), 7)).toMatchObject({ passed: true, code: 'PICKUP_STACK_OK', estimated: true })
  })

  test('five boxes need two layers: fragile among them fails, none fragile passes', () => {
    expect(rule(withPackages(fragile(5)), 7)).toMatchObject({ passed: false, code: 'PICKUP_FRAGILE_STACKED', params: { layers: 2 } })
    expect(rule(withPackages(boxes(5)), 7)).toMatchObject({ passed: true })
  })
})

describe('rule 8: same handling class as the trip, or the trip already has a reason to override', () => {
  const fragile = withPackages([{ ...STANDARD_BOX, handlingClass: 'FRAGILE' }])

  test('same class passes', () => {
    expect(rule(context(), 8)).toMatchObject({ passed: true, code: 'PICKUP_CLASS_OK', estimated: false })
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
    expect(rule(standing(deadline), 9)).toMatchObject({ passed, code, estimated: false, params: { eta: '2026-10-07T03:30:00.000Z' } })
  })

  test('a request without a deadline has nothing to miss', () => {
    expect(rule(withRequest({ deadline: undefined }), 9)).toMatchObject({ passed: true, code: 'PICKUP_NO_DEADLINE' })
  })

  test('a deadline 10 minutes from now cannot be met after the 15-minute stop at STOP-02', () => {
    expect(rule(withRequest({ deadline: '2026-10-07T03:10:00.000Z' }), 9)).toMatchObject({ passed: false, code: 'PICKUP_DEADLINE_MISSED' })
  })
})

describe('rule 10: the pickup does not block cargo that is still on board (estimate)', () => {
  test('cargo deeper than the freed zone is not blocked', () => {
    expect(rule(context(), 10)).toMatchObject({ passed: true, code: 'PICKUP_NOT_BLOCKING', estimated: true })
  })

  test('cargo of a later stop that sits in the freed zone would be blocked', () => {
    const ctx = context({ onboard: [{ xCm: 450, yCm: 0, zCm: 0, lengthCm: 100, widthCm: 240, heightCm: 100, weightKg: 400 }] })
    expect(rule(ctx, 10)).toMatchObject({ passed: false, code: 'PICKUP_BLOCKS_CARGO', params: { blockedCount: 1 } })
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
