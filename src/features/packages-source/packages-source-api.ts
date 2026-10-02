/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm.
 *   fetchPackage       → GET /api/packages/{id}
 *   findPackageByQr    → GET /api/packages/scan/{qrToken}
 *   registerPackages   → nhập file: POST /api/packages/import/confirm; một kiện, theo số lượng: chưa có ở BE
 *   fetchPackageLabels → POST /api/packages/export/labels
 *   chưa có ở BE: fetchPackageTypes, fetchPackageType, savePackageType, deletePackageType, fetchPackages
 *   tên sẽ đổi khi nối BE: findPackageByQr → scanPackage, registerPackages → confirmPackageImport, fetchPackageLabels → exportPackageLabels
 */

import { getMockDb, handlingClassOfType, MockDbError, type Company, type Package, type PackageInput, type PackageType, type PackageTypeInput } from '@/lib/mock-db'
import { MAX_REGISTER_QUANTITY } from './register-form'

/**
 * Lớp dữ liệu của nguồn hàng (LM-104; từ FE-0-06 là màn của điều phối viên): loại kiện, kiện của kho kiện, nhãn QR. Nơi duy nhất trong
 * feature biết về kho; nối backend thật chỉ thay thân hàm. Kiện thuộc công ty của người tạo. Từ FE-3b-01 kho giữ kiện theo mô hình
 * backend (`Package`); hộp thoại "Đăng ký kiện" theo loại kiện còn dùng tạm tới màn Kho kiện mới — `registerPackages` đổi dòng đăng ký
 * thành kiện của kho kiện.
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
export function fetchPackages(): Promise<Package[]> {
  return getMockDb().listPackages()
}

// GET /api/packages/{id}
export function fetchPackage(id: string): Promise<Package> {
  return getMockDb().getPackage(id)
}

/** Tra kiện theo mã QR (quét hoặc gõ tay); không có: `QR_UNKNOWN`. */
// GET /api/packages/scan/{qrToken}
export function findPackageByQr(token: string): Promise<Package> {
  return getMockDb().findPackageByQr(token)
}

/** Một dòng đăng ký theo loại kiện: kích thước và khối lượng lấy từ loại kiện; `reference` là mã của bên gửi. */
export type RegisterFields = { readonly packageTypeId: string; readonly destination: string; readonly reference?: string }
export type RegisterRow = RegisterFields & { readonly quantity: number }

/**
 * Ba cách đăng ký của luồng 1: một kiện (`quantity` 1), theo số lượng (một dòng, `quantity` N), nhập file (nhiều dòng). Kho kiểm mọi
 * dòng trước khi ghi — một dòng sai thì không kiện nào được tạo.
 */
export type RegisterInput =
  | { readonly kind: 'single'; readonly input: RegisterFields }
  | { readonly kind: 'quantity'; readonly input: RegisterFields; readonly quantity: number }
  | { readonly kind: 'rows'; readonly rows: readonly RegisterRow[] }

function registerRows(register: RegisterInput): readonly RegisterRow[] {
  switch (register.kind) {
    case 'single':
      return [{ ...register.input, quantity: 1 }]
    case 'quantity':
      return [{ ...register.input, quantity: register.quantity }]
    case 'rows':
      return register.rows
  }
}

/** Mã của bên gửi cho kiện thứ `index` của một dòng: một kiện giữ nguyên mã lô, nhiều kiện thêm số thứ tự; không có mã lô thì để kho đặt. */
function senderCode(row: RegisterRow, index: number): string | undefined {
  const reference = row.reference?.trim()
  if (!reference) return undefined
  return row.quantity === 1 ? reference : `${reference}-${String(index + 1).padStart(Math.max(2, String(row.quantity).length), '0')}`
}

// POST /api/packages/import/confirm (nhập file); một kiện, theo số lượng: chưa có ở BE
export async function registerPackages(register: RegisterInput): Promise<Package[]> {
  const db = getMockDb()
  const rows = registerRows(register)
  const typeById = new Map((await db.listPackageTypes()).map((type) => [type.id, type]))
  const inputs = rows.flatMap((row) => {
    const type = typeById.get(row.packageTypeId)
    if (!type) throw new MockDbError('NOT_FOUND', { collection: 'packageTypes', id: row.packageTypeId })
    if (!Number.isInteger(row.quantity) || row.quantity < 1 || row.quantity > MAX_REGISTER_QUANTITY) {
      throw new MockDbError('QUANTITY_INVALID', { min: 1, max: MAX_REGISTER_QUANTITY })
    }
    return Array.from({ length: row.quantity }, (_, index): PackageInput => {
      const packageCode = senderCode(row, index)
      return {
        lengthCm: type.lengthCm, widthCm: type.widthCm, heightCm: type.heightCm, weightKg: type.weightKg,
        handlingClass: handlingClassOfType(type), destination: row.destination, packageTypeId: type.id,
        ...(packageCode === undefined ? {} : { packageCode }),
      }
    })
  })
  return db.createPackages(inputs, register.kind === 'rows' ? 'IMPORT' : 'MANUAL')
}

/** Một nhãn để in: kiện, loại kiện (nếu kiện gắn loại) và công ty của kiện. */
export type PackageLabel = { readonly package: Package; readonly type: PackageType | undefined; readonly owner: Company | undefined }

/** Nhãn của các kiện `ids` theo đúng thứ tự (bỏ mã không có trong kho); `ids` vắng là mọi kiện kho trả về. */
// POST /api/packages/export/labels
export async function fetchPackageLabels(ids?: readonly string[]): Promise<PackageLabel[]> {
  const db = getMockDb()
  const [packages, types, companies] = await Promise.all([db.listPackages(), db.listPackageTypes(), db.listCompanies()])
  const typeById = new Map(types.map((type) => [type.id, type]))
  const companyById = new Map(companies.map((company) => [company.id, company]))
  const byId = new Map(packages.map((pkg) => [pkg.id, pkg]))
  const picked = ids === undefined ? packages : ids.flatMap((id) => byId.get(id) ?? [])
  return picked.map((pkg) => ({
    package: pkg,
    type: pkg.packageTypeId === undefined ? undefined : typeById.get(pkg.packageTypeId),
    owner: companyById.get(pkg.companyId),
  }))
}
