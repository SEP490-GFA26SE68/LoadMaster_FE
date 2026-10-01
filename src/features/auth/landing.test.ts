import { expect, test } from 'vitest'
import { landingPath } from './landing'

test('each role lands on its own screen when nothing else was asked for', () => {
  expect(landingPath('dispatcher')).toBe('/chuyen')
  expect(landingPath('manager')).toBe('/')
  expect(landingPath('warehouse')).toBe('/kho')
  expect(landingPath('driver')).toBe('/tai-xe')
  expect(landingPath('companyAdmin')).toBe('/nguoi-dung')
  // LM-104
  expect(landingPath('manufacturer')).toBe('/kien-hang')
  expect(landingPath('logistics', '/?lang=en')).toBe('/nhan-hang?lang=en')
})

test('the platform roles land on a screen that exists today: users for the system administrator, the profile for the other two (FE-0-03)', () => {
  expect(landingPath('systemAdmin')).toBe('/nguoi-dung')
  expect(landingPath('systemManager')).toBe('/ho-so')
  expect(landingPath('systemSupporter', '/?lang=en')).toBe('/ho-so?lang=en')
})

test('opening the app root is not a choice: the role screen wins', () => {
  expect(landingPath('warehouse', '/')).toBe('/kho')
  expect(landingPath('driver', '/?lang=en')).toBe('/tai-xe?lang=en')
})

test('a deep link opened before signing in is kept', () => {
  expect(landingPath('warehouse', '/chuyen/TRIP-2026-0914/phuong-an?revision=REV-002')).toBe('/chuyen/TRIP-2026-0914/phuong-an?revision=REV-002')
})

test('the login page itself is never a landing target', () => {
  expect(landingPath('systemAdmin', '/dang-nhap')).toBe('/nguoi-dung')
})
