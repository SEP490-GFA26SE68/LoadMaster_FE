import { describe, expect, test } from 'vitest'
import { revealedBoxCount, runProgressView } from './run-progress'

describe('runProgressView', () => {
  test('before any progress event the fraction is unknown and the counts come from the trip', () => {
    expect(runProgressView(null, 132)).toMatchObject({ total: 132, done: 0, checked: 0, workload: 396, fraction: null })
    expect(runProgressView({ total: 132, stage: 'reserve', plans: {} }, 0)).toMatchObject({ total: 132, checked: 0, workload: 396, fraction: null })
  })

  test('the fraction is the packages checked across the three plans over three times the total', () => {
    const view = runProgressView({ total: 10, stage: 'pack', plans: { MAX_VOLUME: { placed: 10, total: 10 }, AXLE_BALANCE: { placed: 5, total: 10 } } }, 0)
    expect(view).toMatchObject({ done: 1, checked: 15, workload: 30, fraction: 0.5 })
    expect(view.plans).toStrictEqual([
      { objective: 'MAX_VOLUME', placed: 10 },
      { objective: 'AXLE_BALANCE', placed: 5 },
      { objective: 'MIN_REHANDLING', placed: undefined },
    ])
  })

  test('a plan that reports more than the total counts as the total', () => {
    const view = runProgressView({ total: 4, stage: 'pack', plans: { MAX_VOLUME: { placed: 9, total: 4 }, AXLE_BALANCE: { placed: 4, total: 4 }, MIN_REHANDLING: { placed: 4, total: 4 } } }, 0)
    expect(view).toMatchObject({ done: 3, checked: 12, workload: 12, fraction: 1 })
  })

  test('a reported zero is known progress, not an unknown one', () => {
    expect(runProgressView({ total: 8, stage: 'pack', plans: { MAX_VOLUME: { placed: 0, total: 8 } } }, 0).fraction).toBe(0)
  })
})

describe('revealedBoxCount', () => {
  test('an unknown fraction draws no level', () => {
    expect(revealedBoxCount(null, 52)).toBeNull()
  })

  test('the box count follows the real fraction, rounded down', () => {
    expect(revealedBoxCount(0, 52)).toBe(0)
    expect(revealedBoxCount(0.5, 52)).toBe(26)
    expect(revealedBoxCount(0.999, 52)).toBe(51)
    expect(revealedBoxCount(1, 52)).toBe(52)
  })

  test('out-of-range fractions are clamped', () => {
    expect(revealedBoxCount(-0.2, 52)).toBe(0)
    expect(revealedBoxCount(1.4, 52)).toBe(52)
  })

  test('for every amount of work the figure never shows more than the work done, and never shrinks', () => {
    const workload = 396
    const boxes = 52
    let previous = 0
    for (let checked = 0; checked <= workload; checked++) {
      const shown = revealedBoxCount(checked / workload, boxes) ?? -1
      expect(shown / boxes).toBeLessThanOrEqual(checked / workload)
      expect(shown).toBeGreaterThanOrEqual(previous)
      previous = shown
    }
    expect(previous).toBe(boxes)
  })
})
