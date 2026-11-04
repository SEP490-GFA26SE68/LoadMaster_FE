import { expect, test } from 'vitest'
import {
  algorithmBlock,
  algorithmChoices,
  assertRunAlgorithm,
  defaultAlgorithm,
  OPTIMIZATION_ALGORITHMS,
  planAlgorithms,
  requiredPlanTier,
  RUNNABLE_ALGORITHMS,
} from '@/lib/mock-db'

/**
 * Chọn thuật toán theo hạng gói: bảng thuật toán gói cho phép đối chiếu với `TIER_ALLOWED_ALGORITHMS` của dịch vụ tối ưu
 * (`algorithm_tier_service.py`: BASIC {EP_DBLF}, PRO {EP_DBLF, EP_DBLF_GA}, ULTIMATE cả ba), và bảng thuật toán mỗi nguồn chạy được.
 */
const EVERY = ['EP_DBLF', 'EP_DBLF_GA', 'EP_DBLF_GA_AI'] as const

test('the algorithms are the three of the optimization service, in tier order', () => {
  expect(OPTIMIZATION_ALGORITHMS).toStrictEqual(EVERY)
})

test('a plan allows the algorithms of its tier and of every tier below it; no plan falls back to Basic like the service does', () => {
  expect(planAlgorithms('EP_DBLF')).toStrictEqual(['EP_DBLF'])
  expect(planAlgorithms('EP_DBLF_GA')).toStrictEqual(['EP_DBLF', 'EP_DBLF_GA'])
  expect(planAlgorithms('EP_DBLF_GA_AI')).toStrictEqual(['EP_DBLF', 'EP_DBLF_GA', 'EP_DBLF_GA_AI'])
  expect(planAlgorithms(null)).toStrictEqual(['EP_DBLF'])
})

test('each algorithm names the lowest plan that has it', () => {
  expect(EVERY.map(requiredPlanTier)).toStrictEqual(['BASIC', 'PRO', 'ULTIMATE'])
})

test('the demo store only runs EP + DBLF', () => {
  expect(RUNNABLE_ALGORITHMS.mock).toStrictEqual(['EP_DBLF'])
})

test('the plan reason comes before the source reason; EP + DBLF is never blocked', () => {
  const mock = RUNNABLE_ALGORITHMS.mock
  expect(EVERY.map((algorithm) => algorithmBlock(algorithm, 'EP_DBLF', mock))).toStrictEqual([null, 'ALGORITHM_NOT_ALLOWED', 'ALGORITHM_NOT_ALLOWED'])
  expect(EVERY.map((algorithm) => algorithmBlock(algorithm, 'EP_DBLF_GA', mock))).toStrictEqual([null, 'ALGORITHM_UNAVAILABLE', 'ALGORITHM_NOT_ALLOWED'])
  expect(EVERY.map((algorithm) => algorithmBlock(algorithm, 'EP_DBLF_GA_AI', mock))).toStrictEqual([null, 'ALGORITHM_UNAVAILABLE', 'ALGORITHM_UNAVAILABLE'])
  expect(EVERY.map((algorithm) => algorithmBlock(algorithm, null, mock))).toStrictEqual([null, 'ALGORITHM_NOT_ALLOWED', 'ALGORITHM_NOT_ALLOWED'])
  // Nguồn chạy được cả ba: chỉ còn lý do của gói
  expect(EVERY.map((algorithm) => algorithmBlock(algorithm, 'EP_DBLF_GA', EVERY))).toStrictEqual([null, null, 'ALGORITHM_NOT_ALLOWED'])
})

test('the choices list all three algorithms in order with the reason each one is blocked and the plan it needs', () => {
  expect(algorithmChoices('EP_DBLF_GA', RUNNABLE_ALGORITHMS.mock)).toStrictEqual([
    { algorithm: 'EP_DBLF', block: null, requiredTier: 'BASIC' },
    { algorithm: 'EP_DBLF_GA', block: 'ALGORITHM_UNAVAILABLE', requiredTier: 'PRO' },
    { algorithm: 'EP_DBLF_GA_AI', block: 'ALGORITHM_NOT_ALLOWED', requiredTier: 'ULTIMATE' },
  ])
})

test('the default is the highest algorithm both allowed by the plan and runnable by the source', () => {
  for (const tier of [null, 'EP_DBLF', 'EP_DBLF_GA', 'EP_DBLF_GA_AI'] as const) expect(defaultAlgorithm(tier, RUNNABLE_ALGORITHMS.mock)).toBe('EP_DBLF')
  expect(defaultAlgorithm('EP_DBLF', EVERY)).toBe('EP_DBLF')
  expect(defaultAlgorithm('EP_DBLF_GA', EVERY)).toBe('EP_DBLF_GA')
  expect(defaultAlgorithm('EP_DBLF_GA_AI', EVERY)).toBe('EP_DBLF_GA_AI')
  expect(defaultAlgorithm('EP_DBLF_GA_AI', ['EP_DBLF_GA'])).toBe('EP_DBLF_GA')
})

test('a blocked algorithm is a data error with the algorithm and, for the plan reason, the plan it needs', () => {
  expect(() => assertRunAlgorithm('EP_DBLF_GA', 'EP_DBLF', RUNNABLE_ALGORITHMS.mock))
    .toThrow(expect.objectContaining({ code: 'ALGORITHM_NOT_ALLOWED', params: { algorithm: 'EP_DBLF_GA', requiredTier: 'PRO' } }))
  expect(() => assertRunAlgorithm('EP_DBLF_GA', 'EP_DBLF_GA', RUNNABLE_ALGORITHMS.mock))
    .toThrow(expect.objectContaining({ code: 'ALGORITHM_UNAVAILABLE', params: { algorithm: 'EP_DBLF_GA' } }))
  expect(() => assertRunAlgorithm('EP_DBLF', null, RUNNABLE_ALGORITHMS.mock)).not.toThrow()
})
