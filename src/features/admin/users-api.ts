import type {
  NewUser,
  TemporaryPassword,
  UserChanges,
} from '@/lib/mock-db'
import { getMockDb } from '@/lib/mock-db'

import { api } from '@/lib/api-client'
import { backendConfig } from '@/lib/backend-config'


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
  if (backendConfig.authSource === 'mock') return getMockDb().listUsers()
  const response =
    await api().get<PageResponse<UserListItemApi>>(
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

export type CompanyOption = {
  readonly id: string
  readonly name: string
}

export async function fetchCompanies(): Promise<CompanyOption[]> {
  if (backendConfig.authSource === 'mock') {
    return (await getMockDb().listCompanies()).map((company) => ({ id: company.id, name: company.name }))
  }
  const companies = await api().get<CompanyApi[]>('/api/companies/options')

  return companies.map((company) => ({
    id: String(company.id),
    name: company.companyName,
  }))
}

/** Kho cấp mã, trạng thái hoạt động và mật khẩu tạm — mật khẩu chỉ có trong kết quả này. */
// chưa có ở BE
export async function createUser(
  input: NewUser,
): Promise<TemporaryPassword> {
  if (backendConfig.authSource === 'mock') return getMockDb().createUser(input)
  const result = await api().post<CreateUserApiResponse['data']>('/api/users', {
        body: {
          email: input.email,
          fullName: input.fullName,
          phoneNumber: input.phone,
          companyId:
            input.companyId != null
              ? Number(input.companyId)
              : null,
          role: ROLE_TO_BACKEND[input.role],
        },
      })

  return {
    user: mapUser(result.user),
    temporaryPassword:
      result.temporaryPassword,
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
