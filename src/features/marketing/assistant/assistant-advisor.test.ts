import { describe, expect, test } from 'vitest'
import type { SubscriptionPlan } from '@/lib/mock-db'
import { SEED_PLANS } from '@/lib/mock-db/seed-billing'
import { advise, creditsFor, isValidRuns, MAX_RUNS, parseRuns, pickPlan } from './assistant-advisor'

function plan(id: string, priceVnd: number, monthlyCredits: number | null, extra: Partial<SubscriptionPlan> = {}): SubscriptionPlan {
  return {
    id, name: id, tier: 'BASIC', priceVnd, monthlyCredits, algorithmTier: 'EP_DBLF', features: [], active: true, provisional: false, ...extra,
  }
}

describe('creditsFor', () => {
  test('one optimization run costs 2 credits', () => {
    expect(creditsFor(20)).toBe(40)
    expect(creditsFor(500)).toBe(1000)
    expect(creditsFor(7, 3)).toBe(21)
  })
})

describe('pickPlan', () => {
  const small = plan('S', 1_000_000, 100)
  const large = plan('L', 3_000_000, 1_000)
  const unlimited = plan('U', 8_000_000, null)

  test('the cheapest active plan whose monthly credits cover the need', () => {
    expect(pickPlan([unlimited, large, small], 100)?.id).toBe('S')
    expect(pickPlan([unlimited, large, small], 101)?.id).toBe('L')
    expect(pickPlan([unlimited, large, small], 5_000)?.id).toBe('U')
  })

  test('a plan not on sale is never suggested', () => {
    expect(pickPlan([plan('S', 1_000_000, 100, { active: false }), large], 50)?.id).toBe('L')
  })

  test('no plan covers the need: null', () => {
    expect(pickPlan([small, large], 1_001)).toBeNull()
    expect(pickPlan([], 1)).toBeNull()
  })

  test('same price: the limited plan comes before the unlimited one', () => {
    expect(pickPlan([plan('U', 2_000_000, null), plan('L', 2_000_000, 500)], 10)?.id).toBe('L')
  })

  test('seed catalogue: Basic up to 3,000 credits, then Pro, then Ultimate — all provisional', () => {
    expect(advise(1_500, SEED_PLANS).plan?.name).toBe('Basic')
    expect(advise(1_501, SEED_PLANS).plan?.name).toBe('Pro')
    expect(advise(5_001, SEED_PLANS)).toMatchObject({ runs: 5_001, cost: 2, credits: 10_002, plan: { name: 'Ultimate', provisional: true } })
  })
})

describe('parseRuns', () => {
  test('the first number in what the visitor typed, thousand separators removed', () => {
    expect(parseRuns('300')).toBe(300)
    expect(parseRuns('khoảng 300 lần mỗi tháng')).toBe(300)
    expect(parseRuns('1.000')).toBe(1000)
    expect(parseRuns('1,000 runs')).toBe(1000)
    expect(parseRuns('2 000')).toBe(2000)
  })

  test('no number, zero or out of range: null', () => {
    expect(parseRuns('nhiều lắm')).toBeNull()
    expect(parseRuns('0')).toBeNull()
    expect(parseRuns(String(MAX_RUNS + 1))).toBeNull()
  })

  test('isValidRuns: whole numbers from 1 to MAX_RUNS', () => {
    expect([1, MAX_RUNS].map(isValidRuns)).toStrictEqual([true, true])
    expect([0, -1, 1.5, Number.NaN, MAX_RUNS + 1].map(isValidRuns)).toStrictEqual([false, false, false, false, false])
  })
})
