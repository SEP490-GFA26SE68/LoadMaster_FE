import type { Permission } from '@/features/auth/permissions'
import { TRIPS_CAPABILITIES } from '@/features/trips/trips-capabilities'
import { searchGroupsFor, type SearchGroup } from './quick-search'

/**
 * Nhóm tìm nhanh của người đăng nhập: nhóm theo quyền (`searchGroupsFor`). Kho kiện, loại kiện và đội xe có ở cả kho mẫu lẫn máy chủ, và
 * máy chủ cho đúng các vai trò có quyền đọc chúng (`packages.view`, `packages.manage`, `fleet.view`), nên quyền là đủ. Chuyến đọc backend
 * thì bỏ nhóm kiện của chuyến: máy chủ chưa trả kiện của chuyến (`TRIPS_CAPABILITIES.packages`) — tìm nhanh không gọi rồi mới bỏ kết quả.
 */
export function quickSearchGroups(can: (permission: Permission) => boolean): SearchGroup[] {
  return searchGroupsFor(can).filter((group) => group !== 'packages' || TRIPS_CAPABILITIES.packages)
}
