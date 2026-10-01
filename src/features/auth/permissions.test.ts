import { expect, test } from 'vitest'
import { BACKEND_ROLE_CODES, isPlatformRole, PLATFORM_ROLES, ROLES, type Role } from '@/types/user'
import { can, permissionsOf, PERMISSIONS, ROLE_PERMISSIONS, type Permission } from './permissions'

/**
 * Ma trận quyền (FE-0-01, FE-0-07, FE-0-06): tập quyền kỳ vọng của từng vai trò chép tay từ PRD v2 mục 5.2 — cộng một chỗ còn tạm
 * (đơn hàng) — không tính lại từ bảng trong code.
 */
const EXPECTED: Readonly<Record<Role, readonly Permission[]>> = {
  systemAdmin: ['companies.manage', 'users.manage', 'audit.view'],
  systemManager: ['subscriptionPlans.manage'],
  systemSupporter: ['support.handle'],
  companyAdmin: ['users.manage', 'audit.view', 'billing.manage', 'support.create'],
  manager: [
    'support.create', 'dashboard.view', 'reports.export', 'requirements.view', 'requirements.edit', 'packages.view', 'trips.view',
    'plans.view', 'monitoring.view', 'fleet.view', 'deadlines.renegotiate', 'orders.view',
  ],
  dispatcher: [
    'support.create', 'dashboard.view', 'requirements.view', 'packages.view', 'packages.manage', 'packages.lookup', 'labels.print',
    'trips.view', 'trips.edit', 'routes.optimize', 'optimization.run', 'plans.approve', 'manualConfirm.approve', 'plans.view',
    'monitoring.view', 'fleet.view', 'fleet.edit', 'vehicleTypes.edit', 'exceptions.report', 'exceptions.resolve', 'pickups.create',
    'pickups.approve', 'orders.view', 'orders.edit',
  ],
  warehouse: ['support.create', 'packages.lookup', 'labels.print', 'warehouse.operate'],
  driver: ['support.create', 'exceptions.report', 'pickups.create', 'driver.operate'],
}

test.each(ROLES)('%s has exactly its permissions from the matrix', (role) => {
  expect(PERMISSIONS.filter((permission) => can(role, permission))).toStrictEqual(EXPECTED[role])
})

test('exactly the eight roles of the backend, each with its backend code; manufacturer and logistics are gone (FE-0-06)', () => {
  expect(ROLES).toStrictEqual(['systemAdmin', 'systemManager', 'systemSupporter', 'companyAdmin', 'manager', 'dispatcher', 'warehouse', 'driver'])
  expect(Object.keys(BACKEND_ROLE_CODES)).toStrictEqual([...ROLES])
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

test('one table: 35 permissions, each granted to at least one role; a role lists each of its permissions once, in the order of the matrix rows', () => {
  // 33 quyền của ma trận PRD v2 và hai quyền đơn hàng còn tạm; ba quyền của nhà sản xuất và logistics đã bỏ (FE-0-06)
  expect(PERMISSIONS).toHaveLength(35)
  expect(new Set(PERMISSIONS).size).toBe(35)
  expect(PERMISSIONS.filter((permission) => /^(packages\.register|shipments\.|receiving\.)/.test(permission))).toStrictEqual([])
  expect(PERMISSIONS.slice(-2)).toStrictEqual(['orders.view', 'orders.edit'])
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
    /^(dashboard|reports|requirements|packages|labels|trips|routes|optimization|plans|manualConfirm|monitoring|fleet|vehicleTypes|exceptions|deadlines|pickups|warehouse|driver|orders)\./.test(permission))
  expect(operational).toHaveLength(28)
  expect(PLATFORM_ROLES).toStrictEqual(['systemAdmin', 'systemManager', 'systemSupporter'])
  for (const role of PLATFORM_ROLES) {
    expect(isPlatformRole(role), role).toBe(true)
    expect(operational.filter((permission) => can(role, permission)), role).toStrictEqual([])
  }
  expect(ROLES.filter((role) => !isPlatformRole(role))).toStrictEqual(['companyAdmin', 'manager', 'dispatcher', 'warehouse', 'driver'])
})

test('users and the audit log belong to the system administrator and the company administrator only', () => {
  for (const permission of ['users.manage', 'audit.view'] as const) {
    expect(ROLES.filter((role) => can(role, permission)), permission).toStrictEqual(['systemAdmin', 'companyAdmin'])
  }
})

test('registering packages, package types and QR labels belong to the dispatcher alone, through packages.manage (FE-0-06)', () => {
  expect(ROLES.filter((role) => can(role, 'packages.manage'))).toStrictEqual(['dispatcher'])
  // Quản lý công ty xem kho kiện (màn tới sau), không mở được màn đăng ký kiện của điều phối
  expect(can('manager', 'packages.view')).toBe(true)
  expect(can('manager', 'packages.manage')).toBe(false)
})

test('the dispatcher edits and approves plans, the company manager only reads them (FE-0-07); the manager edits no trip or order', () => {
  expect(ROLES.filter((role) => can(role, 'plans.approve'))).toStrictEqual(['dispatcher'])
  expect(can('dispatcher', 'optimization.run')).toBe(true)
  expect(can('manager', 'plans.view')).toBe(true)
  expect(can('manager', 'optimization.run')).toBe(false)
  expect(can('manager', 'trips.edit')).toBe(false)
  expect(can('manager', 'orders.edit')).toBe(false)
})
