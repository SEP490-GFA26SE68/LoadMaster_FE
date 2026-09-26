import { describe, expect, test } from 'vitest'
import { contrastRatio, parseColor } from './contrast'

describe('parseColor', () => {
  test('reads short and long hex and rgb()', () => {
    expect(parseColor('#fff')).toStrictEqual([255, 255, 255])
    expect(parseColor(' #006F81 ')).toStrictEqual([0, 111, 129])
    expect(parseColor('rgba(203, 247, 249, 0.78)')).toStrictEqual([203, 247, 249])
  })

  test('returns null for values that are not a single colour', () => {
    expect(parseColor('')).toBeNull()
    expect(parseColor('var(--cyan-700)')).toBeNull()
    expect(parseColor('linear-gradient(#fff, #000)')).toBeNull()
  })
})

describe('contrastRatio', () => {
  // Giá trị kỳ vọng: 21 và 4,48 là ví dụ chuẩn của WCAG; ba số còn lại in sẵn trong design/v2.3/screens/web/Main.html.
  test.each([
    ['#000000', '#ffffff', 21],
    ['#777777', '#ffffff', 4.48],
    ['#006f81', '#ffffff', 5.85],
    ['#02222d', '#00c3d4', 7.69],
    ['#ffffff', '#00c3d4', 2.15],
  ])('%s on %s is %d:1', (fg, bg, expected) => {
    expect(contrastRatio(fg, bg)).toBeCloseTo(expected, 2)
  })

  test('is symmetric and null when a colour cannot be read', () => {
    expect(contrastRatio('#ffffff', '#006f81')).toBe(contrastRatio('#006f81', '#ffffff'))
    expect(contrastRatio('', '#ffffff')).toBeNull()
  })
})
