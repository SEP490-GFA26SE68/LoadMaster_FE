import type { Role, User } from '@/types/user'

/** Hồ sơ người dùng backend trả ở `GET /api/users/me`. */
export type BackendUserProfile = {
  readonly id: number
  readonly keycloakId: string
  readonly username: string
  readonly email: string
  readonly fullName: string
  readonly phoneNumber: string | null
  readonly companyId: number | null
  readonly userRoleType: string
  readonly status: string
}

/**
 * Mã vai trò của backend → vai trò của FE. Backend đang đặt hai vai trò công ty là `ADMIN`, `MANAGER`; tài liệu chung ghi
 * `COMPANY_ADMIN`, `COMPANY_MANAGER` (`BACKEND_ROLE_CODES`) — nhận cả hai cách đặt để đổi tên ở backend không làm gãy đăng nhập.
 */
const ROLE_OF_BACKEND: Readonly<Record<string, Role>> = {
  SYSTEM_ADMIN: 'systemAdmin',
  SYSTEM_MANAGER: 'systemManager',
  SYSTEM_SUPPORTER: 'systemSupporter',
  ADMIN: 'companyAdmin',
  COMPANY_ADMIN: 'companyAdmin',
  MANAGER: 'manager',
  COMPANY_MANAGER: 'manager',
  DISPATCHER: 'dispatcher',
  WAREHOUSE_WORKER: 'warehouse',
  DRIVER: 'driver',
}

export function roleOfBackend(code: string): Role | null {
  return ROLE_OF_BACKEND[code] ?? null
}

/** Backend có ba trạng thái; ngoài `ACTIVE` đều là không dùng được. */
export function isActiveOnBackend(status: string): boolean {
  return status === 'ACTIVE'
}

/**
 * Người dùng của app khi đăng nhập bằng backend mà dữ liệu vận hành còn là kho mẫu: **danh tính** (tên, email, số điện thoại, vai trò)
 * lấy từ backend; **mã người dùng, công ty và kho** là của tài khoản mẫu cùng vai trò (`standIn`), vì chuyến, xe, kiện của kho mẫu gắn
 * với các mã đó. Khi một feature nối backend thật, dữ liệu của nó đến theo token, không theo `standIn`.
 */
export function userFromBackend(profile: BackendUserProfile, role: Role, standIn: User): User {
  return { ...standIn, role, fullName: profile.fullName, email: profile.email, phone: profile.phoneNumber ?? '', status: 'active' }
}
