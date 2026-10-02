/**
 * Vai trò trong hệ thống (AGENTS.md mục 1), mã nội bộ của FE. Tên hiển thị: key `roles.<vai trò>` của từ điển. Thứ tự là thứ tự cột
 * của Ma trận quyền và thứ tự trong ô chọn vai trò: ba vai trò nền tảng, rồi năm vai trò của công ty logistics (PRD v2 mục 5.1) —
 * đúng tám vai trò của backend. Hai vai trò `manufacturer`, `logistics` của Review 1 (LM-104) đã bỏ ở FE-0-06 (D-63).
 */
export const ROLES = ['systemAdmin', 'systemManager', 'systemSupporter', 'companyAdmin', 'manager', 'dispatcher', 'warehouse', 'driver'] as const

export type Role = (typeof ROLES)[number]

/** Ba vai trò của nền tảng: không thuộc công ty nào, không có kho trực thuộc, không có quyền vận hành (kiện, chuyến, kho, tài xế). */
export const PLATFORM_ROLES = ['systemAdmin', 'systemManager', 'systemSupporter'] as const satisfies readonly Role[]

export function isPlatformRole(role: Role): boolean {
  return PLATFORM_ROLES.some((item) => item === role)
}

/** Mã vai trò của backend (D-61): `-api.ts` đổi mã FE sang mã này khi nối API thật. Vai trò nào cũng có mã. */
export const BACKEND_ROLE_CODES = {
  systemAdmin: 'SYSTEM_ADMIN',
  systemManager: 'SYSTEM_MANAGER',
  systemSupporter: 'SYSTEM_SUPPORTER',
  companyAdmin: 'COMPANY_ADMIN',
  manager: 'COMPANY_MANAGER',
  dispatcher: 'DISPATCHER',
  warehouse: 'WAREHOUSE_WORKER',
  driver: 'DRIVER',
} as const satisfies Record<Role, string>

/** Tên hiển thị: key `admin.users.status.<trạng thái>` của từ điển (LM-071). */
export const USER_STATUSES = ['active', 'suspended'] as const

export type UserStatus = (typeof USER_STATUSES)[number]

export type User = {
  id: string
  fullName: string
  email: string
  phone: string
  role: Role
  status: UserStatus
  /** Kho hoặc chi nhánh người dùng trực thuộc; người dùng nền tảng không có (`isPlatformRole`). */
  depot?: string
  /** ISO 8601; null khi chưa đăng nhập lần nào */
  lastActiveAt: string | null
  /**
   * Công ty logistics của tài khoản (`LOG-…`); người dùng nền tảng không có. Kiện đăng ký thuộc công ty của người đăng ký (FE-0-06); kho
   * chưa lọc dữ liệu theo công ty — cách ly theo công ty là việc của FE-0-02.
   */
  companyId?: string
}

/** Chữ viết tắt hiển thị trên nav rail: lấy chữ cái đầu của hai từ cuối. */
export function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  const picked = parts.slice(-2)
  return picked.map((part) => part[0]?.toUpperCase() ?? '').join('') || '?'
}
