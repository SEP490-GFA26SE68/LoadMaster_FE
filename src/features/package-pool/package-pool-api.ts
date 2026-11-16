/**
 * Hàm → endpoint backend (FE-0-09). Nối nhóm `packages` thì Kho kiện, Loại kiện và In nhãn là màn của `./backend` (đọc ghi máy chủ qua
 * `backend/*-api.ts`); file này chỉ còn nhánh máy chủ cho những gì màn dùng chung còn gọi — tìm nhanh và Tra cứu kiện:
 *   fetchPackages                 → GET /api/packages
 *   fetchPackageTypes             → GET /api/package-types
 *   fetchPackageType              → GET /api/package-types/{id}
 *   clearPackageFlag              → DELETE /api/packages/{id}/flag
 *   fetchPackageDetail, createPackage, previewPackageImport, confirmPackageImport, downloadPackageImportTemplate, savePackageType,
 *   deletePackageType: chỉ màn kho mẫu gọi
 *   tra cứu kiện ở `package-lookup-api.ts`, nhãn ở `package-labels-api.ts`
 */

import { csvTemplateBlob, xlsxTemplateBlob } from '@/features/trips/package-import-template'
import { readImportFile } from '@/features/trips/read-import-file'
import { tripLinkable } from '@/features/trips/trips-capabilities'
import { api, ApiError } from '@/lib/api-client'
import { fetchAllPages } from '@/lib/api-page'
import { usesBackend } from '@/lib/backend-config'
import {
  getMockDb, MockDbError, type Package, type PackageFlag, type PackageHistoryEntry, type PackageInput, type PackageType, type PackageTypeInput,
} from '@/lib/mock-db'
import { listBackendPackages } from './package-pool-backend'
import { packageOf, type BackendPackage } from './package-pool-dto'
import { importFileError, importInputs, MAX_IMPORT_FILE_MB, parsePackageImport, type ImportFileError, type PackageImportPreview } from './package-pool-import'
import { packageTypeOf, type BackendPackageType } from './package-type-dto'

export { isUnknownPackage, lookupPackages, reportPackageFound, scanPackage, type PackageLookup } from './package-lookup-api'
export { fetchPackageLabels, type LabelSelection, type PackageLabel } from './package-labels-api'

/**
 * Lớp dữ liệu của kho kiện (FE-3b-03, FE-3b-02): loại kiện, kiện, nhập file, nhãn QR. Nơi duy nhất trong feature biết về kho; nối
 * backend thật chỉ thay thân hàm. Kiện thuộc công ty của người tạo; kho lọc theo công ty của phiên (D-64).
 */

const ON_BACKEND = usesBackend('packages')

/**
 * Việc Tra cứu kiện làm được với nguồn dữ liệu đang dùng (màn kho mẫu của Kho kiện chỉ chạy khi chưa nối nhóm `packages`, nên không hỏi
 * bảng này). Màn ẩn phần không có nguồn (D-20), không vẽ số 0 hay ô trống thay cho dữ liệu backend không có.
 */
export const PACKAGE_POOL_SUPPORT = {
  /** Đủ dài × rộng × cao của kiện (lượt quét của máy chủ chỉ trả chiều dài). */
  fullSize: !ON_BACKEND,
  /**
   * Liên kết tới chuyến của kiện: chỉ khi kho kiện và chuyến cùng đọc kho mẫu. Kiện của backend chưa mang mã chuyến mà Chi tiết chuyến
   * tìm được; kiện của kho mẫu không mở được Chi tiết chuyến của máy chủ (`tripLinkable`).
   */
  tripLinks: !ON_BACKEND && tripLinkable(false),
  /**
   * Mã của kho là số backend cấp, không phải `PK-…`: tìm theo số ngắn đó khớp cả mã QR của kiện khác, nên mở một kiện ở Kho kiện
   * (`/kien-hang?q=`) bằng mã QR của nó.
   */
  numericIds: ON_BACKEND,
} as const

/** Đọc được với nhân viên kho, điều phối viên, quản lý công ty. */
// GET /api/package-types
export async function fetchPackageTypes(): Promise<PackageType[]> {
  if (!ON_BACKEND) return getMockDb().listPackageTypes()
  return (await fetchAllPages<BackendPackageType>('/api/package-types')).map(packageTypeOf)
}

