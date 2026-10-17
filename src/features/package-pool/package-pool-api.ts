/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm.
 *   fetchPackages                 → GET /api/packages
 *   fetchPackageDetail            → GET /api/packages/{id} · GET /api/packages/scan/{qrToken}
 *   createPackage                 → POST /api/packages
 *   deletePoolPackage             → DELETE /api/packages/{id}
 *   previewPackageImport          → POST /api/packages/import/preview
 *   confirmPackageImport          → POST /api/packages/import/confirm · GET /api/packages
 *   downloadPackageImportTemplate → GET /api/packages/import/template
 *   chưa dùng được ở BE (403 với điều phối viên): fetchPackageTypes, fetchPackageType, savePackageType, deletePackageType
 *   chưa có ở BE: clearPackageFlag (cờ kiện)
 *   tra cứu kiện ở `package-lookup-api.ts`, nhãn ở `package-labels-api.ts`
 */

import { csvTemplateBlob, xlsxTemplateBlob } from '@/features/trips/package-import-template'
import { readImportFile } from '@/features/trips/read-import-file'
import { api, ApiError } from '@/lib/api-client'
import { usesBackend } from '@/lib/backend-config'
import {
  getMockDb, MockDbError, PACKAGE_STATUSES, type Package, type PackageFlag, type PackageHistoryEntry, type PackageInput, type PackageStatus, type PackageType,
  type PackageTypeInput,
} from '@/lib/mock-db'
import { listBackendPackages, readBackendPackage, scanBackendPackage } from './package-pool-backend'
import { lookupOf, packageOf, packageRequestOf, previewOf, type BackendImportConfirm, type BackendImportPreview, type BackendPackage } from './package-pool-dto'
import { importFileError, importInputs, MAX_IMPORT_FILE_MB, parsePackageImport, type ImportFileError, type PackageImportPreview } from './package-pool-import'

export { isUnknownPackage, lookupPackages, reportPackageFound, scanPackage, type PackageLookup } from './package-lookup-api'
export { exportPackageLabelsPdf, fetchPackageLabels, MAX_PDF_LABELS, type LabelSelection, type PackageLabel } from './package-labels-api'

/**
 * Lớp dữ liệu của kho kiện (FE-3b-03, FE-3b-02): loại kiện, kiện, nhập file, nhãn QR. Nơi duy nhất trong feature biết về kho; nối
 * backend thật chỉ thay thân hàm. Kiện thuộc công ty của người tạo; kho lọc theo công ty của phiên (D-64).
 */

const ON_BACKEND = usesBackend('packages')

/** Multipart lớn nhất backend nhận khi chưa cấu hình giới hạn (mặc định của Spring Boot); quá cỡ thì backend trả lỗi máy chủ. */
const BACKEND_UPLOAD_MB = 1

/** Bốn trạng thái kiện của backend, theo tên của app (backend không có Đã soạn, Đang vận chuyển, Hoàn trả). */
const BACKEND_STATUSES: readonly PackageStatus[] = ['IMPORTED', 'ASSIGNED', 'LOADED', 'DELIVERED']

/**
 * Việc kho kiện làm được với nguồn dữ liệu đang dùng. Kho mẫu làm hết; backend thiếu trường và quyền — danh sách không trả chiều rộng,
 * chiều cao, điểm đến; không có cờ, lịch sử, loại kiện dùng được, yêu cầu giao; chỉ điều phối viên được gọi. Màn ẩn phần không có
 * nguồn (D-20), không vẽ số 0 hay ô trống thay cho dữ liệu backend không có.
 */
export const PACKAGE_POOL_SUPPORT = {
  /** Loại kiện: màn `/loai-kien`, ô chọn loại kiện của form, tên loại kiện trên nhãn. */
  packageTypes: !ON_BACKEND,
  /** Đủ dài × rộng × cao của kiện. */
  fullSize: !ON_BACKEND,
  /** Điểm đến ngay trong danh sách (backend chỉ trả ở chi tiết kiện). */
  listDestinations: !ON_BACKEND,
  /** Kiện gắn yêu cầu giao và chuyến trong danh sách (cột, bộ lọc "Đã gán"). */
  links: !ON_BACKEND,
  /** Cờ kiện (Không tìm thấy, Hỏng) và gỡ cờ. */
  flags: !ON_BACKEND,
  /** Lịch sử kiện ở panel chi tiết. */
  history: !ON_BACKEND,
  /** File mẫu và luật đọc file nhập là của backend: chỉ mẫu `.xlsx`, chỉ tên cột của backend, loại hàng ghi bằng mã. */
  serverTemplate: ON_BACKEND,
  /** Nhãn mọi kiện của một chuyến (`?chuyen=`). */
  tripLabels: !ON_BACKEND,
  /** Liên kết tới chuyến của kiện: mã chuyến của backend chỉ mở được khi chuyến cũng đọc từ backend. */
  tripLinks: !ON_BACKEND || usesBackend('trips'),
  /** Chỉ điều phối viên đọc được kho kiện (backend từ chối quản lý công ty và nhân viên kho). */
  dispatcherOnly: ON_BACKEND,
  /** Xoá kiện (chỉ backend có). */
  deletePackage: ON_BACKEND,
  /** File PDF nhãn do backend dựng. */
  pdfLabels: ON_BACKEND,
  /**
   * Mã của kho là số backend cấp, không phải `PK-…`: tìm theo số ngắn đó khớp cả mã QR của kiện khác, nên mở một kiện ở Kho kiện
   * (`/kien-hang?q=`) bằng mã QR của nó.
   */
  numericIds: ON_BACKEND,
  /** Trạng thái kiện có ở nguồn dữ liệu (tab của màn Kho kiện). */
  statuses: ON_BACKEND ? BACKEND_STATUSES : PACKAGE_STATUSES,
  /** Dung lượng file nhập lớn nhất (MB). */
  maxImportMb: ON_BACKEND ? BACKEND_UPLOAD_MB : MAX_IMPORT_FILE_MB,
} as const

