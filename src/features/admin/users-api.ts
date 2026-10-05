import type {
  Company,
  NewUser,
  TemporaryPassword,
  UserChanges,
} from '@/lib/mock-db'
import { getMockDb } from '@/lib/mock-db'

import { apiFetch } from '@/lib/api-client'


import {
  ROLE_FROM_BACKEND,
  type Role,
  type User,
  type UserStatus,
} from '@/types/user'

type BackendRole = keyof typeof ROLE_FROM_BACKEND

type UserListItemApi = {
  id: number
  keycloakId: string
  email: string
  fullName: string
  phoneNumber: string | null
  userRoleType: BackendRole
  status: 'ACTIVE' | 'LOCKED'
  companyId: number | null
  companyName: string | null
}

type PageResponse<T> = {
  success: boolean
  message?: string
  data: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

function mapUser(data: UserListItemApi): User {
  return {
    id: String(data.id),

    fullName: data.fullName,

    email: data.email,

    phone: data.phoneNumber ?? '',

    role: ROLE_FROM_BACKEND[data.userRoleType] as Role,

    status: mapUserStatus(data.status),

    companyId:
      data.companyId != null
        ? String(data.companyId)
        : undefined,

    companyName:
      data.companyName ?? undefined,
    depot: undefined,

    lastActiveAt: null,
  }
}

const ROLE_TO_BACKEND = {
  systemAdmin: 'SYSTEM_ADMIN',
  systemManager: 'SYSTEM_MANAGER',
  systemSupporter: 'SYSTEM_SUPPORTER',

  companyAdmin: 'ADMIN',
  companyManager: 'MANAGER',

  dispatcher: 'DISPATCHER',
  warehouse: 'WAREHOUSE_WORKER',
  driver: 'DRIVER',
} as const satisfies Record<Role, BackendRole>


function mapUserStatus(
  status: UserListItemApi['status'],
): UserStatus {
  return status === 'ACTIVE'
    ? 'active'
    : 'suspended'
}

type CreateUserApiResponse = {
  success: boolean
  message?: string
  data: {
    user: UserListItemApi
    temporaryPassword: string
  }
}

/** Người dùng trong phạm vi của người đang đăng nhập: quản trị hệ thống nhận mọi tài khoản, quản trị công ty chỉ người của công ty mình. */
// chưa có ở BE
export async function fetchUsers(): Promise<User[]> {
  const response =
    await apiFetch<PageResponse<UserListItemApi>>(
      '/api/users?page=0&size=100',
    )

  return response.data.map(mapUser)
}

/** Công ty trong phạm vi của người đang đăng nhập — tên công ty cho cột và bộ lọc công ty của quản trị hệ thống (màn Người dùng, Nhật ký). */
// chưa có ở BE
type CompanyApi = {
  id: number
  companyName: string
}

type ApiResponse<T> = {
  success: boolean
  message?: string
  data: T
}

export type CompanyOption = {
  readonly id: string
  readonly name: string
}

export async function fetchCompanies(): Promise<CompanyOption[]> {
  const body =
    await apiFetch<ApiResponse<CompanyApi[]>>(
      '/api/companies/options',
    )

  return body.data.map((company) => ({
    id: String(company.id),
    name: company.companyName,
  }))
}

/** Kho cấp mã, trạng thái hoạt động và mật khẩu tạm — mật khẩu chỉ có trong kết quả này. */
// chưa có ở BE
export async function createUser(
  input: NewUser,
): Promise<TemporaryPassword> {
  const body =
    await apiFetch<CreateUserApiResponse>(
      '/api/users',
      {
        method: 'POST',
        body: JSON.stringify({
          email: input.email,
          fullName: input.fullName,
          phoneNumber: input.phone,
          companyId:
            input.companyId != null
              ? Number(input.companyId)
              : null,
          role: ROLE_TO_BACKEND[input.role],
        }),
      },
    )

  return {
    user: mapUser(body.data.user),
    temporaryPassword:
      body.data.temporaryPassword,
  }
}

// chưa có ở BE
export function updateUser(id: string, changes: UserChanges): Promise<User> {
  return getMockDb().updateUser(id, changes)
}

// chưa có ở BE
export function setUserStatus(id: string, status: UserStatus): Promise<User> {
  return getMockDb().setUserStatus(id, status)
}

// chưa có ở BE
export function deleteUser(id: string): Promise<void> {
  return getMockDb().deleteUser(id)
}

/** Mật khẩu cũ hết hiệu lực ngay; mật khẩu tạm mới chỉ trả về một lần. */
// chưa có ở BE
export function resetPassword(id: string): Promise<TemporaryPassword> {
  return getMockDb().resetPassword(id)
}
