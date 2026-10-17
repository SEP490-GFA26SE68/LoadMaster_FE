import { roundCm, roundKg } from '@/domain/geometry'
import { HANDLING_CLASSES, type HandlingClass } from '@/domain/models'
import type { Package, PackageInput, PackageStatus } from '@/lib/mock-db'
import type { PackageLookup } from './package-lookup-api'
import type { ImportRow, ImportRowError, ImportRowWarning, PackageImportPreview } from './package-pool-import'

/**
 * DTO kho kiện của backend và phép đổi sang kiểu của app (FE-0-09). Chỉ các file `-api` của kho kiện dùng file này: kiểu DTO không đi ra
 * khỏi lớp `-api`. Backend lưu kích thước kiện bằng **mm nguyên**, app dùng cm (D-03) — phép đổi mm ↔ cm của kho kiện chỉ nằm ở đây.
 * File nhập ghi cm, backend tự đổi, nên bản xem trước vẫn là cm. Hàm thuần, không gọi mạng.
 */

const MM_PER_CM = 10

/** Một kiện theo `PackageResponse` của backend (danh sách, đọc một kiện, tạo kiện). Kích thước là mm. */
export type BackendPackage = {
  readonly id: number
  readonly orderId?: number | null
  readonly trackingBarcode?: string | null
  readonly actualLength?: number | null
  readonly actualWidth?: number | null
  readonly actualHeight?: number | null
  readonly actualWeightKg?: number | string | null
  readonly packageCode?: string | null
  readonly qrToken?: string | null
  readonly handlingClass?: string | null
  readonly status?: string | null
  readonly destination?: string | null
}

/** Kết quả quét mã (`PackageDetailResponse`): có điểm đến, chuyến và điểm giao; không có kích thước. */
export type BackendPackageScan = {
  readonly id: number
  readonly packageCode?: string | null
  readonly qrToken?: string | null
  readonly handlingClass?: string | null
  readonly actualWeightKg?: number | string | null
  readonly status?: string | null
  readonly orderId?: number | null
  readonly trip?: { readonly id: number; readonly name?: string | null } | null
  readonly stop?: { readonly number?: number | null; readonly name?: string | null } | null
  readonly destination?: string | null
}

/** Thân `POST /api/packages`: kích thước mm nguyên. */
export type BackendPackageRequest = {
  readonly trackingBarcode: string
  readonly packageCode?: string
  readonly actualLength: number
  readonly actualWidth: number
  readonly actualHeight: number
  readonly actualWeightKg: number
  readonly handlingClass: HandlingClass
  readonly destination: string
}

type BackendRowIssue = { readonly rowIndex: number; readonly field?: string | null; readonly errorCode: string; readonly detail?: string | null }

type BackendImportRow = {
  readonly rowIndex: number
  readonly packageCode?: string | null
  readonly lengthCm?: number | string | null
  readonly widthCm?: number | string | null
  readonly heightCm?: number | string | null
  readonly weightKg?: number | string | null
  readonly handlingClass?: string | null
  readonly destination?: string | null
}

/** `ImportPreviewResult`: dòng hợp lệ mang dữ liệu, dòng lỗi chỉ có trong `errors`. Số dòng đếm như Excel (tiêu đề là dòng 1). */
export type BackendImportPreview = {
  readonly totalRows: number
  readonly validCount: number
  readonly errors?: readonly BackendRowIssue[] | null
  readonly warnings?: readonly BackendRowIssue[] | null
  readonly validRows?: readonly BackendImportRow[] | null
}

/** `ImportConfirmResult`: mã các kiện vừa tạo, theo thứ tự dòng của file. */
export type BackendImportConfirm = { readonly totalImported: number; readonly packageIds: readonly number[] }

/** Trạng thái của backend → của app. `CANCELLED` (kiện đã huỷ) không có ở kho kiện của app nên không có dòng nào. */
const STATUS_OF: Readonly<Record<string, PackageStatus>> = { PENDING: 'IMPORTED', PLANNED: 'ASSIGNED', LOADED: 'LOADED', DELIVERED: 'DELIVERED' }

