import { expect, test } from 'vitest'
import { ROLES, type User } from '@/types/user'
import { isActiveOnBackend, roleOfBackend, userFromBackend, type BackendUserProfile } from './backend-user'

/** Tám mã vai trò backend đang cấp (enum `UserRole` của backend), và vai trò FE tương ứng. */
const BACKEND_ROLES = [
  ['SYSTEM_ADMIN', 'systemAdmin'],
  ['SYSTEM_MANAGER', 'systemManager'],
  ['SYSTEM_SUPPORTER', 'systemSupporter'],
  ['ADMIN', 'companyAdmin'],
  ['MANAGER', 'manager'],
  ['DISPATCHER', 'dispatcher'],
  ['WAREHOUSE_WORKER', 'warehouse'],
  ['DRIVER', 'driver'],
] as const

test.each(BACKEND_ROLES)('backend role %s is the app role %s', (code, role) => {
  expect(roleOfBackend(code)).toBe(role)
})

test('every app role is reachable from a backend role', () => {
  expect(new Set(BACKEND_ROLES.map(([, role]) => role))).toStrictEqual(new Set(ROLES))
})

test('the two company roles are also accepted under the names of the shared spec; anything else is unknown', () => {
  expect(roleOfBackend('COMPANY_ADMIN')).toBe('companyAdmin')
  expect(roleOfBackend('COMPANY_MANAGER')).toBe('manager')
  expect(roleOfBackend('offline_access')).toBeNull()
  expect(roleOfBackend('')).toBeNull()
})

test('only ACTIVE can sign in', () => {
  expect(isActiveOnBackend('ACTIVE')).toBe(true)
  expect(isActiveOnBackend('LOCKED')).toBe(false)
  expect(isActiveOnBackend('INACTIVE')).toBe(false)
})

test('identity comes from the backend; id, company and depot stay those of the sample account', () => {
  const standIn: User = {
    id: 'US-0001', fullName: 'Trần Thị Hoa', email: 'dieuphoi@loadmaster.vn', phone: '0901 234 567', role: 'dispatcher', status: 'active',
    depot: 'Kho Long Bình', lastActiveAt: '2026-09-14T01:00:00.000Z', companyId: 'LOG-001',
  }
  const profile: BackendUserProfile = {
    id: 6, keycloakId: 'kc-6', username: 'an@fastmove.vn', email: 'an@fastmove.vn', fullName: 'Nguyễn Hoài An', phoneNumber: null, companyId: 2,
    userRoleType: 'DISPATCHER', status: 'ACTIVE',
  }
  expect(userFromBackend(profile, 'dispatcher', standIn)).toStrictEqual({
    id: 'US-0001', fullName: 'Nguyễn Hoài An', email: 'an@fastmove.vn', phone: '', role: 'dispatcher', status: 'active',
    depot: 'Kho Long Bình', lastActiveAt: '2026-09-14T01:00:00.000Z', companyId: 'LOG-001',
  })
})
