import type { Permission } from '@/features/auth/permissions'
import { fleetReachable } from '@/features/fleet/useVehiclesQuery'
import { TRIPS_CAPABILITIES } from '@/features/trips/trips-capabilities'
import { searchGroupsFor, type SearchGroup } from './quick-search'

/**
 * Nhóm tìm nhanh của người đăng nhập: nhóm theo quyền (`searchGroupsFor`). Kho kiện và loại kiện có ở cả kho mẫu lẫn máy chủ, nên quyền
 * là đủ (`packages.view`, `packages.manage`). Chuyến đọc backend thì bỏ nhóm kiện của chuyến: máy chủ chưa trả kiện của chuyến
 * (`TRIPS_CAPABILITIES.packages`). Đội xe nối backend chỉ điều phối viên đọc được (`fleetReachable`): quản lý công ty không có nhóm xe —
 * tìm nhanh không gọi rồi mới bỏ kết quả.
 */
export function quickSearchGroups(can: (permission: Permission) => boolean): SearchGroup[] {
  const vehiclesReachable = fleetReachable(can)
  return searchGroupsFor(can).filter((group) => (group !== 'packages' || TRIPS_CAPABILITIES.packages) && (group !== 'vehicles' || vehiclesReachable))
}
