import { roundCm, roundKg } from '@/domain/geometry'
import { HANDLING_CLASSES, type HandlingClass } from '@/domain/models'
import { PACKAGE_FLAGS, type Package, type PackageFlag, type PackageStatus } from '@/lib/mock-db'
import type { PackageLookup } from './package-lookup-api'
import type { ImportRowError, ImportRowWarning } from './package-pool-import'

/**
 * DTO kho kiện của backend và phép đổi sang kiểu của app (FE-0-09). Chỉ các file `-api` của kho kiện dùng file này: kiểu DTO không đi ra
 * khỏi lớp `-api`. Backend lưu kích thước kiện bằng **cm** (`numeric(10,2)`, cùng đơn vị với file nhập), như app (D-03): chỉ làm tròn tại
 * biên. Hàm thuần, không gọi mạng.
 */

/** Một kiện theo `PackageResponse` của backend (danh sách, đọc một kiện, tạo kiện). Kích thước là cm. */
export type BackendPackage = {
  readonly id: number
  readonly orderId?: number | null
  readonly trackingBarcode?: string | null
  readonly actualLength?: number | string | null
  readonly actualWidth?: number | string | null
  readonly actualHeight?: number | string | null
  readonly actualWeightKg?: number | string | null
  readonly packageCode?: string | null
  readonly qrToken?: string | null
  readonly handlingClass?: string | null
  readonly status?: string | null
  readonly destination?: string | null
  /** Cờ của kiện bị kho bỏ khỏi chuyến (`NOT_FOUND` thiếu lúc soạn, `DAMAGED` hỏng lúc xếp); máy chủ cũ không trả. */
  readonly flag?: string | null
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
  readonly flag?: string | null
}

export type BackendRowIssue = { readonly rowIndex: number; readonly field?: string | null; readonly errorCode: string; readonly detail?: string | null }

/** Trạng thái của backend → của app. `CANCELLED` (kiện đã huỷ) không có ở kho kiện của app nên không có dòng nào. */
const STATUS_OF: Readonly<Record<string, PackageStatus>> = { PENDING: 'IMPORTED', PLANNED: 'ASSIGNED', LOADED: 'LOADED', DELIVERED: 'DELIVERED', RETURNED: 'RETURNED' }

const absent = (value: unknown): value is null | undefined => value === null || value === undefined
const cmOf = (cm: number | string | null | undefined) => (absent(cm) ? 0 : roundCm(Number(cm)))
const kgOf = (kg: number | string | null | undefined) => (absent(kg) ? 0 : roundKg(Number(kg)))

/** Loại hàng của backend; để trống là `STANDARD`, như backend lưu. */
function handlingClassOf(value: string | null | undefined): HandlingClass {
  const code = value?.trim().toUpperCase()
  return HANDLING_CLASSES.find((item) => item === code) ?? 'STANDARD'
}

/** Cờ của backend (một cờ mỗi kiện) → danh sách cờ của app; cờ lạ bị bỏ. */
function flagsOf(flag: string | null | undefined): PackageFlag[] {
  return PACKAGE_FLAGS.filter((item) => item === flag)
}

/**
 * Kiện của app từ kiện của backend; trạng thái lạ (`CANCELLED`) trả `null`. Backend không trả lịch sử, loại kiện, yêu cầu giao hay
 * người tạo của app trong kiện nên các trường đó rỗng; danh sách không trả chiều rộng, chiều cao và điểm đến (0 và chuỗi rỗng — màn ẩn chúng).
 * Mã của bên gửi để trống thì lấy mã của kho. Backend không trả nguồn của kiện (mọi kiện — thêm tay, thêm loạt, nhập file — đều có
 * `trackingBarcode`), nên `source` chỉ để đủ kiểu: màn không hiện nguồn khi nối backend (`PACKAGE_POOL_SUPPORT.source`).
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
    lengthCm: cmOf(dto.actualLength),
    widthCm: cmOf(dto.actualWidth),
    heightCm: cmOf(dto.actualHeight),
    weightKg: kgOf(dto.actualWeightKg),
    handlingClass: handlingClassOf(dto.handlingClass),
    destination: dto.destination?.trim() ?? '',
    status,
    flags: flagsOf(dto.flag),
    source: 'IMPORT',
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
export function backendRowErrorOf(issue: BackendRowIssue): ImportRowError {
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

export const backendRowWarningOf = (issue: BackendRowIssue): ImportRowWarning =>
  issue.errorCode === 'IMPORT_EXISTING_CODE' ? { code: 'PACKAGE_CODE_EXISTS_ON_SERVER' } : { code: 'ROW_WARNING' }
