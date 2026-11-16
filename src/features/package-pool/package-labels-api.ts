/**
 * Nhãn kiện của kho mẫu. Nối nhóm `packages` thì trang in nhãn là bản máy chủ (`backend/PackageLabelsPage`, file PDF máy chủ dựng qua
 * `backend/packages-api.ts`), không gọi file này.
 */

import { getMockDb, type Company, type Package, type PackageType } from '@/lib/mock-db'

/** Một nhãn để in: kiện, loại kiện (nếu kiện gắn loại) và công ty của kiện. */
export type PackageLabel = { readonly package: Package; readonly type: PackageType | undefined; readonly owner: Company | undefined }

/** Kiện cần nhãn: các kiện `ids` theo đúng thứ tự, hoặc mọi kiện kho kiện của chuyến `tripId` theo thứ tự kiện trong chuyến. */
export type LabelSelection = { readonly ids?: readonly string[]; readonly tripId?: string }

/**
 * Nhãn của các kiện được chọn (bỏ mã không có trong kho hay của công ty khác). In lại giữ nguyên mã QR của kiện (D-71). Không chọn gì
 * thì không có nhãn nào — kho kiện có hàng nghìn kiện, không in "tất cả". Nhãn theo chuyến bỏ kiện nhận dọc đường (nguồn `PICKUP`), như
 * máy chủ: nhãn của chúng in ở hộp duyệt yêu cầu nhận để gửi bên gửi; quét khi dỡ vẫn nhận ra chúng (`listTripLabels` giữ đủ).
 */
export async function fetchPackageLabels({ ids, tripId }: LabelSelection): Promise<PackageLabel[]> {
  const db = getMockDb()
  const wanted = tripId === undefined ? (ids ?? []) : (await db.listTripLabels(tripId)).map((label) => label.poolPackageId)
  if (wanted.length === 0) return []
  const [packages, types, companies] = await Promise.all([db.listPackages(), db.listPackageTypes(), db.listCompanies()])
  const typeById = new Map(types.map((type) => [type.id, type]))
  const companyById = new Map(companies.map((company) => [company.id, company]))
  const byId = new Map(packages.map((pkg) => [pkg.id, pkg]))
  const picked = wanted.flatMap((id) => byId.get(id) ?? []).filter((pkg) => tripId === undefined || pkg.source !== 'PICKUP')
  return picked.map((pkg) => ({
    package: pkg,
    type: pkg.packageTypeId === undefined ? undefined : typeById.get(pkg.packageTypeId),
    owner: companyById.get(pkg.companyId),
  }))
}
