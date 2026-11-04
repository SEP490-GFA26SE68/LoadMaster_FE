/**
 * Hàm → endpoint backend (FE-0-09) của nhãn kiện:
 *   fetchPackageLabels     → GET /api/packages · GET /api/packages/scan/{qrToken}
 *   exportPackageLabelsPdf → POST /api/packages/export/labels
 */

import { api, ApiError } from '@/lib/api-client'
import { usesBackend } from '@/lib/backend-config'
import { getMockDb, type Company, type Package, type PackageType } from '@/lib/mock-db'
import { listBackendPackages, withDestinations } from './package-pool-backend'

const ON_BACKEND = usesBackend('packages')

/** Số kiện tối đa của một file PDF nhãn backend dựng. */
export const MAX_PDF_LABELS = 200

/** Một nhãn để in: kiện, loại kiện (nếu kiện gắn loại) và công ty của kiện. */
export type PackageLabel = { readonly package: Package; readonly type: PackageType | undefined; readonly owner: Company | undefined }

/** Kiện cần nhãn: các kiện `ids` theo đúng thứ tự, hoặc mọi kiện kho kiện của chuyến `tripId` theo thứ tự kiện trong chuyến. */
export type LabelSelection = { readonly ids?: readonly string[]; readonly tripId?: string }

/**
 * Backend: kiện đọc từ danh sách của công ty (mã lạ hay của công ty khác bị bỏ, như kho mẫu), điểm đến đọc từ lượt quét của từng kiện.
 * Nhãn theo chuyến cần chuyến của backend — nhóm chuyến chưa nối — nên chưa có nhãn nào.
 */
async function labelsOnBackend(ids: readonly string[], tripId: string | undefined): Promise<PackageLabel[]> {
  if (tripId !== undefined || ids.length === 0) return []
  const byId = new Map((await listBackendPackages()).map((pkg) => [pkg.id, pkg]))
  const picked = await withDestinations(ids.flatMap((id) => byId.get(id) ?? []))
  return picked.map((pkg) => ({ package: pkg, type: undefined, owner: undefined }))
}

/**
 * Nhãn của các kiện được chọn (bỏ mã không có trong kho hay của công ty khác). In lại giữ nguyên mã QR của kiện (D-71). Không chọn gì
 * thì không có nhãn nào — kho kiện có hàng nghìn kiện, không in "tất cả".
 */
// GET /api/packages · GET /api/packages/scan/{qrToken}
export async function fetchPackageLabels({ ids, tripId }: LabelSelection): Promise<PackageLabel[]> {
  if (ON_BACKEND) return labelsOnBackend(ids ?? [], tripId)
  const db = getMockDb()
  const wanted = tripId === undefined ? (ids ?? []) : (await db.listTripLabels(tripId)).map((label) => label.poolPackageId)
  if (wanted.length === 0) return []
  const [packages, types, companies] = await Promise.all([db.listPackages(), db.listPackageTypes(), db.listCompanies()])
  const typeById = new Map(types.map((type) => [type.id, type]))
  const companyById = new Map(companies.map((company) => [company.id, company]))
  const byId = new Map(packages.map((pkg) => [pkg.id, pkg]))
  const picked = wanted.flatMap((id) => byId.get(id) ?? [])
  return picked.map((pkg) => ({
    package: pkg,
    type: pkg.packageTypeId === undefined ? undefined : typeById.get(pkg.packageTypeId),
    owner: companyById.get(pkg.companyId),
  }))
}

/** File PDF nhãn của các kiện `ids` (1 → `MAX_PDF_LABELS` kiện), do backend dựng. Kho mẫu không dựng PDF: màn chỉ hiện nút khi nối backend. */
// POST /api/packages/export/labels
export async function exportPackageLabelsPdf(ids: readonly string[]): Promise<Blob> {
  if (!ON_BACKEND) throw new Error('Kho mẫu không dựng PDF nhãn: màn chỉ được gọi exportPackageLabelsPdf khi nối backend.')
  if (ids.length === 0) throw new Error('Không có kiện nào để dựng PDF nhãn.')
  if (ids.length > MAX_PDF_LABELS) throw new ApiError('EXPORT_TOO_MANY_PACKAGES', { params: { max: MAX_PDF_LABELS } })
  return api().download('/api/packages/export/labels', { method: 'POST', body: { packageIds: ids.map(Number) } })
}