const absent = (value: unknown): value is null | undefined => value === null || value === undefined
const cmOfMm = (mm: number | null | undefined) => (absent(mm) ? 0 : roundCm(mm / MM_PER_CM))
const mmOfCm = (cm: number) => Math.round(roundCm(cm) * MM_PER_CM)
const kgOf = (kg: number | string | null | undefined) => (absent(kg) ? 0 : roundKg(Number(kg)))
const cmOrNull = (cm: number | string | null | undefined) => (absent(cm) ? null : roundCm(Number(cm)))
const kgOrNull = (kg: number | string | null | undefined) => (absent(kg) ? null : roundKg(Number(kg)))

/** Loại hàng của backend; để trống là `STANDARD`, như backend lưu. */
function handlingClassOf(value: string | null | undefined): HandlingClass {
  const code = value?.trim().toUpperCase()
  return HANDLING_CLASSES.find((item) => item === code) ?? 'STANDARD'
}

/**
 * Kiện của app từ kiện của backend; trạng thái lạ (`CANCELLED`) trả `null`. Backend không có cờ, lịch sử, loại kiện, yêu cầu giao hay
 * người tạo của app nên các trường đó rỗng; danh sách không trả chiều rộng, chiều cao và điểm đến (0 và chuỗi rỗng — màn ẩn chúng).
 * Mã của bên gửi để trống thì lấy mã của kho; kiện có `trackingBarcode` là kiện thêm tay (chỉ `POST /api/packages` ghi trường đó).
 */
export function packageOf(dto: BackendPackage): Package | null {
  const status: PackageStatus | undefined = STATUS_OF[dto.status ?? '']
  if (status === undefined) return null
  const id = String(dto.id)
  return {
    id,
    companyId: '',
    packageCode: dto.packageCode?.trim() || id,
    qrToken: dto.qrToken ?? '',
    lengthCm: cmOfMm(dto.actualLength),
    widthCm: cmOfMm(dto.actualWidth),
    heightCm: cmOfMm(dto.actualHeight),
    weightKg: kgOf(dto.actualWeightKg),
    handlingClass: handlingClassOf(dto.handlingClass),
    destination: dto.destination?.trim() ?? '',
    status,
    flags: [],
    source: dto.trackingBarcode ? 'MANUAL' : 'IMPORT',
    createdAt: '',
    createdBy: null,
    history: [],
  }
}

/** Một kiện của màn Tra cứu kiện từ kết quả quét: chuyến là chuyến của đơn hàng chứa kiện (mã chuyến làm tên). */
export function lookupOf(scan: BackendPackageScan): PackageLookup | null {
  const pkg = packageOf(scan)
  if (pkg === null) return null
  const trip = scan.trip ? { id: String(scan.trip.id), name: scan.trip.name?.trim() || String(scan.trip.id) } : undefined
  const stopNumber = scan.stop?.number
  const stop = scan.stop && typeof stopNumber === 'number' ? { number: stopNumber, name: scan.stop.name?.trim() ?? '' } : undefined
  return { package: trip ? { ...pkg, tripId: trip.id } : pkg, type: undefined, trip, stop }
}

