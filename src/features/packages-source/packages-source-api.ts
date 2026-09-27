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
 * Lớp dữ liệu của nguồn hàng phía nhà sản xuất (luồng 1 Review 1, LM-104): công ty, loại kiện, kiện đăng ký, nhãn QR. Nơi duy nhất
 * trong feature biết về kho; nối backend thật chỉ thay thân hàm. Kho lọc theo người đang đăng nhập (nhà sản xuất chỉ thấy của mình).
 */

export function fetchCompanies(kind?: Company['kind']): Promise<Company[]> {
  return getMockDb().listCompanies(kind)
}

export function fetchPackageTypes(): Promise<PackageType[]> {
  return getMockDb().listPackageTypes()
}

export function fetchPackageType(id: string): Promise<PackageType> {
  return getMockDb().getPackageType(id)
}

/** `id` vắng là loại mới (kho cấp mã `PT-NNN`). Dữ liệu sai: `PACKAGE_TYPE_INVALID` kèm mã issue `package.*`. */
export function savePackageType(input: PackageTypeInput, id?: string): Promise<PackageType> {
  return id === undefined ? getMockDb().createPackageType(input) : getMockDb().updatePackageType(id, input)
}

export function deletePackageType(id: string): Promise<void> {
  return getMockDb().deletePackageType(id)
}

export function fetchRegisteredPackages(): Promise<RegisteredPackage[]> {
  return getMockDb().listRegisteredPackages()
}

export function fetchRegisteredPackage(id: string): Promise<RegisteredPackage> {
  return getMockDb().getRegisteredPackage(id)
}

/** Tra kiện theo mã QR (quét hoặc gõ tay); không có: `QR_UNKNOWN`. */
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

/** Một nhãn để in: kiện, loại kiện và nhà sản xuất. */
export type PackageLabel = { readonly package: RegisteredPackage; readonly type: PackageType | undefined; readonly owner: Company | undefined }

/** Nhãn của các kiện `ids` theo đúng thứ tự (bỏ mã không thấy); `ids` vắng là mọi kiện người đăng nhập thấy. */
export async function fetchPackageLabels(ids?: readonly string[]): Promise<PackageLabel[]> {
  const db = getMockDb()
  const [packages, types, companies] = await Promise.all([db.listRegisteredPackages(), db.listPackageTypes(), db.listCompanies()])
  const typeById = new Map(types.map((type) => [type.id, type]))
  const companyById = new Map(companies.map((company) => [company.id, company]))
  const byId = new Map(packages.map((pkg) => [pkg.id, pkg]))
  const picked = ids === undefined ? packages : ids.flatMap((id) => byId.get(id) ?? [])
  return picked.map((pkg) => ({ package: pkg, type: typeById.get(pkg.packageTypeId), owner: companyById.get(pkg.ownerCompanyId) }))
}
