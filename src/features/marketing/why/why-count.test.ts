import { expect, test } from 'vitest'
import { orderCount, orientationCount, ORIENTATIONS_PER_PACKAGE, WHY_PACKAGES, WHY_STOPS } from './why-count'

test('the orderings through one to eight stops are written in full', () => {
  const values = [1, 2, 3, 4, 5, 6, 7, 8].map((stops) => orderCount(stops))

  expect(values.map((count) => (count.kind === 'exact' ? count.value : null))).toEqual([1, 2, 6, 24, 120, 720, 5040, 40320])
})

test('a count that still fits nine digits is written in full', () => {
  expect(orientationCount(10)).toEqual({ kind: 'exact', value: 60_466_176, digits: 8 })
  expect(orderCount(12)).toEqual({ kind: 'exact', value: 479_001_600, digits: 9 })
})

test('a larger count is written as a mantissa and a power of ten', () => {
  // 13! = 6.227.020.800 · 20! = 2.432.902.008.176.640.000
  expect(orderCount(13)).toEqual({ kind: 'power', mantissa: 6.2, exponent: 9, digits: 10 })
  expect(orderCount(20)).toEqual({ kind: 'power', mantissa: 2.4, exponent: 18, digits: 19 })
})

test.each([50, 100, 366, 1000, 5000])('six orientations for %i packages match the exact integer', (packages) => {
  const exact = (6n ** BigInt(packages)).toString()
  const count = orientationCount(packages)

  expect(count.kind).toBe('power')
  if (count.kind !== 'power') return
  expect(count.digits).toBe(exact.length)
  // Số thật làm tròn một chữ số lẻ: lấy ba chữ số đầu, chia 10 rồi làm tròn.
  const leading = Math.round(Number(exact.slice(0, 3)) / 10) / 10
  if (leading >= 10) {
    expect(count).toMatchObject({ mantissa: 1, exponent: exact.length })
  } else {
    expect(count).toMatchObject({ mantissa: leading, exponent: exact.length - 1 })
  }
})

test('a mantissa that rounds up to ten moves to the next power, the digit count stays', () => {
  // 999^4 = 996.005.996.001 — 9,96 × 10^11 làm tròn thành 1,0 × 10^12, số thật vẫn dài 12 chữ số.
  expect(orientationCount(4, 999)).toEqual({ kind: 'power', mantissa: 1, exponent: 12, digits: 12 })
})

test('the six orientations come from the domain, and the defaults are the sample trip of the page', () => {
  expect(ORIENTATIONS_PER_PACKAGE).toBe(6)
  expect(WHY_STOPS).toEqual({ min: 1, max: 8, initial: 4 })
  expect(WHY_PACKAGES.marks).toEqual([10, 50, 100, 366])
  expect(WHY_PACKAGES.initial).toBe(366)
})

test('a count of zero or a fraction is a programming error', () => {
  expect(() => orderCount(0)).toThrow()
  expect(() => orientationCount(2.5)).toThrow()
})
