import type { Role } from '@/types/user'

/**
 * Quyền của FE giả lập (D-41): chặn route, ẩn mục nav và ẩn nút ghi. Backend thật phải kiểm lại ở server — đây chỉ là lớp giao diện.
 * Một hằng số dùng chung cho route, nav, nút và màn "Ma trận quyền" (LM-092). Thứ tự là thứ tự dòng của ma trận, theo PRD v2 mục 5.2
 * (FE-0-01): nền tảng và công ty trước, rồi các luồng vận hành. Quyền của màn chưa làm (tối ưu tuyến, giám
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
] as const

export type Permission = (typeof PERMISSIONS)[number]

/**
 * Ma trận quyền — **một bảng duy nhất** (FE-0-01), mỗi vai trò liệt kê quyền theo thứ tự của `PERMISSIONS`. Khớp PRD v2 mục 5.2: hai
 * quyền tạm `orders.view` / `orders.edit` của Review 1 đã bỏ khi Yêu cầu giao thay Đơn hàng (FE-4b-01).
 *
 * Yêu cầu giao `/yeu-cau-giao` mở theo `requirements.view` (Quản lý công ty và Điều phối viên); tạo, sửa, xoá theo `requirements.edit`
 * của Quản lý công ty; đưa yêu cầu vào chuyến là sửa chuyến — `trips.edit` của Điều phối viên (FE-4b-02).
 *
 * Kho kiện `/kien-hang` mở theo `packages.view` (Điều phối viên và Quản lý công ty, FE-3b-03); nút ghi của màn đó và `/loai-kien` theo
 * `packages.manage` của Điều phối viên. In nhãn `/kien-hang/nhan` theo `labels.print`, Tra cứu kiện `/tra-cuu-kien` theo
 * `packages.lookup` — Điều phối viên và Nhân viên kho (FE-3b-05, FE-3b-06). Vai trò nhà sản xuất, logistics và ba quyền `packages.register`, `shipments.manage`,
 * `receiving.operate` đã bỏ (FE-0-06, D-63).
 *
 * `plans.approve` — chỉnh tay và duyệt phương án trong Planner — là của Điều phối viên (FE-0-07, D-80); Quản lý công ty xem phương án
 * chỉ đọc.
 *
 * Quản trị hệ thống chỉ lo công ty, người dùng và nhật ký: ba vai trò nền tảng không có quyền vận hành nào. Quản trị hệ thống và Quản
 * trị công ty cùng có `users.manage`, `audit.view` — phạm vi (toàn hệ thống / trong công ty) do FE-0-08 thêm.
 */
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
    'requirements.edit',
    'packages.view',
    'trips.view',
    'plans.view',
    'monitoring.view',
    'fleet.view',
    'deadlines.renegotiate',
  ],

  dispatcher: [
    'support.create',
    'dashboard.view',
    'requirements.view',
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
    'pickups.create',
    'pickups.approve',
  ],

  warehouse: [
    'support.create',
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
