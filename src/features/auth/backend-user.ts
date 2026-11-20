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
  readonly companyName?: string
  readonly companyCode?: string
  readonly companyTaxCode?: string
  readonly companyBillingEmail?: string
  readonly companyStatus?: string
  readonly userRoleType: string
  readonly userType?: string
  readonly status: string
  readonly subscriptionExpired?: boolean
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
  MANAGER: 'companyManager',
  COMPANY_MANAGER: 'companyManager',
  DISPATCHER: 'dispatcher',
  WAREHOUSE_WORKER: 'warehouse',
  WAREHOUSE: 'warehouse',
  warehouse: 'warehouse',
  DRIVER: 'driver',
  driver: 'driver',
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
 * lấy từ backend; **mã người dùng và công ty** là của tài khoản mẫu cùng vai trò (`standIn`), vì chuyến, xe, kiện của kho mẫu gắn với
 * các mã đó. Kho / chi nhánh của tài khoản mẫu bị bỏ: backend không có trường đó, menu tài khoản không hiện kho của người khác. Khi một
 * feature nối backend thật, dữ liệu của nó đến theo token, không theo `standIn`.
 */
export function userFromBackend(profile: BackendUserProfile, role: Role, standIn: User): User {
  const { depot: _sampleDepot, ...sample } = standIn
  const status = profile.status === 'FLAGGED' ? 'flagged' : 'active'
  return {
    ...sample,
    role,
    fullName: profile.fullName,
    email: profile.email,
    phone: profile.phoneNumber ?? '',
    status,
    // Thông tin công ty (thẻ tài khoản của app mobile): chỉ đặt trường có giá trị, không để khoá `undefined` trong người dùng
    ...definedOnly({
      companyName: profile.companyName ?? sample.companyName,
      companyCode: profile.companyCode ?? sample.companyCode,
      companyTaxCode: profile.companyTaxCode ?? sample.companyTaxCode,
      companyBillingEmail: profile.companyBillingEmail ?? sample.companyBillingEmail,
      companyStatus: profile.companyStatus ?? sample.companyStatus,
    }),
    userType: profile.userType === 'TRIAL' ? 'TRIAL' : 'OFFICIAL',
    subscriptionExpired: Boolean(profile.subscriptionExpired),
  }
}

function definedOnly<T extends Record<string, unknown>>(fields: T): Partial<T> {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as Partial<T>
}
