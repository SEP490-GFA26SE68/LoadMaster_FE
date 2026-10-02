/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm.
 *   fetchPackageDetail            → GET /api/packages/{id}
 *   scanPackage                   → GET /api/packages/scan/{qrToken}
 *   previewPackageImport          → POST /api/packages/import/preview
 *   confirmPackageImport          → POST /api/packages/import/confirm
 *   downloadPackageImportTemplate → GET /api/packages/import/template
 *   fetchPackageLabels            → POST /api/packages/export/labels
 *   chưa có ở BE: fetchPackageTypes, fetchPackageType, savePackageType, deletePackageType, fetchPackages, createPackage, clearPackageFlag,
 *   lookupPackages (tra theo mã của bên gửi), reportPackageFound (kho quét thấy lại kiện mang cờ)
 *   tên sẽ đổi khi nối BE: fetchPackageLabels → exportPackageLabels
 */

import { csvTemplateBlob, xlsxTemplateBlob } from '@/features/trips/package-import-template'
import { readImportFile } from '@/features/trips/read-import-file'
import {
  getMockDb, MockDbError, type Company, type Package, type PackageFlag, type PackageHistoryEntry, type PackageInput, type PackageType, type PackageTypeInput,
} from '@/lib/mock-db'
import { importFileError, importInputs, parsePackageImport, type ImportFileError, type PackageImportPreview } from './package-pool-import'

/**
 * Lớp dữ liệu của kho kiện (FE-3b-03, FE-3b-02): loại kiện, kiện, nhập file, nhãn QR. Nơi duy nhất trong feature biết về kho; nối
 * backend thật chỉ thay thân hàm. Kiện thuộc công ty của người tạo; kho lọc theo công ty của phiên (D-64).
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

/** Một mốc lịch sử của kiện kèm tên người làm (`null`: kho không ghi người, hoặc tài khoản đã xoá). */
export type PackageHistoryLine = PackageHistoryEntry & { readonly actorName: string | null }

export type PackageDetail = { readonly package: Package; readonly type: PackageType | undefined; readonly history: readonly PackageHistoryLine[] }

/** Chi tiết một kiện: kiện, loại kiện (nếu gắn) và lịch sử kho đã ghi (`Package.history`), mới nhất trước. */
// GET /api/packages/{id}
export async function fetchPackageDetail(id: string): Promise<PackageDetail> {
  const db = getMockDb()
  const [pkg, types, users] = await Promise.all([db.getPackage(id), db.listPackageTypes(), db.listUsers()])
  const names = new Map(users.map((user) => [user.id, user.fullName]))
  return {
    package: pkg,
    type: types.find((type) => type.id === pkg.packageTypeId),
    history: pkg.history.map((entry) => ({ ...entry, actorName: entry.actorId === null ? null : (names.get(entry.actorId) ?? null) })).toReversed(),
  }
}

/** Một kiện của màn Tra cứu kiện (FE-3b-06): kiện, loại kiện, và chuyến + điểm giao đang giữ kiện (nếu có). */
export type PackageLookup = {
  readonly package: Package
  readonly type: PackageType | undefined
  readonly trip: { readonly id: string; readonly name: string } | undefined
  readonly stop: { readonly number: number; readonly name: string } | undefined
}

async function withPlace(packages: readonly Package[]): Promise<PackageLookup[]> {
  const db = getMockDb()
  const tripIds = [...new Set(packages.flatMap((pkg) => pkg.tripId ?? []))]
  const [types, trips] = await Promise.all([db.listPackageTypes(), Promise.all(tripIds.map((id) => db.getTrip(id)))])
  const tripById = new Map(trips.map((trip) => [trip.id, trip]))
  return packages.map((pkg) => {
    const trip = pkg.tripId === undefined ? undefined : tripById.get(pkg.tripId)
    const stopIndex = trip?.stops.findIndex((stop) => stop.id === pkg.stopId) ?? -1
    const stop = trip?.stops[stopIndex]
    return {
      package: pkg,
      type: types.find((type) => type.id === pkg.packageTypeId),
      trip: trip ? { id: trip.id, name: trip.name } : undefined,
      stop: stop ? { number: stopIndex + 1, name: stop.name } : undefined,
    }
  })
}

/** Tra kiện theo mã QR vừa quét; không có, hoặc là kiện của công ty khác: `QR_UNKNOWN`. */
// GET /api/packages/scan/{qrToken}
export async function scanPackage(token: string): Promise<PackageLookup> {
  const [found] = await withPlace([await getMockDb().findPackageByQr(token)])
  if (!found) throw new MockDbError('QR_UNKNOWN', { token })
  return found
}

