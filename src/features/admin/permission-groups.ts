import { PERMISSIONS, type Permission } from '@/features/auth/permissions'

/** Tiền tố của mã quyền (`trips.edit` → `trips`). */
type Prefix = Permission extends `${infer Head}.${string}` ? Head : never

/** Khu vực của ma trận quyền. Key của nhánh `admin.permissions.groups` trùng các mã này. */
export const PERMISSION_GROUP_IDS = [
  'administration',
  'billing',
  'support',
  'dashboard',
  'requirements',
  'packages',
  'trips',
  'monitoring',
  'fleet',
  'exceptions',
  'pickups',
  'warehouse',
  'driver',
] as const

export type PermissionGroupId = (typeof PERMISSION_GROUP_IDS)[number]

/**
 * Khu vực của từng tiền tố quyền. Khai đủ mọi tiền tố của `Permission` (thiếu là lỗi kiểu). Các tiền tố cùng khu vực phải đứng liền
 * nhau trong `PERMISSIONS` — thứ tự dòng của ma trận là thứ tự của danh sách quyền, nhóm không được đảo nó.
 */
const PREFIX_GROUP: Readonly<Record<Prefix, PermissionGroupId>> = {
  companies: 'administration',
  users: 'administration',
  audit: 'administration',
  subscriptionPlans: 'billing',
  billing: 'billing',
  support: 'support',
  dashboard: 'dashboard',
  reports: 'dashboard',
  requirements: 'requirements',
  packages: 'packages',
  labels: 'packages',
  trips: 'trips',
  routes: 'trips',
  optimization: 'trips',
  plans: 'trips',
  manualConfirm: 'trips',
  monitoring: 'monitoring',
  fleet: 'fleet',
  vehicleTypes: 'fleet',
  exceptions: 'exceptions',
  deadlines: 'exceptions',
  pickups: 'pickups',
  warehouse: 'warehouse',
  driver: 'driver',
}

export type PermissionGroup = {
  readonly id: PermissionGroupId
  readonly permissions: readonly Permission[]
}

function prefixOf(permission: Permission): Prefix {
  return permission.slice(0, permission.indexOf('.')) as Prefix
}

/** Đi qua `PERMISSIONS` theo thứ tự, mở nhóm mới mỗi khi khu vực đổi: ghép các nhóm lại ra đúng danh sách quyền. */
function buildGroups(): readonly PermissionGroup[] {
  const groups: { id: PermissionGroupId; permissions: Permission[] }[] = []
  for (const permission of PERMISSIONS) {
    const id = PREFIX_GROUP[prefixOf(permission)]
    const last = groups.at(-1)
    if (last?.id === id) last.permissions.push(permission)
    else groups.push({ id, permissions: [permission] })
  }
  return groups
}

/** Quyền theo khu vực, theo thứ tự dòng của ma trận. */
export const PERMISSION_GROUPS: readonly PermissionGroup[] = buildGroups()
