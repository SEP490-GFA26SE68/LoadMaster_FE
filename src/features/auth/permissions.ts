import type { Role } from '@/types/user'

/**
 * Quyền của FE giả lập (D-41): chặn route, ẩn mục nav và ẩn nút ghi. Backend thật phải kiểm lại ở server — đây chỉ là lớp giao diện.
 * Một hằng số dùng chung cho route, nav, nút và màn "Ma trận quyền" (LM-092).
 */
export const PERMISSIONS = [
  'dashboard.view',
  'reports.export',
  'trips.view',
  'trips.edit',
  'optimization.run',
  'plans.view',
  'plans.approve',
  'fleet.view',
  'fleet.edit',
  'warehouse.operate',
  'driver.operate',
  'users.manage',
  'audit.view',
  // Review 1 (LM-104): luồng 1 (đăng ký kiện, lô hàng, nhận hàng), luồng 2 (đơn hàng), luồng 4 (hàng đợi duyệt), loại xe.
  'packages.register',
  'shipments.manage',
  'receiving.operate',
  'orders.view',
  'orders.edit',
  'plans.review',
  'vehicleTypes.edit',
] as const

export type Permission = (typeof PERMISSIONS)[number]

/**
 * Quản trị toàn quyền; điều phối lập chuyến và chạy tối ưu nhưng không duyệt; quản lý công ty đọc, xuất báo cáo và **duyệt phương
 * án** (LM-104, quyết định 27/09/2026); kho và tài xế chỉ màn vận hành của mình.
 */
export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  admin: PERMISSIONS,
  dispatcher: ['dashboard.view', 'trips.view', 'trips.edit', 'optimization.run', 'plans.view', 'fleet.view', 'fleet.edit'],
  manager: ['dashboard.view', 'reports.export', 'trips.view', 'plans.view', 'plans.approve', 'fleet.view'],
  warehouse: ['warehouse.operate'],
  driver: ['driver.operate'],
  manufacturer: ['packages.register', 'shipments.manage'],
  logistics: ['receiving.operate'],
}

/**
 * Quyền Review 1 (LM-104) cộng thêm cho vai trò có sẵn — tách khỏi `ROLE_PERMISSIONS` để việc chuyển `plans.approve` của đợt khác
 * không đụng cùng dòng. Điều phối xem/sửa đơn hàng và loại xe; quản lý xem đơn hàng và duyệt trong hàng đợi.
 */
const REVIEW1_EXTRA: Readonly<Partial<Record<Role, readonly Permission[]>>> = {
  dispatcher: ['orders.view', 'orders.edit', 'vehicleTypes.edit'],
  manager: ['orders.view', 'plans.review'],
}

/** Quyền đầy đủ của vai trò: bảng gốc cộng phần Review 1. Mọi nơi đọc quyền đi qua đây hoặc `can`. */
export function permissionsOf(role: Role): readonly Permission[] {
  const extra = REVIEW1_EXTRA[role]
  return extra ? [...ROLE_PERMISSIONS[role], ...extra.filter((permission) => !ROLE_PERMISSIONS[role].includes(permission))] : ROLE_PERMISSIONS[role]
}

export function can(role: Role | undefined, permission: Permission): boolean {
  return role !== undefined && permissionsOf(role).includes(permission)
}
