import { expect, test } from 'vitest'
import { ROLES } from '@/types/user'
import { landingPath, ROLE_HOME } from './landing'

test('each role lands on its own screen when nothing else was asked for', () => {
  expect(landingPath('dispatcher')).toBe('/chuyen')
  expect(landingPath('manager')).toBe('/')
  expect(landingPath('warehouse')).toBe('/kho')
  expect(landingPath('driver')).toBe('/tai-xe')
  expect(landingPath('companyAdmin')).toBe('/nguoi-dung')
})

test('every role has a home that is still a route: no role lands on the removed receiving screen (FE-0-06)', () => {
  expect(ROLES.map((role) => [role, ROLE_HOME[role]])).toStrictEqual([
    ['systemAdmin', '/nguoi-dung'], ['systemManager', '/nen-tang/goi'], ['systemSupporter', '/ho-so'], ['companyAdmin', '/nguoi-dung'],
    ['manager', '/'], ['dispatcher', '/chuyen'], ['warehouse', '/kho'], ['driver', '/tai-xe'],
  ])
})

test('the platform roles land on a screen that exists today: users for the system administrator, the profile for the other two (FE-0-03)', () => {
  expect(landingPath('systemAdmin')).toBe('/nguoi-dung')
  expect(landingPath('systemManager')).toBe('/nen-tang/goi')
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
