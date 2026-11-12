import { expect, test } from 'vitest'
import { STOP_COLORS, STOP_COUNT, stopColor, stopForeground, stopForegroundToken } from '@/lib/stops'

// Đọc file CSS thật: Vitest bỏ nội dung CSS khi import (kể cả `?raw`), và tsconfig của app không có kiểu Node.
const FS = 'node:fs'
const { readFileSync } = (await import(/* @vite-ignore */ FS)) as { readFileSync: (path: URL, encoding: 'utf8') => string }
const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')

/** Biến của khối `:root` đầu tiên trong `src/index.css` (giao diện sáng), `var(--x)` đã thay bằng giá trị. */
function rootTokens(): Map<string, string> {
  const root = css.slice(css.indexOf(':root {'), css.indexOf('\n}', css.indexOf(':root {')))
  const raw = new Map([...root.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]))
  const resolve = (value: string): string => value.replace(/var\((--[\w-]+)\)/g, (_, name: string) => resolve(raw.get(name) ?? ''))
  return new Map([...raw].map(([name, value]) => [name, resolve(value)]))
}

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

const tokens = rootTokens()

test('the stop palette mirrors the --stop-N tokens of index.css', () => {
  expect(STOP_COLORS.map((_, index) => tokens.get(`--stop-${index + 1}`)?.toUpperCase())).toStrictEqual([...STOP_COLORS])
})

test('the number on every stop marker reads at 4.5:1 or better (AGENTS §10)', () => {
  for (let stop = 1; stop <= STOP_COUNT; stop += 1) {
    const text = tokens.get(stopForegroundToken(stop)) ?? ''
    expect(contrast(text, stopColor(stop)), `stop ${stop}`).toBeGreaterThanOrEqual(4.5)
  }
})

test('green, vermillion and pink stops take dark text; blue and grey keep white', () => {
  expect([3, 6, 7].map(stopForeground)).toStrictEqual(['var(--ink-strong)', 'var(--ink-strong)', 'var(--ink-strong)'])
  expect([5, 8].map(stopForeground)).toStrictEqual(['var(--bg)', 'var(--bg)'])
  expect(stopForeground(13)).toBe('var(--bg)')
})
