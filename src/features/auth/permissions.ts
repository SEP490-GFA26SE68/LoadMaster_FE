import type { Role } from '@/types/user'

/**
 * Quyền của FE giả lập (D-41): chặn route, ẩn mục nav và ẩn nút ghi. Backend thật phải kiểm lại ở server — đây chỉ là lớp giao diện.
 * Một hằng số dùng chung cho route, nav, nút và màn "Ma trận quyền" (LM-092). Thứ tự là thứ tự dòng của ma trận, theo PRD v2 mục 5.2
 * (FE-0-01): nền tảng và công ty trước, rồi các luồng vận hành. Quyền của màn chưa làm (yêu cầu giao, kho kiện, tối ưu tuyến, giám
 * sát, sự cố, nhận hàng dọc đường, gói cước, hỗ trợ) đã có tên ở đây nhưng chưa gắn route hay nút nào — hiện chỉ có ở Ma trận quyền.
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
  // Tạm, không có trong ma trận PRD v2: hàng đợi duyệt của quản lý (bỏ ở FE-0-07), đơn hàng (giữ tới FE-4b-02, quyết định G3),
  // nguồn hàng của nhà sản xuất và nhận hàng của logistics (bỏ ở FE-0-06).
  'plans.review',
  'orders.view',
  'orders.edit',
  'packages.register',
  'shipments.manage',
  'receiving.operate',
] as const

export type Permission = (typeof PERMISSIONS)[number]

/**
 * Ma trận quyền — **một bảng duy nhất** (FE-0-01), mỗi vai trò liệt kê quyền theo thứ tự của `PERMISSIONS`. Khớp PRD v2 mục 5.2, trừ
 * ba chỗ còn tạm:
 * - `plans.approve` vẫn ở Quản lý công ty; FE-0-07 chuyển sang Điều phối viên cùng lúc với Planner và bỏ `plans.review`.
 * - `orders.view` / `orders.edit` giữ nguyên tới khi Yêu cầu giao thay Đơn hàng (FE-4b-02).
 * - `manufacturer`, `logistics` và ba quyền của họ còn tới FE-0-06.
 *
 * Quản trị hệ thống chỉ lo công ty, người dùng và nhật ký: ba vai trò nền tảng không có quyền vận hành nào. Quản trị hệ thống và Quản
 * trị công ty cùng có `users.manage`, `audit.view` — phạm vi (toàn hệ thống / trong công ty) do FE-0-08 thêm.
 */
export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  systemAdmin: ['companies.manage', 'users.manage', 'audit.view'],
  systemManager: ['subscriptionPlans.manage'],
  systemSupporter: ['support.handle'],
  companyAdmin: ['users.manage', 'audit.view', 'billing.manage', 'support.create'],
  manager: [
    'support.create', 'dashboard.view', 'reports.export', 'requirements.view', 'requirements.edit', 'packages.view', 'trips.view',
    'plans.approve', 'plans.view', 'monitoring.view', 'fleet.view', 'deadlines.renegotiate',
    'plans.review', 'orders.view',
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

/** Quyền của vai trò, theo thứ tự của `PERMISSIONS`. Mọi nơi đọc quyền đi qua đây hoặc `can`. */
export function permissionsOf(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role]
}

export function can(role: Role | undefined, permission: Permission): boolean {
  return role !== undefined && permissionsOf(role).includes(permission)
}
