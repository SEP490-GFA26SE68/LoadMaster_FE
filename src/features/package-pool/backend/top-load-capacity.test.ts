import { describe, expect, it } from 'vitest'

import { estimateTopLoadCapacity } from './top-load-capacity'

describe('estimateTopLoadCapacity (McKee)', () => {
  // Ví dụ của spec ràng buộc vật lý 8.3, số đã chạy lại bằng máy: ECT 32 lb/in ≈ 5.604 N/m, tấm 4 mm, thùng 60 × 40 cm, k = 3.
  const example = { ectNPerM: 5604, thicknessCm: 0.4, lengthCm: 60, widthCm: 40, safetyFactor: 3 }

  it('reproduces the spec example: P = 2 m, A = 0.24 m², BCT ≈ 2,942 N, σ ≈ 417 kg/m²', () => {
    const estimate = estimateTopLoadCapacity(example)
    expect(estimate).not.toBeNull()
    expect(estimate!.perimeterM).toBeCloseTo(2, 10)
    expect(estimate!.topAreaM2).toBeCloseTo(0.24, 10)
    expect(estimate!.boxCompressionN).toBeCloseTo(2942.26, 2)
    expect(estimate!.topLoadCapacityKgM2).toBe(416.56)
    expect(Math.round(estimate!.topLoadCapacityKgM2)).toBe(417)
  })

  it('halves σ when the safety factor doubles', () => {
    const base = estimateTopLoadCapacity(example)!.topLoadCapacityKgM2
    const safer = estimateTopLoadCapacity({ ...example, safetyFactor: 6 })!.topLoadCapacityKgM2
    expect(safer).toBeCloseTo(base / 2, 1)
  })

  it.each([
    ['ectNPerM', 0],
    ['thicknessCm', -0.4],
    ['lengthCm', Number.NaN],
    ['widthCm', 0],
    ['safetyFactor', Number.POSITIVE_INFINITY],
  ] as const)('returns null when %s is %s', (field, value) => {
    expect(estimateTopLoadCapacity({ ...example, [field]: value })).toBeNull()
  })
})
