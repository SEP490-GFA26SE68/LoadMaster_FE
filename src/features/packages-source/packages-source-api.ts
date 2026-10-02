/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm.
 *   fetchRegisteredPackage → GET /api/packages/{id}
 *   findPackageByQr        → GET /api/packages/scan/{qrToken}
 *   registerPackages       → nhập file: POST /api/packages/import/confirm; một kiện, theo số lượng: chưa có ở BE
 *   fetchPackageLabels     → POST /api/packages/export/labels
 *   chưa có ở BE: fetchPackageTypes, fetchPackageType, savePackageType, deletePackageType, fetchRegisteredPackages
 *   tên sẽ đổi khi nối BE: findPackageByQr → scanPackage, registerPackages → confirmPackageImport, fetchPackageLabels → exportPackageLabels
 */

import {
  getMockDb,
  type Company,
  type PackageType,
  type PackageTypeInput,
  type RegisteredPackage,
  type RegisteredPackageInput,
  type RegisteredPackageRow,
} from '@/lib/mock-db'

/**
 * Lớp dữ liệu của nguồn hàng (LM-104; từ FE-0-06 là màn của điều phối viên): loại kiện, kiện đăng ký, nhãn QR. Nơi duy nhất trong
 * feature biết về kho; nối backend thật chỉ thay thân hàm. Kiện đăng ký thuộc công ty của người đăng ký.
 */

// chưa có ở BE
export function fetchPackageTypes(): Promise<PackageType[]> {
  return getMockDb().listPackageTypes()
}

// chưa có ở BE
export function fetchPackageType(id: string): Promise<PackageType> {
  return getMockDb().getPackageType(id)
}

/** `id` vắng là loại mới (kho cấp mã `PT-NNN`). Dữ liệu sai: `PACKAGE_TYPE_INVALID` kèm mã issue `package.*`. */
// chưa có ở BE
export function savePackageType(input: PackageTypeInput, id?: string): Promise<PackageType> {
  return id === undefined ? getMockDb().createPackageType(input) : getMockDb().updatePackageType(id, input)
}

// chưa có ở BE
export function deletePackageType(id: string): Promise<void> {
  return getMockDb().deletePackageType(id)
}

// chưa có ở BE
export function fetchRegisteredPackages(): Promise<RegisteredPackage[]> {
  return getMockDb().listRegisteredPackages()
}

// GET /api/packages/{id}
export function fetchRegisteredPackage(id: string): Promise<RegisteredPackage> {
  return getMockDb().getRegisteredPackage(id)
}

/** Tra kiện theo mã QR (quét hoặc gõ tay); không có: `QR_UNKNOWN`. */
// GET /api/packages/scan/{qrToken}
export function findPackageByQr(token: string): Promise<RegisteredPackage> {
  return getMockDb().findPackageByQr(token)
}

/**
 * Ba cách đăng ký của luồng 1: một kiện (`quantity` 1), theo số lượng (một dòng, `quantity` N), nhập file (nhiều dòng). Kho kiểm mọi
 * dòng trước khi ghi — một dòng sai thì không kiện nào được tạo.
 */
export type RegisterInput =
  | { readonly kind: 'single'; readonly input: RegisteredPackageInput }
  | { readonly kind: 'quantity'; readonly input: RegisteredPackageInput; readonly quantity: number }
  | { readonly kind: 'rows'; readonly rows: readonly RegisteredPackageRow[] }

// POST /api/packages/import/confirm (nhập file); một kiện, theo số lượng: chưa có ở BE
export async function registerPackages(register: RegisterInput): Promise<RegisteredPackage[]> {
  const db = getMockDb()
  switch (register.kind) {
    case 'single':
      return [await db.registerPackage(register.input)]
    case 'quantity':
      return db.registerPackages(register.input, register.quantity)
    case 'rows':
      return db.registerPackageRows(register.rows)
  }
}

/** Một nhãn để in: kiện, loại kiện và công ty sở hữu kiện. */
export type PackageLabel = { readonly package: RegisteredPackage; readonly type: PackageType | undefined; readonly owner: Company | undefined }

/** Nhãn của các kiện `ids` theo đúng thứ tự (bỏ mã không có trong kho); `ids` vắng là mọi kiện kho trả về. */
// POST /api/packages/export/labels
export async function fetchPackageLabels(ids?: readonly string[]): Promise<PackageLabel[]> {
  const db = getMockDb()
  const [packages, types, companies] = await Promise.all([db.listRegisteredPackages(), db.listPackageTypes(), db.listCompanies()])
  const typeById = new Map(types.map((type) => [type.id, type]))
  const companyById = new Map(companies.map((company) => [company.id, company]))
  const byId = new Map(packages.map((pkg) => [pkg.id, pkg]))
  const picked = ids === undefined ? packages : ids.flatMap((id) => byId.get(id) ?? [])
  return picked.map((pkg) => ({ package: pkg, type: typeById.get(pkg.packageTypeId), owner: companyById.get(pkg.ownerCompanyId) }))
}
