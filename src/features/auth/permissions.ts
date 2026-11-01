import type { Role } from '@/types/user'

/**
 * Quyền của FE giả lập (D-41): chặn route, ẩn mục nav và ẩn nút ghi. Backend thật phải kiểm lại ở server — đây chỉ là lớp giao diện.
 * Một hằng số dùng chung cho route, nav, nút và màn "Ma trận quyền" (LM-092). Thứ tự là thứ tự dòng của ma trận, theo PRD v2 mục 5.2
 * (FE-0-01): nền tảng và công ty trước, rồi các luồng vận hành. Quyền của màn chưa làm (tối ưu tuyến, giám
 * sát, sự cố, nhận hàng dọc đường, gói cước, hỗ trợ) đã có tên ở đây nhưng chưa gắn route hay nút nào — hiện chỉ có ở Ma trận quyền.
 */

/**
 * Kho kiện:
 * - Warehouse: xem và quản lý kiện, import Excel, quản lý loại kiện.
 * - Dispatcher: chỉ xem và tra cứu kiện, không được thêm/sửa/xóa.
 * - CompanyManager: xem kiện.
 *
 * Yêu cầu giao và lập chuyến thuộc luồng điều phối.
 */
export const PERMISSIONS = [
  'companies.manage',
  'users.manage',
  'audit.view',
  'subscriptionPlans.manage',
  'billing.manage',
  'support.create',
  'support.handle',
  'dashboard.view',
  'reports.export',
  'requirements.view',
  'requirements.edit',
  'packages.view',
  'packages.manage',
  'packages.lookup',
  'labels.print',
  'trips.view',
  'trips.edit',
  'routes.optimize',
  'optimization.run',
  'plans.approve',
  'manualConfirm.approve',
  'plans.view',
  'monitoring.view',
  'fleet.view',
  'fleet.edit',
  'vehicleTypes.edit',
  'exceptions.report',
  'exceptions.resolve',
  'deadlines.renegotiate',
  'pickups.create',
  'pickups.approve',
  'warehouse.operate',
  'driver.operate',
  'companyWarehouses.manage'
] as const

export type Permission = (typeof PERMISSIONS)[number]
export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  systemAdmin: ['companies.manage', 'users.manage', 'audit.view'],
  systemManager: ['subscriptionPlans.manage'],
  systemSupporter: ['support.handle'],
  companyAdmin: ['users.manage', 'audit.view', 'billing.manage', 'support.create'],

  companyManager: [
    'support.create',
    'dashboard.view',
    'reports.export',
    'requirements.view',
    'packages.view',
    'trips.view',
    'plans.view',
    'monitoring.view',
    'fleet.view',
    'deadlines.renegotiate',
    'companyWarehouses.manage'
  ],

  dispatcher: [
    'support.create',
    'dashboard.view',
    'requirements.view',
    'packages.view',
    'packages.lookup',
    'labels.print',
    'trips.view',
    'trips.edit',
    'routes.optimize',
    'optimization.run',
    'plans.approve',
    'manualConfirm.approve',
    'plans.view',
    'monitoring.view',
    'fleet.view',
    'fleet.edit',
    'vehicleTypes.edit',
    'exceptions.report',
    'exceptions.resolve',
    'pickups.create',
    'pickups.approve',
    'requirements.edit'
  ],

  warehouse: [
    'support.create',
    'packages.view',
    'packages.manage',
    'packages.lookup',
    'labels.print',
    'warehouse.operate',
  ],

  driver: [
    'support.create',
    'exceptions.report',
    'pickups.create',
    'driver.operate',
  ],
}

/** Quyền của vai trò, theo thứ tự của `PERMISSIONS`. Mọi nơi đọc quyền đi qua đây hoặc `can`. */
export function permissionsOf(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role]
}

export function can(role: Role | undefined, permission: Permission): boolean {
  return role !== undefined && permissionsOf(role).includes(permission)
}