/** Thân tạo kiện: cm → mm nguyên. `trackingBarcode` do nơi gọi cấp (backend bắt buộc và không cho trùng). */
export function packageRequestOf(input: PackageInput, trackingBarcode: string): BackendPackageRequest {
  const code = input.packageCode?.trim()
  return {
    trackingBarcode,
    ...(code ? { packageCode: code } : {}),
    actualLength: mmOfCm(input.lengthCm),
    actualWidth: mmOfCm(input.widthCm),
    actualHeight: mmOfCm(input.heightCm),
    actualWeightKg: roundKg(input.weightKg),
    handlingClass: input.handlingClass,
    destination: input.destination.trim(),
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Mã gõ hoặc quét có dạng mã QR của backend (UUID) không. */
export function isBackendQrToken(code: string): boolean {
  return UUID.test(code.trim())
}

/** Mã QR của backend là UUID chữ thường và backend so đúng từng chữ; ô quét của app viết hoa mã (`normalizeQrToken`) nên đổi lại ở đây. */
export function toBackendToken(code: string): string {
  const value = code.trim()
  return UUID.test(value) ? value.toLowerCase() : value
}

const DIMENSION_FIELD: Readonly<Record<string, 'length' | 'width' | 'height'>> = {
  IMPORT_INVALID_LENGTH: 'length',
  IMPORT_INVALID_WIDTH: 'width',
  IMPORT_INVALID_HEIGHT: 'height',
}

/** Số cuối trong chi tiết lỗi ("… dòng 2") — dòng đầu của mã trùng; không có số thì `null`. */
function lastNumber(detail: string | null | undefined): number | null {
  const match = /(\d+)\D*$/.exec(detail ?? '')
  return match ? Number(match[1]) : null
}

/** Mã lỗi dòng của backend → mã của app (màn dịch); câu `message` của backend không bao giờ hiện ra. */
function rowErrorOf(issue: BackendRowIssue): ImportRowError {
  const field = DIMENSION_FIELD[issue.errorCode]
  if (field !== undefined) return { code: 'INVALID_DIMENSION', field }
  switch (issue.errorCode) {
    case 'IMPORT_INVALID_WEIGHT':
      return { code: 'INVALID_WEIGHT' }
    case 'IMPORT_BLANK_DESTINATION':
      return { code: 'DESTINATION_REQUIRED' }
    case 'IMPORT_INVALID_HANDLING_CLASS':
      return { code: 'INVALID_HANDLING_CLASS', value: (issue.detail ?? '').trim().replace(/^'(.*)'$/s, '$1') }
    case 'IMPORT_DUPLICATE_CODE': {
      const firstLine = lastNumber(issue.detail)
      return firstLine === null ? { code: 'DUPLICATE_PACKAGE_CODE_IN_FILE' } : { code: 'DUPLICATE_PACKAGE_CODE', firstLine }
    }
    default:
      return { code: 'ROW_INVALID' }
  }
}

const rowWarningOf = (issue: BackendRowIssue): ImportRowWarning =>
  issue.errorCode === 'IMPORT_EXISTING_CODE' ? { code: 'PACKAGE_CODE_EXISTS_ON_SERVER' } : { code: 'ROW_WARNING' }

const blankRow = (line: number): ImportRow => ({
  line, packageCode: '', lengthCm: null, widthCm: null, heightCm: null, weightKg: null, handlingClass: null, destination: '', errors: [], warnings: [],
})

/**
 * Bản xem trước của app từ bản của backend, giữ `file` để bước xác nhận gửi lại. Dòng chỉ có trong `errors` không có dữ liệu (backend
 * không trả) nên các ô của nó trống; số dòng lỗi / cảnh báo đếm theo dòng, như bản xem trước của kho mẫu.
 */
export function previewOf(result: BackendImportPreview, file: File): PackageImportPreview {
  const errors = result.errors ?? []
  const warnings = result.warnings ?? []
  const rows = new Map<number, ImportRow>()
  for (const row of result.validRows ?? []) {
    rows.set(row.rowIndex, {
      line: row.rowIndex,
      packageCode: row.packageCode?.trim() ?? '',
      lengthCm: cmOrNull(row.lengthCm),
      widthCm: cmOrNull(row.widthCm),
      heightCm: cmOrNull(row.heightCm),
      weightKg: kgOrNull(row.weightKg),
      handlingClass: handlingClassOf(row.handlingClass),
      destination: row.destination?.trim() ?? '',
      errors: [],
      warnings: [],
    })
  }
  for (const issue of [...errors, ...warnings]) if (!rows.has(issue.rowIndex)) rows.set(issue.rowIndex, blankRow(issue.rowIndex))
  const lines = [...rows.values()]
    .map((row) => ({
      ...row,
      errors: errors.filter((issue) => issue.rowIndex === row.line).map(rowErrorOf),
      warnings: warnings.filter((issue) => issue.rowIndex === row.line).map(rowWarningOf),
    }))
    .toSorted((a, b) => a.line - b.line)
  const countRows = (issues: readonly BackendRowIssue[]) => new Set(issues.map((issue) => issue.rowIndex)).size
  return {
    kind: 'preview', rows: lines, total: result.totalRows, valid: result.validCount, errorRows: countRows(errors), warningRows: countRows(warnings), file,
  }
}
