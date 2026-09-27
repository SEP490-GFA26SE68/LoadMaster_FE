import { expect, test } from 'vitest'
import { SPEC_CARTON_A } from '@/domain/fixtures/spec-samples'
import { createFormatter } from '@/lib/format'
import { createTranslator } from '@/lib/i18n'
import { formatDuration, formatTimeRange, packageNames } from './trip-report-format'

const vi = { t: createTranslator('vi'), format: createFormatter('vi-VN') }
const en = { t: createTranslator('en'), format: createFormatter('en-US') }

test('durations round to the minute and drop the zero part; a missing moment is a dash, never a guess', () => {
  expect(formatDuration(43 * 60_000, vi.t, vi.format)).toBe('43 phút')
  expect(formatDuration(3.5 * 3_600_000, vi.t, vi.format)).toBe('3 giờ 30 phút')
  expect(formatDuration(2 * 3_600_000 + 20_000, vi.t, vi.format)).toBe('2 giờ')
  expect(formatDuration(3.5 * 3_600_000, en.t, en.format)).toBe('3 h 30 min')
  expect(formatDuration(null, vi.t, vi.format)).toBe('—')
  expect(formatDuration(-1, vi.t, vi.format)).toBe('—')
})

test('a time range needs both moments', () => {
  expect(formatTimeRange('2026-09-20T02:33:00.000Z', null, vi.t, vi.format)).toBe('Chưa đủ mốc bắt đầu và kết thúc')
  expect(formatTimeRange('2026-09-20T02:33:00.000Z', '2026-09-20T06:03:00.000Z', vi.t, vi.format)).toBe('09:33 – 13:03 · 20/09/2026')
})

test('package names come from the trip line of each instance', () => {
  const nameOf = packageNames([
    { ...SPEC_CARTON_A, id: 'PKG-001', name: 'Thùng nước suối', quantity: 2, deliveryStop: 1 },
  ])
  expect(nameOf('PKG-001-02')).toBe('Thùng nước suối')
  expect(nameOf('PKG-009-01')).toBe('')
})
