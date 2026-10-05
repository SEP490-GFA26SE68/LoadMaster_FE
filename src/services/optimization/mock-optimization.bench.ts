import { expect, test } from 'vitest'
import { SPEC_CARTON_A, SPEC_TRUCK_6M } from '@/domain/fixtures/spec-samples'
import type { CargoPackage, OptimizationRequest } from '@/domain/models'
import { runMockCandidates, runMockOptimization } from '@/services/optimization'

/**
 * LM-024: 1.000 instance phải xếp xong dưới 1 s trên máy dev (1,5 s khi có biến `CI`). Ba phương án ứng viên của một lần chạy
 * (FE-5b-05) chịu cùng ngân sách: cả job, không phải từng phương án.
 */
const BUDGET_MS = process.env.CI ? 1500 : 1000

/** 1.000 thùng 40 × 30 × 25 cm chia 5 điểm giao, xếp chồng tối đa 10 tầng — vừa Truck 6m bằng xếp kệ. */
const REQUEST: OptimizationRequest = {
  vehicle: SPEC_TRUCK_6M,
  packages: Array.from({ length: 5 }, (_, line): CargoPackage => ({
    ...SPEC_CARTON_A,
    id: `PKG-00${line + 1}`,
    name: `Thùng hàng điểm giao ${line + 1}`,
    lengthCm: 40,
    widthCm: 30,
    heightCm: 25,
    weightKg: 4.5,
    quantity: 200,
    maxTopLoadKg: 60,
    maxStackCount: 10,
    deliveryStop: line + 1,
    mustLoad: false,
  })),
  settings: { method: 'MOCK', timeLimitSeconds: 30, randomSeed: 1, enforceLifo: true, prioritizeLowCenterOfGravity: false },
}

test('mock optimization — 1.000 instance', async ({ bench }) => {
  const result = await bench('runMockOptimization', () => void runMockOptimization(REQUEST)).run({
    retainSamples: true,
    time: 0,
    iterations: 10,
    warmupIterations: 2,
  })
  const samples = result.latency.samples ?? []
  const p95 = samples[Math.ceil(samples.length * 0.95) - 1] ?? Number.POSITIVE_INFINITY
  expect(p95).toBeLessThanOrEqual(BUDGET_MS)
})

test('mock optimization — 1.000 instance, ba phương án ứng viên', async ({ bench }) => {
  const result = await bench('runMockCandidates', () => void runMockCandidates(REQUEST)).run({
    retainSamples: true,
    time: 0,
    iterations: 10,
    warmupIterations: 2,
  })
  const samples = result.latency.samples ?? []
  const p95 = samples[Math.ceil(samples.length * 0.95) - 1] ?? Number.POSITIVE_INFINITY
  expect(p95).toBeLessThanOrEqual(BUDGET_MS)
})
