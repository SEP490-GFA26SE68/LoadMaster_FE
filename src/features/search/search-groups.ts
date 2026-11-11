import type { Permission } from '@/features/auth/permissions'
import { packagePoolReachable } from '@/features/package-pool/usePackagePoolQuery'
import { TRIPS_CAPABILITIES } from '@/features/trips/trips-capabilities'
import { usesBackend } from '@/lib/backend-config'
import { searchGroupsFor, type SearchGroup } from './quick-search'

/**
 * Nhóm tìm nhanh của người đăng nhập: nhóm theo quyền (`searchGroupsFor`), bỏ kho kiện khi nguồn đang dùng không cho người xem đọc nó —
 * kho kiện nối backend chỉ điều phối viên gọi được (`packagePoolReachable`), quản lý công ty có `packages.view` nhưng gọi
 * `GET /api/packages` là 403. Như màn kho bỏ nút tra cứu, tìm nhanh không gọi rồi mới bỏ kết quả. Chuyến đọc backend thì bỏ nhóm kiện
 * của chuyến: máy chủ chưa trả kiện của chuyến (`TRIPS_CAPABILITIES.packages`). Nhóm xe theo quyền như kho mẫu: máy chủ cho cả
 * điều phối viên lẫn quản lý công ty đọc đội xe. Loại kiện chỉ tìm ở kho mẫu: kho kiện nối backend thì nhóm loại kiện không có nguồn.
 */
export function quickSearchGroups(can: (permission: Permission) => boolean): SearchGroup[] {
  const poolReachable = packagePoolReachable(can)
  return searchGroupsFor(can).filter((group) =>
    (group !== 'pool' || poolReachable) && (group !== 'packages' || TRIPS_CAPABILITIES.packages) && (group !== 'packageTypes' || !usesBackend('packages')))
}
