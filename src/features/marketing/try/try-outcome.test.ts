import { expect, test } from 'vitest'
import { optimizationRequestSchema } from '@/domain/models'
import { runMockCandidates } from '@/services/optimization'
import { toTryInput, TRY_DEFAULTS, type TryInput } from './try-form'
import { tryOutcome } from './try-outcome'
import { buildTryRequest, tryRequestIssues } from './try-request'

/** Đồng hồ giả: `runtimeMs` tất định. */
const clock = () => 0

function run(input: TryInput) {
  const request = buildTryRequest(input)
  return tryOutcome(input, request, runMockCandidates(request, { clock }).plans)
}

const DEFAULTS = toTryInput(TRY_DEFAULTS) as TryInput

test('the trial truck is the visitor\'s body with a full-size rear door, no obstacles and no axles; cartons are not must-load', () => {
  const request = buildTryRequest({
    truck: { lengthCm: 600.04, widthCm: 240, heightCm: 250, payloadKg: 5000.004 },
    cartons: [
      { lengthCm: 120, widthCm: 60, heightCm: 45, weightKg: 30, quantity: 4, stop: 1 },
      { lengthCm: 50, widthCm: 40, heightCm: 30, weightKg: 8.5, quantity: 10, stop: 3 },
    ],
  })
  expect(optimizationRequestSchema.safeParse(request).success).toBe(true)
  expect(request.vehicle).toMatchObject({
    innerLengthCm: 600,
    innerWidthCm: 240,
    innerHeightCm: 250,
    maxPayloadKg: 5000,
    doorWidthCm: 240,
    doorHeightCm: 250,
    doorPosition: 'REAR',
    obstacles: [],
  })
  expect(request.vehicle.axles).toBeUndefined()
  expect(request.packages.map(({ id, quantity, deliveryStop, mustLoad, keepUpright }) => ({ id, quantity, deliveryStop, mustLoad, keepUpright }))).toEqual([
    { id: 'TRY-1', quantity: 4, deliveryStop: 1, mustLoad: false, keepUpright: true },
    { id: 'TRY-2', quantity: 10, deliveryStop: 3, mustLoad: false, keepUpright: true },
  ])
  expect(request.settings.method).toBe('MOCK')
  expect(tryRequestIssues(request)).toEqual([])
})

test('the default run loads all 120 cartons in three plans; with one stop there is no rehandling figure, and B balances best', () => {
  const outcome = run(DEFAULTS)
  expect(outcome.totalCount).toBe(120)
  expect(outcome.multiStop).toBe(false)
  expect(outcome.plans.map((plan) => [plan.id, plan.objective])).toEqual([['A', 'MAX_VOLUME'], ['B', 'AXLE_BALANCE'], ['C', 'MIN_REHANDLING']])
  for (const plan of outcome.plans) {
    expect(plan.placedCount).toBe(120)
    expect(plan.unplaced).toEqual([])
    expect(plan.rehandlingCount).toBeNull()
    expect(plan.result.isMockResult).toBe(true)
  }
  // 120 × 60 × 40 × 40 cm trên 520 × 200 × 200 cm
  expect(outcome.plans[0]?.volumePercent).toBeCloseTo(55.38, 2)
  // Mọi phương án xếp hết và cùng thể tích: không ai "tốt nhất" ở hai số đó
  expect(outcome.best.placed).toBeUndefined()
  expect(outcome.best.volume).toBeUndefined()
  expect(outcome.best.rehandling).toBeUndefined()
  expect([...(outcome.best.balance ?? [])]).toEqual(['B'])
})

test('when two objectives pick the same layout the later plan says which plan it repeats', () => {
  const outcome = run(DEFAULTS)
  const byId = new Map(outcome.plans.map((plan) => [plan.id, plan]))
  expect(byId.get('A')?.sameAs).toBeNull()
  for (const plan of outcome.plans) {
    if (plan.sameAs === null) continue
    const twin = byId.get(plan.sameAs)
    expect(twin?.result.placements).toEqual(plan.result.placements)
  }
})

test('with two stops every plan has a rehandling figure', () => {
  const outcome = run({
    ...DEFAULTS,
    cartons: [...DEFAULTS.cartons, { lengthCm: 40, widthCm: 30, heightCm: 30, weightKg: 8, quantity: 60, stop: 2 }],
  })
  expect(outcome.multiStop).toBe(true)
  expect(outcome.totalCount).toBe(180)
  for (const plan of outcome.plans) expect(plan.rehandlingCount).toEqual(expect.any(Number))
})

test('cartons over the payload are left out with their reason, grouped by carton type', () => {
  const outcome = run({
    truck: { lengthCm: 600, widthCm: 240, heightCm: 250, payloadKg: 100 },
    cartons: [
      { lengthCm: 40, widthCm: 30, heightCm: 30, weightKg: 1, quantity: 2, stop: 1 },
      { lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 60, quantity: 3, stop: 1 },
    ],
  })
  for (const plan of outcome.plans) {
    expect(plan.placedCount + plan.unplaced.reduce((sum, item) => sum + item.count, 0)).toBe(5)
    expect(plan.unplaced).toEqual([{ kind: 1, reason: 'OVER_PAYLOAD', count: 2 }])
  }
})

test('a carton too big for the door does not fail the run: it is reported, the rest is loaded', () => {
  const input: TryInput = {
    truck: { lengthCm: 400, widthCm: 200, heightCm: 200, payloadKg: 5000 },
    cartons: [
      { lengthCm: 50, widthCm: 50, heightCm: 50, weightKg: 10, quantity: 2, stop: 1 },
      { lengthCm: 250, widthCm: 250, heightCm: 100, weightKg: 10, quantity: 1, stop: 1 },
    ],
  }
  expect(tryRequestIssues(buildTryRequest(input))).toEqual([])
  for (const plan of run(input).plans) {
    expect(plan.placedCount).toBe(2)
    expect(plan.unplaced).toEqual([{ kind: 1, reason: 'DOOR_TOO_SMALL', count: 1 }])
  }
})
