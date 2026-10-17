/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm. Chế độ `VITE_AUTH_SOURCE=keycloak` gọi backend, chế độ mẫu gọi kho.
 *   fetchUsers        GET    /api/users (đọc hết các trang)
 *   fetchServerUsers  GET    /api/users — luôn gọi backend, cho màn Công ty đếm người dùng
 *   fetchUserCompanies GET   /api/companies
 *   createUser        POST   /api/users
 *   createServerUser  POST   /api/users — luôn gọi backend, cho màn Công ty tạo quản trị công ty đầu tiên
 *   updateUser        PUT    /api/users/{id}
 *   setUserStatus     PATCH  /api/users/{id}/status
 *   deleteUser        DELETE /api/users/{id}
 *   resetPassword     POST   /api/users/{id}/reset-password
 *   chưa có ở BE: fetchCompanies (danh sách công ty của Nhật ký, Hỗ trợ — vẫn đọc kho)
 * Tên vai trò: backend đang dùng `ADMIN`, `MANAGER` cho hai vai trò công ty; sẽ đổi sang `COMPANY_ADMIN`, `COMPANY_MANAGER`.
 */

import { roleOfBackend } from '@/features/auth/backend-user'
import { api, ApiError, isApiError } from '@/lib/api-client'
import { fetchAllPages } from '@/lib/api-page'
import { usesBackend } from '@/lib/backend-config'
import { getMockDb, type Company, type NewUser, type TemporaryPassword, type UserChanges } from '@/lib/mock-db'
import { formatPhone, PHONE_PATTERN, phoneDigits } from '@/lib/phone'
import { BACKEND_ROLE_CODES, type Role, type User, type UserStatus } from '@/types/user'

/**
 * Lớp gọi API của màn Người dùng (LM-092, D-42). Kho mẫu kiểm luật (email trùng, tự khoá/xoá mình, người quản trị cuối cùng, tài xế còn
 * chuyến, phạm vi theo vai trò — FE-0-08) và từ chối bằng `MockDbError`; backend từ chối bằng `ApiError`. Màn hiện cả hai qua
 * `dataErrorMessage`.
 */

type BackendUser = {
  readonly id: number
  readonly email: string
  readonly fullName: string
  readonly phoneNumber: string | null
  readonly userRoleType: string
  readonly status: string
  readonly companyId: number | null
}

type BackendCompany = { readonly id: number; readonly companyName: string }

type BackendTemporaryPassword = { readonly user: BackendUser; readonly temporaryPassword: string }

const ON_BACKEND = usesBackend('users')

/** Màn tự lọc, sắp xếp và phân trang ở client như với kho mẫu: đọc hết các trang, mỗi trang lớn. */
const PAGE_SIZE = 500

const BACKEND_ROLE: Readonly<Record<Role, string>> = { ...BACKEND_ROLE_CODES, companyAdmin: 'ADMIN', manager: 'MANAGER' }

function backendRole(role: Role): string {
  return BACKEND_ROLE[role]
}

function phoneOf(value: string | null): string {
  const digits = phoneDigits(value ?? '')
  return PHONE_PATTERN.test(digits) ? formatPhone(digits) : (value ?? '')
}

/** Vai trò backend lạ (chưa có ở FE) không vào danh sách: màn không có cách hiển thị hay thao tác đúng với nó. */
function userOf(dto: BackendUser): User | null {
  const role = roleOfBackend(dto.userRoleType)
  if (role === null) return null
  return {
    id: String(dto.id),
    fullName: dto.fullName,
    email: dto.email,
    phone: phoneOf(dto.phoneNumber),
    role,
    // Backend có ACTIVE, INACTIVE, LOCKED; FE chỉ phân biệt dùng được hay không
    status: dto.status === 'ACTIVE' ? 'active' : 'suspended',
    lastActiveAt: null,
    ...(dto.companyId === null ? {} : { companyId: String(dto.companyId) }),
  }
}

function requiredUserOf(dto: BackendUser): User {
  const user = userOf(dto)
  if (user === null) throw new ApiError('SERVER_ERROR')
  return user
}

function passwordOf(dto: BackendTemporaryPassword): TemporaryPassword {
  return { user: requiredUserOf(dto.user), temporaryPassword: dto.temporaryPassword }
}

/** Người dùng trong phạm vi của người đang đăng nhập: quản trị hệ thống nhận mọi tài khoản, quản trị công ty chỉ người của công ty mình. */
// GET /api/users
export async function fetchUsers(): Promise<User[]> {
  if (!ON_BACKEND) return getMockDb().listUsers()
  return fetchServerUsers()
}

