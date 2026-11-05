/**
 * Hàm → endpoint backend (FE-0-09). Tab "Quản trị công ty" của màn Công ty chỉ có khi nhóm `companies` nối backend (`COMPANIES_ON_SERVER`):
 * kho mẫu quản lý tài khoản quản trị công ty ở màn Người dùng, nên nhóm tắt thì không có dòng nào và lệnh ghi bị từ chối `NOT_SUPPORTED`.
 *   listCompanyAdmins         → GET /api/users?role=ADMIN (đọc hết các trang)
 *   updateCompanyAdmin        → PUT /api/users/{id}
 *   updateCompanyAdminStatus  → PATCH /api/users/{id}/status
 */

import { api, ApiError } from '@/lib/api-client'
import { fetchAllPages } from '@/lib/api-page'
import { usesBackend } from '@/lib/backend-config'
import { isoFromBackend } from '@/lib/backend-time'

const ON_BACKEND = usesBackend('companies')

export type CompanyAdminStatus = 'ACTIVE' | 'LOCKED'

export type CompanyAdminUser = {
  readonly id: number
  readonly email: string
  readonly fullName: string
  readonly phoneNumber: string | null
  readonly status: CompanyAdminStatus
  readonly companyId: number | null
  readonly companyName: string | null
  readonly companyCode: string | null
  readonly taxCode: string | null
  readonly planName: string | null
  readonly planTier: string | null
  readonly planCode: string | null
  readonly subscriptionStatus: string | null
  readonly subscriptionExpiresAt: string | null
  readonly creditBalance: number | null
  readonly createdAt: string | null
}

/** `UserListItemResponse`; mốc giờ là `LocalDateTime` giờ Việt Nam. */
type CompanyAdminDto = {
  readonly id: number
  readonly email: string
  readonly fullName: string | null
  readonly phoneNumber: string | null
  readonly status: string | null
  readonly companyId: number | null
  readonly companyName: string | null
  readonly companyCode: string | null
  readonly taxCode: string | null
  readonly planName: string | null
  readonly planTier: string | null
  readonly planCode: string | null
  readonly subscriptionStatus: string | null
  readonly subscriptionExpiresAt: string | null
  readonly creditBalance: number | null
  readonly createdAt: string | null
}

function timeOf(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    return isoFromBackend(value)
  } catch {
    return null
  }
}

function adminOf(dto: CompanyAdminDto): CompanyAdminUser {
  return {
    id: dto.id,
    email: dto.email,
    fullName: dto.fullName ?? dto.email,
    phoneNumber: dto.phoneNumber ?? null,
    status: dto.status === 'ACTIVE' ? 'ACTIVE' : 'LOCKED',
    companyId: dto.companyId ?? null,
    companyName: dto.companyName ?? null,
    companyCode: dto.companyCode ?? null,
    taxCode: dto.taxCode ?? null,
    planName: dto.planName ?? null,
    planTier: dto.planTier ?? null,
    planCode: dto.planCode ?? null,
    subscriptionStatus: dto.subscriptionStatus ?? null,
    subscriptionExpiresAt: timeOf(dto.subscriptionExpiresAt),
    creditBalance: dto.creditBalance ?? null,
    createdAt: timeOf(dto.createdAt),
  }
}

/** Mọi tài khoản Quản trị công ty của mọi công ty, kèm gói và số dư của công ty đó; màn tìm và lọc ở client. */
// GET /api/users?role=ADMIN
export async function listCompanyAdmins(): Promise<CompanyAdminUser[]> {
  if (!ON_BACKEND) return []
  return (await fetchAllPages<CompanyAdminDto>('/api/users', { query: { role: 'ADMIN' } })).map(adminOf)
}

/** Sửa họ tên, số điện thoại; vai trò và công ty giữ nguyên. */
// PUT /api/users/{id}
export async function updateCompanyAdmin(admin: CompanyAdminUser, data: { readonly fullName: string; readonly phoneNumber?: string }): Promise<void> {
  if (!ON_BACKEND) throw new ApiError('NOT_SUPPORTED')
  const body = { fullName: data.fullName, phoneNumber: data.phoneNumber, role: 'ADMIN', companyId: admin.companyId }
  await api().put(`/api/users/${admin.id}`, { body })
}

/** Khoá hoặc mở khoá tài khoản. */
// PATCH /api/users/{id}/status
export async function updateCompanyAdminStatus(id: number, status: CompanyAdminStatus): Promise<void> {
  if (!ON_BACKEND) throw new ApiError('NOT_SUPPORTED')
  await api().patch(`/api/users/${id}/status`, { body: { status } })
}
