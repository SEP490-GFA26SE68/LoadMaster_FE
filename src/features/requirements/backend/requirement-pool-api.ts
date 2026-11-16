import { fetchAllPages } from '@/lib/api-page'
import { packageOf, type BackendPackage } from '@/features/package-pool/package-pool-dto'
import type { RequirementPackage } from '../requirements-api'

/**
 * Kiện chọn được cho một yêu cầu giao, đọc từ kho kiện của máy chủ.
 *
 * | Hàm                              | Endpoint           |
 * |----------------------------------|--------------------|
 * | fetchRequirementPackageChoices   | GET /api/packages  |
 */

/** `PackageResponse` của máy chủ, thêm hai trường form cần: cờ của kho và yêu cầu giao đang giữ kiện. */
type PoolPackageDto = BackendPackage & {
  readonly flag?: string | null
  readonly deliveryRequirementId?: number | null
}

/**
 * Kiện còn chờ ở kho (`PENDING`), không mang cờ, chưa thuộc yêu cầu nào — hoặc thuộc chính yêu cầu đang sửa (`requirementId`), để kiện đã
 * chọn vẫn hiện. Máy chủ kiểm lại khi lưu (`PACKAGE_FLAGGED`, `PACKAGE_NOT_AVAILABLE`, `PACKAGE_IN_OTHER_REQUIREMENT`).
 */
// GET /api/packages
export async function fetchRequirementPackageChoices(requirementId?: string): Promise<RequirementPackage[]> {
  const rows = await fetchAllPages<PoolPackageDto>('/api/packages', { size: 200 })
  return rows.flatMap((dto) => {
    const owner = dto.deliveryRequirementId == null ? undefined : String(dto.deliveryRequirementId)
    const choosable = dto.status === 'PENDING' && dto.flag == null && (owner === undefined || owner === requirementId)
    const pkg = choosable ? packageOf(dto) : null
    return pkg === null ? [] : [{ package: pkg, type: undefined }]
  })
}
