import { expect, test } from 'vitest'
import { BACKEND_ROLE_CODES, isPlatformRole, PLATFORM_ROLES, ROLES, type Role } from '@/types/user'
import { can, permissionsOf, PERMISSIONS, ROLE_PERMISSIONS, type Permission } from './permissions'

/**
 * Ma trận quyền (FE-0-01, FE-0-07, FE-0-06, FE-4b-01): tập quyền kỳ vọng của từng vai trò chép tay từ PRD v2 mục 5.2, không tính lại
 * từ bảng trong code.
 */
const EXPECTED: Readonly<Record<Role, readonly Permission[]>> = {
  systemAdmin: ['companies.manage', 'users.manage', 'audit.view', 'contacts.handle', 'trialRequests.manage'],
  systemManager: ['companies.manage', 'subscriptionPlans.manage'],
  systemSupporter: ['support.handle', 'contacts.handle'],
  companyAdmin: ['companyProfile.manage', 'users.manage', 'audit.view', 'billing.manage', 'support.create'],
  companyManager: [
    'support.create', 'dashboard.view', 'reports.export', 'requirements.view', 'packages.view', 'trips.view', 'plans.view',
    'monitoring.view', 'fleet.view', 'deadlines.renegotiate', 'companyWarehouses.manage',
  ],
  dispatcher: [
    'support.create', 'dashboard.view', 'requirements.view', 'requirements.edit', 'packages.view', 'packages.lookup', 'labels.print',
    'trips.view', 'trips.edit', 'routes.optimize', 'optimization.run', 'plans.approve', 'manualConfirm.approve', 'plans.view',
    'monitoring.view', 'fleet.view', 'fleet.edit', 'vehicleTypes.edit', 'exceptions.report', 'exceptions.resolve', 'pickups.create',
    'pickups.approve',
  ],
  warehouse: ['support.create', 'packages.view', 'packages.manage', 'packages.lookup', 'labels.print', 'warehouse.operate'],
  driver: ['support.create', 'exceptions.report', 'pickups.create', 'driver.operate'],
}

test.each(ROLES)('%s has exactly its permissions from the matrix', (role) => {
  expect(PERMISSIONS.filter((permission) => can(role, permission))).toStrictEqual(EXPECTED[role])
})

test('exactly the eight roles of the backend, each with its backend code; manufacturer and logistics are gone (FE-0-06)', () => {
  expect(ROLES).toStrictEqual(['systemAdmin', 'systemManager', 'systemSupporter', 'companyAdmin', 'companyManager', 'dispatcher', 'warehouse', 'driver'])
  expect(Object.keys(BACKEND_ROLE_CODES)).toStrictEqual([...ROLES])
  expect(BACKEND_ROLE_CODES).toStrictEqual({
    systemAdmin: 'SYSTEM_ADMIN',
    systemManager: 'SYSTEM_MANAGER',
    systemSupporter: 'SYSTEM_SUPPORTER',
    companyAdmin: 'ADMIN',
    companyManager: 'MANAGER',
    dispatcher: 'DISPATCHER',
    warehouse: 'WAREHOUSE_WORKER',
    driver: 'DRIVER',
  })
})

test('one table: 37 permissions, each granted to at least one role; a role lists each of its permissions once, in the order of the matrix rows', () => {
  // 33 quyền của ma trận PRD v2 cộng `contacts.handle`, `companyProfile.manage`, `trialRequests.manage`, `companyWarehouses.manage`; ba
  // quyền của nhà sản xuất và logistics đã bỏ (FE-0-06), hai quyền đơn hàng tạm đã bỏ (FE-4b-01)
  expect(PERMISSIONS).toHaveLength(37)
  expect(new Set(PERMISSIONS).size).toBe(37)
  expect(PERMISSIONS.filter((permission) => /^(packages\.register|shipments\.|receiving\.|orders\.)/.test(permission))).toStrictEqual([])
  expect(PERMISSIONS.slice(-2)).toStrictEqual(['warehouse.operate', 'driver.operate'])
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
    /^(dashboard|reports|requirements|packages|labels|trips|routes|optimization|plans|manualConfirm|monitoring|fleet|vehicleTypes|exceptions|deadlines|pickups|warehouse|driver)\./.test(permission))
  expect(operational).toHaveLength(26)
  expect(PLATFORM_ROLES).toStrictEqual(['systemAdmin', 'systemManager', 'systemSupporter'])
  for (const role of PLATFORM_ROLES) {
    expect(isPlatformRole(role), role).toBe(true)
    expect(operational.filter((permission) => can(role, permission)), role).toStrictEqual([])
  }
  expect(ROLES.filter((role) => !isPlatformRole(role))).toStrictEqual(['companyAdmin', 'companyManager', 'dispatcher', 'warehouse', 'driver'])
})

test('users and the audit log belong to the system administrator and the company administrator only', () => {
  for (const permission of ['users.manage', 'audit.view'] as const) {
    expect(ROLES.filter((role) => can(role, permission)), permission).toStrictEqual(['systemAdmin', 'companyAdmin'])
  }
})

test('writing to the package pool and package types belongs to the warehouse worker, through packages.manage (backend PACKAGE_MANAGE)', () => {
  expect(ROLES.filter((role) => can(role, 'packages.manage'))).toStrictEqual(['warehouse'])
  // Quản lý công ty và điều phối viên xem kho kiện (`packages.view`); ghi vào kho kiện là của nhân viên kho
  expect(can('dispatcher', 'packages.view')).toBe(true)
  expect(can('companyManager', 'packages.view')).toBe(true)
  expect(can('companyManager', 'packages.manage')).toBe(false)
})

test('the dispatcher edits and approves plans, the company manager only reads them (FE-0-07); the manager edits no trip or order', () => {
  expect(ROLES.filter((role) => can(role, 'plans.approve'))).toStrictEqual(['dispatcher'])
  expect(can('dispatcher', 'optimization.run')).toBe(true)
  expect(can('companyManager', 'plans.view')).toBe(true)
  expect(can('companyManager', 'optimization.run')).toBe(false)
  expect(can('companyManager', 'trips.edit')).toBe(false)
  // Yêu cầu giao: điều phối viên tạo và sửa (như backend), quản lý công ty chỉ xem
  expect(ROLES.filter((role) => can(role, 'requirements.view'))).toStrictEqual(['companyManager', 'dispatcher'])
  expect(ROLES.filter((role) => can(role, 'requirements.edit'))).toStrictEqual(['dispatcher'])
})

test('guest contact requests are handled by the system administrator and customer support only (contacts.handle)', () => {
  expect(ROLES.filter((role) => can(role, 'contacts.handle'))).toStrictEqual(['systemAdmin', 'systemSupporter'])
  expect(PERMISSIONS.indexOf('contacts.handle')).toBe(PERMISSIONS.indexOf('support.handle') + 1)
})
