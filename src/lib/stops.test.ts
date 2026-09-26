import { expect, test } from 'vitest'
import { STOP_COUNT, stopColor, stopForeground } from '@/lib/stops'

/** Tỷ lệ tương phản WCAG 2.x, viết lại độc lập với code của trang /kieu-dang. */
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, bl] = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!
  }
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

test('the number on every stop marker reads at 4.5:1 or better (AGENTS §10)', () => {
  for (let stop = 1; stop <= STOP_COUNT; stop += 1) {
    expect(contrast(stopForeground(stop), stopColor(stop)), `stop ${stop}`).toBeGreaterThanOrEqual(4.5)
  }
})

test('green, vermillion and pink stops take dark text; blue and grey keep white', () => {
  expect([3, 6, 7].map(stopForeground)).toStrictEqual(['#111827', '#111827', '#111827'])
  expect([5, 8].map(stopForeground)).toStrictEqual(['#FFFFFF', '#FFFFFF'])
})