/** Người dùng trên backend dù `users` có trong `VITE_API_FEATURES` hay không — màn Công ty nối backend đếm người dùng của từng công ty. */
// GET /api/users
export async function fetchServerUsers(): Promise<User[]> {
  const users = await fetchAllPages<BackendUser>('/api/users', { size: PAGE_SIZE })
  return users.flatMap((dto) => userOf(dto) ?? [])
}

/** Công ty trong phạm vi của người đang đăng nhập — tên công ty cho cột và bộ lọc công ty của Nhật ký, Hỗ trợ (kho mẫu). */
// chưa có ở BE
export function fetchCompanies(): Promise<Company[]> {
  return getMockDb().listCompanies()
}

/** Tên công ty cho cột và bộ lọc công ty của màn Người dùng — cùng nguồn với mã công ty của danh sách người dùng. */
// GET /api/companies
export async function fetchUserCompanies(): Promise<{ id: string; name: string }[]> {
  if (!ON_BACKEND) return (await getMockDb().listCompanies()).map(({ id, name }) => ({ id, name }))
  const page = await api().get<{ content: BackendCompany[] }>('/api/companies', { query: { page: 0, size: PAGE_SIZE } })
  return page.content.map((company) => ({ id: String(company.id), name: company.companyName }))
}

/** Cấp mã, trạng thái hoạt động và mật khẩu tạm — mật khẩu chỉ có trong kết quả này. Backend tự gán công ty của quản trị công ty. */
// POST /api/users
export async function createUser(input: NewUser): Promise<TemporaryPassword> {
  if (!ON_BACKEND) return getMockDb().createUser(input)
  return createServerUser(input)
}

/**
 * Tạo tài khoản trên backend dù `users` có trong `VITE_API_FEATURES` hay không. `companyId` chỉ quản trị hệ thống gửi (người của một
 * công ty); quản trị công ty để trống, backend gán công ty của người gọi. Phong bì lỗi của backend chưa mang mã: 409 ở đây chỉ có một
 * nghĩa — email đã có tài khoản.
 */
// POST /api/users
export async function createServerUser(input: NewUser): Promise<TemporaryPassword> {
  try {
    const result = await api().post<BackendTemporaryPassword>('/api/users', {
      body: {
        email: input.email,
        fullName: input.fullName,
        phoneNumber: phoneDigits(input.phone),
        role: backendRole(input.role),
        ...(input.companyId === undefined ? {} : { companyId: Number(input.companyId) }),
      },
    })
    return passwordOf(result)
  } catch (error) {
    if (isApiError(error) && error.code === 'CONFLICT') throw new ApiError('EMAIL_ALREADY_EXISTS', { status: error.status, params: error.params })
    throw error
  }
}

/** `current` là tài khoản trước khi sửa: backend chưa đổi được email, nên đổi email bị từ chối thay vì bỏ qua im lặng. */
// PUT /api/users/{id}
export async function updateUser(id: string, changes: UserChanges, current?: User): Promise<User> {
  if (!ON_BACKEND) return getMockDb().updateUser(id, changes)
  if (current === undefined) throw new Error('updateUser cần tài khoản trước khi sửa khi nối backend')
  if (changes.email !== undefined && changes.email.toLowerCase() !== current.email.toLowerCase()) throw new ApiError('EMAIL_CHANGE_UNSUPPORTED')
  const result = await api().put<BackendUser>(`/api/users/${id}`, {
    body: {
      fullName: changes.fullName ?? current.fullName,
      phoneNumber: phoneDigits(changes.phone ?? current.phone),
      role: backendRole(changes.role ?? current.role),
    },
  })
  return requiredUserOf(result)
}

// PATCH /api/users/{id}/status
export async function setUserStatus(id: string, status: UserStatus): Promise<User> {
  if (!ON_BACKEND) return getMockDb().setUserStatus(id, status)
  const result = await api().patch<BackendUser>(`/api/users/${id}/status`, { body: { status: status === 'active' ? 'ACTIVE' : 'LOCKED' } })
  return requiredUserOf(result)
}

// DELETE /api/users/{id}
export async function deleteUser(id: string): Promise<void> {
  if (!ON_BACKEND) return getMockDb().deleteUser(id)
  await api().delete<unknown>(`/api/users/${id}`)
}

/** Mật khẩu cũ hết hiệu lực ngay; mật khẩu tạm mới chỉ trả về một lần. */
// POST /api/users/{id}/reset-password
export async function resetPassword(id: string): Promise<TemporaryPassword> {
  if (!ON_BACKEND) return getMockDb().resetPassword(id)
  return passwordOf(await api().post<BackendTemporaryPassword>(`/api/users/${id}/reset-password`))
}
