import { expect, test } from 'vitest'
import { ROLES } from '@/types/user'
import { can, permissionsOf, PERMISSIONS, ROLE_PERMISSIONS } from './permissions'

test('the admin has every permission; nobody else has users or audit (D-41)', () => {
  expect(PERMISSIONS.every((permission) => can('admin', permission))).toBe(true)
  for (const role of ROLES.filter((item) => item !== 'admin')) {
    expect(can(role, 'users.manage'), role).toBe(false)
    expect(can(role, 'audit.view'), role).toBe(false)
  }
})

test('the company manager reads, exports and approves plans, and writes nothing else (LM-104)', () => {
  expect(ROLE_PERMISSIONS.manager.filter((permission) => /\.(edit|run|approve|operate)$/.test(permission))).toStrictEqual(['plans.approve'])
  expect(can('manager', 'reports.export')).toBe(true)
  expect(can('manager', 'trips.view')).toBe(true)
})

test('the dispatcher plans and optimizes but does not approve (LM-104)', () => {
  expect([can('dispatcher', 'trips.edit'), can('dispatcher', 'optimization.run'), can('dispatcher', 'plans.view')]).toStrictEqual([true, true, true])
  expect(can('dispatcher', 'plans.approve')).toBe(false)
})

test('warehouse staff and drivers only operate their own screen', () => {
  expect(ROLE_PERMISSIONS.warehouse).toStrictEqual(['warehouse.operate'])
  expect(ROLE_PERMISSIONS.driver).toStrictEqual(['driver.operate'])
  expect(can(undefined, 'trips.view')).toBe(false)
})

test('Review 1 roles and permissions (LM-104): manufacturers register and ship, logistics receives, dispatchers own orders', () => {
  expect(PERMISSIONS.filter((permission) => can('manufacturer', permission))).toStrictEqual(['packages.register', 'shipments.manage'])
  expect(PERMISSIONS.filter((permission) => can('logistics', permission))).toStrictEqual(['receiving.operate'])
  expect((['orders.view', 'orders.edit', 'vehicleTypes.edit'] as const).every((permission) => can('dispatcher', permission))).toBe(true)
  expect(can('manager', 'orders.view')).toBe(true)
  expect(can('manager', 'orders.edit')).toBe(false)
  expect(can('manager', 'plans.review')).toBe(true)
  expect(can('dispatcher', 'plans.review')).toBe(false)
  expect(can('warehouse', 'receiving.operate')).toBe(false)
  // Không vai trò nào có một quyền hai lần
  for (const role of ROLES) expect(new Set(permissionsOf(role)).size, role).toBe(permissionsOf(role).length)
})
