import { expect, test } from 'vitest'
import { BACKEND_ROLE_CODES, isPlatformRole, PLATFORM_ROLES, ROLES, type Role } from '@/types/user'
import { can, permissionsOf, PERMISSIONS, ROLE_PERMISSIONS, type Permission } from './permissions'

/**
 * Ma trận quyền (FE-0-01): tập quyền kỳ vọng của từng vai trò chép tay từ PRD v2 mục 5.2 — cộng ba chỗ còn tạm (quản lý công ty vẫn
 * duyệt và có hàng đợi duyệt, đơn hàng, hai vai trò của Review 1) — không tính lại từ bảng trong code.
 */
const EXPECTED: Readonly<Record<Role, readonly Permission[]>> = {
  systemAdmin: ['companies.manage', 'users.manage', 'audit.view'],
  systemManager: ['subscriptionPlans.manage'],
  systemSupporter: ['support.handle'],
  companyAdmin: ['users.manage', 'audit.view', 'billing.manage', 'support.create'],
  manager: [
    'support.create', 'dashboard.view', 'reports.export', 'requirements.view', 'requirements.edit', 'packages.view', 'trips.view',
    'plans.approve', 'plans.view', 'monitoring.view', 'fleet.view', 'deadlines.renegotiate', 'plans.review', 'orders.view',
  ],
  dispatcher: [
    'support.create', 'dashboard.view', 'requirements.view', 'packages.view', 'packages.manage', 'packages.lookup', 'labels.print',
    'trips.view', 'trips.edit', 'routes.optimize', 'optimization.run', 'manualConfirm.approve', 'plans.view', 'monitoring.view',
    'fleet.view', 'fleet.edit', 'vehicleTypes.edit', 'exceptions.report', 'exceptions.resolve', 'pickups.create', 'pickups.approve',
    'orders.view', 'orders.edit',
  ],
  warehouse: ['support.create', 'packages.lookup', 'labels.print', 'warehouse.operate'],
  driver: ['support.create', 'exceptions.report', 'pickups.create', 'driver.operate'],
  manufacturer: ['packages.register', 'shipments.manage'],
  logistics: ['receiving.operate'],
}

test.each(ROLES)('%s has exactly its permissions from the matrix', (role) => {
  expect(PERMISSIONS.filter((permission) => can(role, permission))).toStrictEqual(EXPECTED[role])
})

test('eight roles of the backend plus the two Review 1 roles that stay until FE-0-06; each backend role has its code', () => {
  expect(ROLES).toStrictEqual([
    'systemAdmin', 'systemManager', 'systemSupporter', 'companyAdmin', 'manager', 'dispatcher', 'warehouse', 'driver',
    'manufacturer', 'logistics',
  ])
  expect(BACKEND_ROLE_CODES).toStrictEqual({
    systemAdmin: 'SYSTEM_ADMIN',
    systemManager: 'SYSTEM_MANAGER',
    systemSupporter: 'SYSTEM_SUPPORTER',
    companyAdmin: 'COMPANY_ADMIN',
    manager: 'COMPANY_MANAGER',
    dispatcher: 'DISPATCHER',
    warehouse: 'WAREHOUSE_WORKER',
    driver: 'DRIVER',
  })
})

test('one table: 39 permissions, each granted to at least one role; a role lists each of its permissions once, in the order of the matrix rows', () => {
  expect(PERMISSIONS).toHaveLength(39)
  expect(new Set(PERMISSIONS).size).toBe(39)
  for (const permission of PERMISSIONS) expect(ROLES.some((role) => can(role, permission)), permission).toBe(true)
  for (const role of ROLES) {
    // Cùng thứ tự với cột của Ma trận quyền và chip "Công việc được phép"; không có bảng phụ nào cộng thêm quyền
    expect(permissionsOf(role), role).toStrictEqual(EXPECTED[role])
    expect(ROLE_PERMISSIONS[role], role).toStrictEqual(EXPECTED[role])
  }
  expect(can(undefined, 'trips.view')).toBe(false)
})

test('the three platform roles have no operational permission: no packages, trips, plans, fleet, warehouse or driver work', () => {
  const operational = PERMISSIONS.filter((permission) =>
    /^(dashboard|reports|requirements|packages|labels|trips|routes|optimization|plans|manualConfirm|monitoring|fleet|vehicleTypes|exceptions|deadlines|pickups|warehouse|driver|orders|shipments|receiving)\./.test(permission))
  expect(operational).toHaveLength(32)
  expect(PLATFORM_ROLES).toStrictEqual(['systemAdmin', 'systemManager', 'systemSupporter'])
  for (const role of PLATFORM_ROLES) {
    expect(isPlatformRole(role), role).toBe(true)
    expect(operational.filter((permission) => can(role, permission)), role).toStrictEqual([])
  }
  expect(ROLES.filter((role) => !isPlatformRole(role))).toStrictEqual(['companyAdmin', 'manager', 'dispatcher', 'warehouse', 'driver', 'manufacturer', 'logistics'])
})

test('users and the audit log belong to the system administrator and the company administrator only', () => {
  for (const permission of ['users.manage', 'audit.view'] as const) {
    expect(ROLES.filter((role) => can(role, permission)), permission).toStrictEqual(['systemAdmin', 'companyAdmin'])
  }
})

test('for now the company manager approves plans and the dispatcher does not (FE-0-07 moves it); the manager writes nothing else', () => {
  expect(ROLES.filter((role) => can(role, 'plans.approve'))).toStrictEqual(['manager'])
  expect(ROLES.filter((role) => can(role, 'plans.review'))).toStrictEqual(['manager'])
  expect(can('dispatcher', 'optimization.run')).toBe(true)
  expect(can('manager', 'optimization.run')).toBe(false)
  expect(can('manager', 'trips.edit')).toBe(false)
  expect(can('manager', 'orders.edit')).toBe(false)
})
