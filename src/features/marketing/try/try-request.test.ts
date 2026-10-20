import { expect, test } from 'vitest'
import { optimizationRequestSchema } from '@/domain/models'
import { runMockOptimization } from '@/services/optimization'
import type { TryInput } from './try-form'
import { buildTryRequest, tryOutcome, tryRequestIssues } from './try-request'

const SPEC_TRY: TryInput = {
  truck: { lengthCm: 600, widthCm: 240, heightCm: 250, payloadKg: 5000 },
  cartons: [{ lengthCm: 120, widthCm: 60, heightCm: 45, weightKg: 30, quantity: 4 }],
}

/** Đồng hồ giả: `runtimeMs` tất định. */
const clock = () => 0

function run(input: TryInput) {
  const request = buildTryRequest(input)
  return { request, outcome: tryOutcome(input, request, runMockOptimization(request, { clock })) }
}

test('the trial truck has the visitor\'s body, a rear door as big as the body and no obstacles; cartons follow the app\'s single-carton defaults', () => {
  const request = buildTryRequest({
    truck: { lengthCm: 600.04, widthCm: 240, heightCm: 250, payloadKg: 5000.004 },
    cartons: [{ lengthCm: 120, widthCm: 60, heightCm: 45, weightKg: 30, quantity: 4 }, { lengthCm: 50, widthCm: 40, heightCm: 30, weightKg: 8.5, quantity: 10 }],
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
    { id: 'TRY-2', quantity: 10, deliveryStop: 1, mustLoad: false, keepUpright: true },
  ])
  expect(request.settings.method).toBe('MOCK')
  expect(tryRequestIssues(request)).toEqual([])
})

test('the Spec truck takes all four Spec cartons', () => {
  const { outcome } = run(SPEC_TRY)
  expect(outcome).toMatchObject({ totalCount: 4, placedCount: 4, usedKg: 120, maxKg: 5000, unplaced: [], isMockResult: true })
  // 4 × 120 × 60 × 45 cm trên 600 × 240 × 250 cm
  expect(outcome.volumePercent).toBeCloseTo(3.6, 6)
  expect(outcome.boxes).toHaveLength(4)
  expect(outcome.boxes.every((box) => box.kind === 0)).toBe(true)
  expect(outcome.container).toEqual({ lengthCm: 600, widthCm: 240, heightCm: 250 })
})

test('cartons over the payload are left out with their reason, grouped by carton type', () => {
  const { outcome } = run({
    truck: { lengthCm: 600, widthCm: 240, heightCm: 250, payloadKg: 100 },
    cartons: [{ lengthCm: 40, widthCm: 30, heightCm: 30, weightKg: 1, quantity: 2 }, { lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 60, quantity: 3 }],
  })
  expect(outcome.totalCount).toBe(5)
  expect(outcome.placedCount + outcome.unplaced.reduce((sum, item) => sum + item.count, 0)).toBe(5)
  expect(outcome.unplaced.every((item) => item.reason === 'OVER_PAYLOAD')).toBe(true)
  expect(outcome.unplaced.map((item) => item.kind)).toEqual([1])
  expect(outcome.usedKg).toBeLessThanOrEqual(100)
})

test('a carton that cannot go through the door does not fail the run: it is reported, the rest is loaded', () => {
  const { request, outcome } = run({
    truck: { lengthCm: 400, widthCm: 200, heightCm: 200, payloadKg: 5000 },
    cartons: [{ lengthCm: 50, widthCm: 50, heightCm: 50, weightKg: 10, quantity: 2 }, { lengthCm: 250, widthCm: 250, heightCm: 100, weightKg: 10, quantity: 1 }],
  })
  expect(tryRequestIssues(request)).toEqual([])
  expect(outcome.placedCount).toBe(2)
  expect(outcome.unplaced).toEqual([{ kind: 1, reason: 'DOOR_TOO_SMALL', count: 1 }])
})
