import { expect, test } from 'vitest'
import {
  createFormatter,
  formatDateTime,
  formatDecimal,
  formatInteger,
  formatRatioAsPercent,
} from '@/lib/format'

const vi = createFormatter('vi-VN')
const en = createFormatter('en-US')

test('weight in kg groups thousands the way each locale writes them', () => {
  expect(vi.weight(5320)).toBe('5.320 kg')
  expect(en.weight(5320)).toBe('5,320 kg')
})

test('weight keeps the 0.01 kg input step and no finer', () => {
  expect(vi.weight(1234.567)).toBe('1.234,57 kg')
  expect(en.weight(1234.567)).toBe('1,234.57 kg')
})

test('length in cm rounds to the 0.1 cm step and drops the decimal for whole cm', () => {
  expect(vi.length(1250.55)).toBe('1.250,6 cm')
  expect(en.length(1250.55)).toBe('1,250.6 cm')
  expect(vi.length(240)).toBe('240 cm')
})

test('a cm value without its unit keeps the 0.1 cm step, for lists that write "cm" once at the end', () => {
  expect(vi.lengthValue(1250.55)).toBe('1.250,6')
  expect(en.lengthValue(1250.55)).toBe('1,250.6')
  expect(vi.lengthValue(275)).toBe('275')
})

test('dimensions read length × width × height with one cm unit at the end', () => {
  expect(vi.dimensions(1203.5, 235, 239.2)).toBe('1.203,5 × 235 × 239,2 cm')
  expect(en.dimensions(1203.5, 235, 239.2)).toBe('1,203.5 × 235 × 239.2 cm')
})

test('a door opening reads width × height with one cm unit at the end, as in "the 220 × 230 cm door"', () => {
  expect(vi.widthByHeight(220, 230.5)).toBe('220 × 230,5 cm')
  expect(en.widthByHeight(1220, 230.5)).toBe('1,220 × 230.5 cm')
})

test('a list of package IDs joins with the conjunction of each locale', () => {
  expect(vi.list(['PKG-007', 'PKG-008', 'PKG-009'])).toBe('PKG-007, PKG-008 và PKG-009')
  expect(en.list(['PKG-007', 'PKG-008'])).toBe('PKG-007 and PKG-008')
})

test('volume stays in cm³, rounded to whole cm³', () => {
  expect(vi.volume(324_000)).toBe('324.000 cm³')
  expect(en.volume(324_000)).toBe('324,000 cm³')
  // 120,5 × 80,5 × 100,5 cm
  expect(vi.volume(974_860.125)).toBe('974.860 cm³')
})

test('large volumes given in cm³ can be read in m³, always with one decimal like the screens today', () => {
  expect(vi.volumeM3(18_400_000)).toBe('18,4 m³')
  expect(en.volumeM3(18_400_000)).toBe('18.4 m³')
  expect(vi.volumeM3(40_000_000)).toBe('40,0 m³')
})

test('currency is whole VND with the symbol of the language', () => {
  expect(vi.currency(1_490_000)).toBe('1.490.000 ₫')
  expect(en.currency(1_490_000)).toBe('₫1,490,000')
})

test('percent of 0–100 always shows one decimal, like the screens do today', () => {
  expect(vi.percent(87.42)).toBe('87,4%')
  expect(en.percent(87.42)).toBe('87.4%')
  expect(vi.percent(100)).toBe('100,0%')
})

test('ratio of 0–1 shows two decimals, as in "support ratio 0.62 is below 0.80"', () => {
  expect(vi.ratio(0.62)).toBe('0,62')
  expect(en.ratio(0.62)).toBe('0.62')
  expect(en.ratio(0.8)).toBe('0.80')
})

test('integer counts group thousands per locale', () => {
  expect(vi.integer(8240)).toBe('8.240')
  expect(en.integer(8240)).toBe('8,240')
})

test('decimal numbers always show one decimal with the locale decimal mark', () => {
  expect(vi.decimal(18.44)).toBe('18,4')
  expect(en.decimal(18.44)).toBe('18.4')
  expect(vi.decimal(18)).toBe('18,0')
})

test('dates are day-first in Vietnamese and spell the month in English so they cannot be misread', () => {
  const departure = new Date(2026, 8, 14, 14, 30)
  expect(vi.date(departure)).toBe('14/09/2026')
  expect(en.date(departure)).toBe('Sep 14, 2026')
  expect(vi.date('2026-09-14T14:30:00')).toBe('14/09/2026')
})

test('a day and month without the year keeps the same order as the full date of each language', () => {
  const approved = new Date(2026, 8, 4, 9, 15)
  expect(vi.dayMonth(approved)).toBe('04/09')
  expect(en.dayMonth(approved)).toBe('Sep 4')
})

test('times use the 24-hour clock in both languages', () => {
  expect(vi.time(new Date(2026, 8, 14, 14, 30))).toBe('14:30')
  expect(en.time(new Date(2026, 8, 14, 14, 30))).toBe('14:30')
  expect(en.time(new Date(2026, 8, 14, 0, 5))).toBe('00:05')
})

test('screens not yet translated keep their Vietnamese output', () => {
  expect(formatInteger(8240)).toBe('8.240')
  expect(formatDecimal(18.44)).toBe('18,4')
  expect(formatRatioAsPercent(0.874)).toBe('87,4%')
  expect(formatDateTime(new Date(2026, 8, 14, 14, 30))).toBe('14:30 14/09/2026')
})
