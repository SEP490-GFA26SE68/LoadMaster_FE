import { expect, test } from 'vitest'
import { ROLES } from '@/types/user'
import { landingPath, ROLE_HOME } from './landing'

test('each role lands on its own screen when nothing else was asked for', () => {
  expect(landingPath('dispatcher')).toBe('/chuyen')
  expect(landingPath('companyManager')).toBe('/')
  expect(landingPath('warehouse')).toBe('/kho')
  expect(landingPath('driver')).toBe('/tai-xe')
  expect(landingPath('companyAdmin')).toBe('/nguoi-dung')
})

test('every role has a home that is still a route: no role lands on the removed receiving screen (FE-0-06)', () => {
  expect(ROLES.map((role) => [role, ROLE_HOME[role]])).toStrictEqual([
    ['systemAdmin', '/nen-tang/cong-ty'], ['systemManager', '/nen-tang/goi'], ['systemSupporter', '/ho-tro'], ['companyAdmin', '/nguoi-dung'],
    ['manager', '/'], ['dispatcher', '/chuyen'], ['warehouse', '/kho'], ['driver', '/tai-xe'],
  ])
})

test('the platform roles land on a screen that exists today: companies for the system administrator, plans for the platform manager, the support screen for customer support', () => {
  expect(landingPath('systemAdmin')).toBe('/nen-tang/cong-ty')
  expect(landingPath('systemManager')).toBe('/nen-tang/goi')
  expect(landingPath('systemSupporter', '/?lang=en')).toBe('/ho-tro?lang=en')
})

test('opening the app root is not a choice: the role screen wins', () => {
  expect(landingPath('warehouse', '/')).toBe('/kho')
  expect(landingPath('driver', '/?lang=en')).toBe('/tai-xe?lang=en')
})

test('a deep link opened before signing in is kept', () => {
  expect(landingPath('warehouse', '/chuyen/TRIP-2026-0914/phuong-an?revision=REV-002')).toBe('/chuyen/TRIP-2026-0914/phuong-an?revision=REV-002')
})

test('the login page itself is never a landing target', () => {
  expect(landingPath('systemAdmin', '/dang-nhap')).toBe('/nen-tang/cong-ty')
})
