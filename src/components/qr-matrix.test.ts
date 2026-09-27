import { expect, test } from 'vitest'
import { normalizeQrToken, QR_QUIET_ZONE, qrPath } from './qr-matrix'

test('the same token always gives the same path', () => {
  expect(qrPath('PKG-001').d).toBe(qrPath('PKG-001').d)
})

test('different tokens give different paths', () => {
  expect(qrPath('PKG-001').d).not.toBe(qrPath('PKG-002').d)
})

test('a short token is a version 1 code (21 modules) framed by a 4-module quiet zone', () => {
  const path = qrPath('PKG-001')
  expect(path.modules).toBe(21)
  expect(QR_QUIET_ZONE).toBe(4)
  expect(path.size).toBe(29)
})

test('every run starts inside the quiet zone', () => {
  const { d, size } = qrPath('TRIP-2026-0914')
  const starts = [...d.matchAll(/M(\d+) (\d+)/g)].map(([, x, y]) => [Number(x), Number(y)] as const)
  expect(starts.length).toBeGreaterThan(0)
  for (const [x, y] of starts) {
    expect(x).toBeGreaterThanOrEqual(QR_QUIET_ZONE)
    expect(y).toBeGreaterThanOrEqual(QR_QUIET_ZONE)
    expect(x).toBeLessThan(size - QR_QUIET_ZONE)
    expect(y).toBeLessThan(size - QR_QUIET_ZONE)
  }
  // Ô định vị góc trên trái: hàng đầu có 7 module tối liền nhau bắt đầu ngay sau vùng yên lặng.
  expect(d.startsWith('M4 4h7v1h-7z')).toBe(true)
})

test('tokens are trimmed, stripped of inner whitespace and upper-cased', () => {
  expect(normalizeQrToken('  pkg-001 ')).toBe('PKG-001')
  expect(normalizeQrToken('trip - 2026\t0914')).toBe('TRIP-20260914')
  expect(normalizeQrToken('   ')).toBe('')
})
