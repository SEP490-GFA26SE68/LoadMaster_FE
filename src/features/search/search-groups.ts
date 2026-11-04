import type { Permission } from '@/features/auth/permissions'
import { fleetReachable } from '@/features/fleet/useVehiclesQuery'
import { packagePoolReachable } from '@/features/package-pool/usePackagePoolQuery'
import { TRIPS_CAPABILITIES } from '@/features/trips/trips-capabilities'
import { searchGroupsFor, type SearchGroup } from './quick-search'

/**
 * Nhóm tìm nhanh của người đăng nhập: nhóm theo quyền (`searchGroupsFor`), bỏ kho kiện khi nguồn đang dùng không cho người xem đọc nó —
 * kho kiện nối backend chỉ điều phối viên gọi được (`packagePoolReachable`), quản lý công ty có `packages.view` nhưng gọi
 * `GET /api/packages` là 403. Như màn kho bỏ nút tra cứu, tìm nhanh không gọi rồi mới bỏ kết quả. Chuyến đọc backend thì bỏ nhóm kiện
 * của chuyến: máy chủ chưa trả kiện của chuyến (`TRIPS_CAPABILITIES.packages`). Đội xe nối backend cũng chỉ điều phối viên đọc được
 * (`fleetReachable`): quản lý công ty không có nhóm xe.
 */
export function quickSearchGroups(can: (permission: Permission) => boolean): SearchGroup[] {
  const poolReachable = packagePoolReachable(can)
  const vehiclesReachable = fleetReachable(can)
  return searchGroupsFor(can).filter((group) =>
    (group !== 'pool' || poolReachable) && (group !== 'packages' || TRIPS_CAPABILITIES.packages) && (group !== 'vehicles' || vehiclesReachable))
}
