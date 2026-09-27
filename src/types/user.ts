/**
 * Vai trò trong hệ thống (AGENTS.md mục 1). Tên hiển thị: key `roles.<vai trò>` của từ điển. `manufacturer` (nhà sản xuất đăng ký
 * kiện, giao lô hàng) và `logistics` (công ty logistics nhận hàng) thêm cho luồng 1 của Review 1 (LM-104).
 */
export const ROLES = ['dispatcher', 'warehouse', 'driver', 'manager', 'admin', 'manufacturer', 'logistics'] as const

export type Role = (typeof ROLES)[number]

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
  /** Kho hoặc chi nhánh người dùng trực thuộc */
  depot: string
  /** ISO 8601; null khi chưa đăng nhập lần nào */
  lastActiveAt: string | null
  /**
   * Công ty của tài khoản nhà sản xuất hoặc logistics (`MFR-…`, `LOG-…`, LM-104): kiện đăng ký thuộc công ty này, lô hàng chỉ công ty
   * logistics được giao mới nhận. Vai trò khác không có.
   */
  companyId?: string
}

/** Chữ viết tắt hiển thị trên nav rail: lấy chữ cái đầu của hai từ cuối. */
export function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  const picked = parts.slice(-2)
  return picked.map((part) => part[0]?.toUpperCase() ?? '').join('') || '?'
}