/**
 * Tra kiện theo mã người dùng gõ: mã QR, mã của bên gửi hoặc mã của kho. Mã của bên gửi trùng nhau thì trả mọi kiện khớp, mới nhất
 * trước; không khớp kiện nào của công ty: `QR_UNKNOWN`.
 */
// chưa có ở BE (GET /api/packages/scan/{qrToken} chỉ nhận mã QR)
export async function lookupPackages(code: string): Promise<PackageLookup[]> {
  return withPlace(await getMockDb().lookupPackages(code))
}

/** Nhân viên kho quét thấy lại kiện mang cờ "Không tìm thấy" (D-92): gỡ cờ, kho ghi sự kiện để điều phối viên được báo. */
// chưa có ở BE
export function reportPackageFound(token: string): Promise<Package> {
  return getMockDb().reportPackageFound(token)
}

/** Thêm một kiện vào kho kiện: `IMPORTED`, nguồn `MANUAL`, mã QR cấp ngay. Dữ liệu sai: `PACKAGE_INVALID`. */
// chưa có ở BE
export function createPackage(input: PackageInput): Promise<Package> {
  return getMockDb().createPackage(input)
}

/** Gỡ cờ của kiện — chỉ điều phối viên (`ROLE_NOT_ALLOWED`); kho ghi nhật ký và lịch sử kiện. */
// chưa có ở BE
export function clearPackageFlag(id: string, flag: PackageFlag): Promise<Package> {
  return getMockDb().clearPackageFlag(id, flag)
}

function fileError(error: ImportFileError): MockDbError {
  return new MockDbError(error.code, error.params as never)
}

/**
 * Đọc file `.csv` / `.xlsx` và kiểm từng dòng với kho kiện hiện tại (loại kiện, mã đã có); không ghi gì. Lỗi file từ chối bằng
 * `UNSUPPORTED_FILE_TYPE` · `EMPTY_FILE` · `FILE_TOO_LARGE` · `BATCH_TOO_LARGE` · `IMPORT_COLUMNS_MISSING`.
 */
// POST /api/packages/import/preview
export async function previewPackageImport(file: File): Promise<PackageImportPreview> {
  const early = importFileError(file)
  if (early) throw fileError(early)
  const table = await readImportFile(file).catch(() => {
    throw new MockDbError('UNSUPPORTED_FILE_TYPE', {})
  })
  const db = getMockDb()
  const [existing, packageTypes] = await Promise.all([db.listPackages(), db.listPackageTypes()])
  const result = parsePackageImport(table, { existing, packageTypes })
  if (result.kind === 'error') throw fileError(result)
  return result
}

/**
 * Tạo mọi kiện của bản xem trước trong **một** lần ghi (`IMPORTED`, nguồn `IMPORT`, mỗi kiện một mã QR, một sự kiện nhật ký). Còn dòng
 * lỗi: `PACKAGE_IMPORT_INVALID`, không kiện nào được tạo (D-68).
 */
// POST /api/packages/import/confirm
export async function confirmPackageImport(preview: PackageImportPreview): Promise<Package[]> {
  const inputs = importInputs(preview)
  if (inputs === null) throw new MockDbError('PACKAGE_IMPORT_INVALID', { errors: preview.errorRows })
  return getMockDb().createPackages(inputs, 'IMPORT')
}

/** File mẫu từ bảng `rows` (tiêu đề theo ngôn ngữ đang chọn, dựng ở `importTemplateRows`); `.xlsx` tải thư viện lười. */
// GET /api/packages/import/template
export function downloadPackageImportTemplate(format: 'xlsx' | 'csv', rows: readonly (readonly (string | number)[])[], sheet: string): Promise<Blob> {
  return format === 'csv' ? Promise.resolve(csvTemplateBlob(rows)) : xlsxTemplateBlob(rows, sheet)
}

/** Một nhãn để in: kiện, loại kiện (nếu kiện gắn loại) và công ty của kiện. */
export type PackageLabel = { readonly package: Package; readonly type: PackageType | undefined; readonly owner: Company | undefined }

/** Kiện cần nhãn: các kiện `ids` theo đúng thứ tự, hoặc mọi kiện kho kiện của chuyến `tripId` theo thứ tự kiện trong chuyến. */
export type LabelSelection = { readonly ids?: readonly string[]; readonly tripId?: string }

/**
 * Nhãn của các kiện được chọn (bỏ mã không có trong kho hay của công ty khác). In lại giữ nguyên mã QR của kiện (D-71). Không chọn gì
 * thì không có nhãn nào — kho kiện có hàng nghìn kiện, không in "tất cả".
 */
// POST /api/packages/export/labels
export async function fetchPackageLabels({ ids, tripId }: LabelSelection): Promise<PackageLabel[]> {
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
