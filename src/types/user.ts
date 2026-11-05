export const ROLES = [
  'systemAdmin',
  'systemManager',
  'systemSupporter',
  'companyAdmin',
  'companyManager',
  'dispatcher',
  'warehouse',
  'driver',
] as const

export type Role = (typeof ROLES)[number]

export const PLATFORM_ROLES = [
  'systemAdmin',
  'systemManager',
  'systemSupporter',
] as const satisfies readonly Role[]

export function isPlatformRole(role: Role): boolean {
  return PLATFORM_ROLES.some((item) => item === role)
}

export const COMPANY_ROLES = [
  'companyAdmin',
  'companyManager',
  'dispatcher',
  'warehouse',
  'driver',
] as const satisfies readonly Role[]

export const BACKEND_ROLE_CODES = {
  systemAdmin: 'SYSTEM_ADMIN',
  systemManager: 'SYSTEM_MANAGER',
  systemSupporter: 'SYSTEM_SUPPORTER',

  companyAdmin: 'ADMIN',
  companyManager: 'MANAGER',

  dispatcher: 'DISPATCHER',
  warehouse: 'WAREHOUSE_WORKER',
  driver: 'DRIVER',
} as const satisfies Record<Role, string>

export type BackendRoleCode =
  (typeof BACKEND_ROLE_CODES)[Role]

export const ROLE_FROM_BACKEND = {
  SYSTEM_ADMIN: 'systemAdmin',
  SYSTEM_MANAGER: 'systemManager',
  SYSTEM_SUPPORTER: 'systemSupporter',

  ADMIN: 'companyAdmin',
  MANAGER: 'companyManager',

  DISPATCHER: 'dispatcher',
  WAREHOUSE_WORKER: 'warehouse',
  DRIVER: 'driver',
} as const satisfies Record<BackendRoleCode, Role>

export const USER_STATUSES = [
  'active',
  'suspended',
] as const

export type UserStatus =
  (typeof USER_STATUSES)[number]

export type User = {
  id: string
  fullName: string
  email: string
  phone: string
  role: Role
  status: UserStatus

  depot?: string

  lastActiveAt: string | null

  companyId?: string
  companyName?: string
}

export function initialsOf(fullName: string): string {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  const picked = parts.slice(-2)

  return (
    picked
      .map((part) =>
        part[0]?.toUpperCase() ?? '',
      )
      .join('') || '?'
  )
}