// GET /api/package-types/{id}
export async function fetchPackageType(id: string): Promise<PackageType> {
  if (!ON_BACKEND) return getMockDb().getPackageType(id)
  return packageTypeOf(await api().get<BackendPackageType>(`/api/package-types/${encodeURIComponent(id)}`))
}

/** `id` vắng là loại mới (kho cấp mã `PT-NNN`). Dữ liệu sai: `PACKAGE_TYPE_INVALID` kèm mã issue `package.*`. */
export function savePackageType(input: PackageTypeInput, id?: string): Promise<PackageType> {
  return id === undefined ? getMockDb().createPackageType(input) : getMockDb().updatePackageType(id, input)
}

export function deletePackageType(id: string): Promise<void> {
  return getMockDb().deletePackageType(id)
}

/** Mọi kiện của công ty theo phiên, cũ trước. */
// GET /api/packages
export function fetchPackages(): Promise<Package[]> {
  return ON_BACKEND ? listBackendPackages() : getMockDb().listPackages()
}

/** Một mốc lịch sử của kiện kèm tên người làm (`null`: kho không ghi người, hoặc tài khoản đã xoá). */
export type PackageHistoryLine = PackageHistoryEntry & { readonly actorName: string | null }

export type PackageDetail = {
  readonly package: Package
  readonly type: PackageType | undefined
  readonly history: readonly PackageHistoryLine[]
}

/** Chi tiết một kiện: kiện, loại kiện (nếu gắn) và lịch sử kho đã ghi (`Package.history`), mới nhất trước. */
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

/** Thêm một kiện vào kho kiện: `IMPORTED`, nguồn `MANUAL`, mã QR cấp ngay. Dữ liệu sai: `PACKAGE_INVALID`. */
export function createPackage(input: PackageInput): Promise<Package> {
  return getMockDb().createPackage(input)
}

/**
 * Gỡ cờ của kiện; kho ghi nhật ký và lịch sử kiện. Kho mẫu: điều phối viên hoặc nhân viên kho (`ROLE_NOT_ALLOWED`). Máy chủ: chỉ điều phối
 * viên, kiện mang một cờ nên gỡ cờ đó (kiện không mang cờ: 409 `PACKAGE_NOT_FLAGGED`).
 */
// DELETE /api/packages/{id}/flag
export async function clearPackageFlag(id: string, flag: PackageFlag): Promise<Package> {
  if (!ON_BACKEND) return getMockDb().clearPackageFlag(id, flag)
  const cleared = packageOf(await api().delete<BackendPackage>(`/api/packages/${encodeURIComponent(id)}/flag`))
  if (cleared === null) throw new ApiError('NOT_FOUND', { status: 404 })
  return cleared
}

function fileError(error: ImportFileError): MockDbError {
  return new MockDbError(error.code, error.params as never)
}

/**
 * Đọc file `.csv` / `.xlsx` và kiểm từng dòng với kho kiện hiện tại (loại kiện, mã đã có); không ghi gì. Lỗi file từ chối bằng
 * `UNSUPPORTED_FILE_TYPE` · `EMPTY_FILE` · `FILE_TOO_LARGE` · `BATCH_TOO_LARGE` · `IMPORT_COLUMNS_MISSING`.
 */
export async function previewPackageImport(file: File): Promise<PackageImportPreview> {
  const early = importFileError(file, MAX_IMPORT_FILE_MB)
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
export async function confirmPackageImport(preview: PackageImportPreview): Promise<Package[]> {
  const inputs = importInputs(preview)
  if (inputs === null) throw new MockDbError('PACKAGE_IMPORT_INVALID', { errors: preview.errorRows })
  return getMockDb().createPackages(inputs, 'IMPORT')
}

/** File mẫu từ bảng `rows` (tiêu đề theo ngôn ngữ đang chọn, dựng ở `importTemplateRows`); `.xlsx` tải thư viện lười. */
export function downloadPackageImportTemplate(format: 'xlsx' | 'csv', rows: readonly (readonly (string | number)[])[], sheet: string): Promise<Blob> {
  return format === 'csv' ? Promise.resolve(csvTemplateBlob(rows)) : xlsxTemplateBlob(rows, sheet)
}
