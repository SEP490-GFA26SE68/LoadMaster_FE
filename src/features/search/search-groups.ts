import type { Permission } from '@/features/auth/permissions'
import { packagePoolReachable } from '@/features/package-pool/usePackagePoolQuery'
import { TRIPS_CAPABILITIES } from '@/features/trips/trips-capabilities'
import { searchGroupsFor, type SearchGroup } from './quick-search'

/**
 * Nhóm tìm nhanh của người đăng nhập: nhóm theo quyền (`searchGroupsFor`), bỏ kho kiện khi nguồn đang dùng không cho người xem đọc nó —
 * kho kiện nối backend chỉ điều phối viên gọi được (`packagePoolReachable`), quản lý công ty có `packages.view` nhưng gọi
 * `GET /api/packages` là 403. Như màn kho bỏ nút tra cứu, tìm nhanh không gọi rồi mới bỏ kết quả. Chuyến đọc backend thì bỏ nhóm kiện
 * của chuyến: máy chủ chưa trả kiện của chuyến (`TRIPS_CAPABILITIES.packages`).
 */
export function quickSearchGroups(can: (permission: Permission) => boolean): SearchGroup[] {
  const poolReachable = packagePoolReachable(can)
  return searchGroupsFor(can).filter((group) => (group !== 'pool' || poolReachable) && (group !== 'packages' || TRIPS_CAPABILITIES.packages))
}