const noPackageTypes = (name: string) => Promise.reject(new Error(`Backend chưa mở loại kiện cho điều phối viên: màn không được gọi ${name} khi nối backend.`))

// GET /api/package-types (chưa dùng được ở BE)
export function fetchPackageTypes(): Promise<PackageType[]> {
  return ON_BACKEND ? Promise.resolve([]) : getMockDb().listPackageTypes()
}

// GET /api/package-types/{id} (chưa dùng được ở BE)
export function fetchPackageType(id: string): Promise<PackageType> {
  return ON_BACKEND ? noPackageTypes('fetchPackageType') : getMockDb().getPackageType(id)
}

/** `id` vắng là loại mới (kho cấp mã `PT-NNN`). Dữ liệu sai: `PACKAGE_TYPE_INVALID` kèm mã issue `package.*`. */
// POST /api/package-types · PUT /api/package-types/{id} (chưa dùng được ở BE)
export function savePackageType(input: PackageTypeInput, id?: string): Promise<PackageType> {
  if (ON_BACKEND) return noPackageTypes('savePackageType')
  return id === undefined ? getMockDb().createPackageType(input) : getMockDb().updatePackageType(id, input)
}

// DELETE /api/package-types/{id} (chưa dùng được ở BE)
export function deletePackageType(id: string): Promise<void> {
  return ON_BACKEND ? noPackageTypes('deletePackageType') : getMockDb().deletePackageType(id)
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
  /** Chuyến đang giữ kiện kèm tên — chỉ backend trả (kho mẫu: mã chuyến nằm ở `package.tripId`). */
  readonly trip?: { readonly id: string; readonly name: string }
}

/** Backend: kiện đọc theo mã, điểm đến và chuyến đọc từ lượt quét mã QR của nó (đọc theo mã không trả hai trường đó). */
async function detailOnBackend(id: string): Promise<PackageDetail> {
  const pkg = await readBackendPackage(id)
  const place = lookupOf(await scanBackendPackage(pkg.qrToken))
  const trip = place?.trip
  return {
    package: { ...pkg, destination: place?.package.destination ?? '', ...(trip === undefined ? {} : { tripId: trip.id }) },
    type: undefined,
    history: [],
    ...(trip === undefined ? {} : { trip }),
  }
}

/** Chi tiết một kiện: kiện, loại kiện (nếu gắn) và lịch sử kho đã ghi (`Package.history`), mới nhất trước. */
// GET /api/packages/{id} · GET /api/packages/scan/{qrToken}
export async function fetchPackageDetail(id: string): Promise<PackageDetail> {
  if (ON_BACKEND) return detailOnBackend(id)
  const db = getMockDb()
  const [pkg, types, users] = await Promise.all([db.getPackage(id), db.listPackageTypes(), db.listUsers()])
  const names = new Map(users.map((user) => [user.id, user.fullName]))
  return {
    package: pkg,
    type: types.find((type) => type.id === pkg.packageTypeId),
    history: pkg.history.map((entry) => ({ ...entry, actorName: entry.actorId === null ? null : (names.get(entry.actorId) ?? null) })).toReversed(),
  }
}

/**
 * Thêm một kiện vào kho kiện: `IMPORTED`, nguồn `MANUAL`, mã QR cấp ngay. Dữ liệu sai: `PACKAGE_INVALID`. Backend bắt buộc một mã vạch
 * không trùng mà form không có ô nào: app cấp một mã ngẫu nhiên.
 */
// POST /api/packages
export async function createPackage(input: PackageInput): Promise<Package> {
  if (!ON_BACKEND) return getMockDb().createPackage(input)
  const created = packageOf(await api().post<BackendPackage>('/api/packages', { body: packageRequestOf(input, crypto.randomUUID()) }))
  if (created === null) throw new ApiError('SERVER_ERROR')
  return created
}

/** Xoá một kiện khỏi kho kiện — chỉ backend có (kho mẫu giữ mọi kiện để còn lịch sử). */
// DELETE /api/packages/{id}
export async function deletePoolPackage(id: string): Promise<void> {
  if (!ON_BACKEND) throw new Error('Kho mẫu không xoá kiện: màn chỉ được gọi deletePoolPackage khi nối backend.')
  await api().delete(`/api/packages/${encodeURIComponent(id)}`)
}

/** Gỡ cờ của kiện — chỉ điều phối viên (`ROLE_NOT_ALLOWED`); kho ghi nhật ký và lịch sử kiện. */
// chưa có ở BE
export function clearPackageFlag(id: string, flag: PackageFlag): Promise<Package> {
  if (ON_BACKEND) return Promise.reject(new Error('Backend chưa có cờ kiện: màn không được gọi clearPackageFlag khi nối backend.'))
  return getMockDb().clearPackageFlag(id, flag)
}

function fileError(error: ImportFileError): MockDbError {
  return new MockDbError(error.code, error.params as never)
}

function formOf(file: File): FormData {
  const form = new FormData()
  form.append('file', file)
  return form
}

/**
 * Đọc file `.csv` / `.xlsx` và kiểm từng dòng với kho kiện hiện tại (loại kiện, mã đã có); không ghi gì. Lỗi file từ chối bằng
 * `UNSUPPORTED_FILE_TYPE` · `EMPTY_FILE` · `FILE_TOO_LARGE` · `BATCH_TOO_LARGE` · `IMPORT_COLUMNS_MISSING`. Nối backend thì backend
 * đọc và kiểm file; bản xem trước giữ file để bước xác nhận gửi lại.
 */
// POST /api/packages/import/preview
export async function previewPackageImport(file: File): Promise<PackageImportPreview> {
  const early = importFileError(file, PACKAGE_POOL_SUPPORT.maxImportMb)
  if (early) throw fileError(early)
  if (ON_BACKEND) return previewOf(await api().postForm<BackendImportPreview>('/api/packages/import/preview', formOf(file)), file)
  const table = await readImportFile(file).catch(() => {
    throw new MockDbError('UNSUPPORTED_FILE_TYPE', {})
  })
  const db = getMockDb()
  const [existing, packageTypes] = await Promise.all([db.listPackages(), db.listPackageTypes()])
  const result = parsePackageImport(table, { existing, packageTypes })
  if (result.kind === 'error') throw fileError(result)
  return result
}

/** Backend đọc và kiểm lại file rồi tạo kiện; kiện vừa tạo đọc lại từ danh sách, theo thứ tự backend trả mã. */
async function confirmOnBackend(preview: PackageImportPreview): Promise<Package[]> {
  if (preview.file === undefined) throw new Error('Bản xem trước của backend phải giữ file để xác nhận nhập.')
  const result = await api().postForm<BackendImportConfirm>('/api/packages/import/confirm', formOf(preview.file))
  const byId = new Map((await listBackendPackages()).map((pkg) => [pkg.id, pkg]))
  return result.packageIds.flatMap((id) => byId.get(String(id)) ?? [])
}

/**
 * Tạo mọi kiện của bản xem trước trong **một** lần ghi (`IMPORTED`, nguồn `IMPORT`, mỗi kiện một mã QR, một sự kiện nhật ký). Còn dòng
 * lỗi: `PACKAGE_IMPORT_INVALID` (backend: `IMPORT_HAS_ERRORS`), không kiện nào được tạo (D-68).
 */
// POST /api/packages/import/confirm · GET /api/packages
export async function confirmPackageImport(preview: PackageImportPreview): Promise<Package[]> {
  if (ON_BACKEND) return confirmOnBackend(preview)
  const inputs = importInputs(preview)
  if (inputs === null) throw new MockDbError('PACKAGE_IMPORT_INVALID', { errors: preview.errorRows })
  return getMockDb().createPackages(inputs, 'IMPORT')
}

/** File mẫu từ bảng `rows` (tiêu đề theo ngôn ngữ đang chọn, dựng ở `importTemplateRows`); `.xlsx` tải thư viện lười. Backend: file mẫu `.xlsx` của backend. */
// GET /api/packages/import/template
export function downloadPackageImportTemplate(format: 'xlsx' | 'csv', rows: readonly (readonly (string | number)[])[], sheet: string): Promise<Blob> {
  if (ON_BACKEND) return api().download('/api/packages/import/template')
  return format === 'csv' ? Promise.resolve(csvTemplateBlob(rows)) : xlsxTemplateBlob(rows, sheet)
}
