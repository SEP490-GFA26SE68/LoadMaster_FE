import type { HandlingClass } from '@/domain/models'

/**
 * Kiện của **kho kiện** theo mô hình backend (FE-3b-01, D-68, D-70, D-92): mỗi kiện có kích thước, khối lượng, loại hàng và điểm đến
 * riêng, một mã QR cấp một lần lúc tạo, trạng thái ghi thật và cờ. Thay kiện đăng ký theo loại kiện của Review 1. Đơn vị cm / kg (D-03).
 */

export const PACKAGE_STATUSES = ['IMPORTED', 'ASSIGNED', 'STAGED', 'LOADED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED'] as const
export type PackageStatus = (typeof PACKAGE_STATUSES)[number]

/** Cờ gắn trên kiện `IMPORTED`: còn cờ thì không chọn được vào đơn hay chuyến (D-92). */
export const PACKAGE_FLAGS = ['NOT_FOUND', 'DAMAGED'] as const
export type PackageFlag = (typeof PACKAGE_FLAGS)[number]

/** Đường kiện vào kho kiện: nhập file, thêm lẻ, thêm trong chuyến, nhận dọc đường. */
export const PACKAGE_SOURCES = ['IMPORT', 'MANUAL', 'TRIP', 'PICKUP'] as const
export type PackageSource = (typeof PACKAGE_SOURCES)[number]

/**
 * Một mốc trong lịch sử của kiện (FE-3b-03): kho ghi ở đúng nơi đổi kiện — tạo, chuyển trạng thái (`movePackage`), gắn và gỡ cờ — nên
 * màn chi tiết không suy lịch sử từ nhật ký. `actorId` `null` khi kho chạy không có phiên.
 */
export type PackageHistoryEntry = { at: string; actorId: string | null } & (
  | { kind: 'created'; source: PackageSource }
  | { kind: 'status'; from: PackageStatus; to: PackageStatus; tripId?: string }
  | { kind: 'flagged'; flag: PackageFlag }
  | { kind: 'flagCleared'; flag: PackageFlag }
)

export type Package = {
  /** Mã của kho (`PK-NNNN`). */
  id: string
  companyId: string
  /** Mã kiện của bên gửi; nơi tạo không đưa thì lấy mã của kho. */
  packageCode: string
  /** Mã trên QR: chuỗi ngẫu nhiên không chứa dữ liệu kiện, cấp lúc tạo và không đổi; tra ngược bằng `findPackageByQr`. */
  qrToken: string
  lengthCm: number
  widthCm: number
  heightCm: number
  weightKg: number
  handlingClass: HandlingClass
  /** Điểm đến, chữ tự do. */
  destination: string
  /** Loại kiện cho ràng buộc xếp (hướng đặt, xếp chồng, tải trên); vắng thì mặc định theo loại hàng (`cargoFromPackage`). */
  packageTypeId?: string
  status: PackageStatus
  flags: PackageFlag[]
  source: PackageSource
  /** Yêu cầu giao chứa kiện — kho mock chưa ghi, tới khi có yêu cầu giao. */
  requirementId?: string
  /** Chuyến và điểm giao của kiện từ lúc `ASSIGNED`. */
  tripId?: string
  stopId?: string
  /** *(tạm)* Đơn hàng Review 1 đang giữ kiện (đơn chưa huỷ); bỏ khi đơn hàng thành yêu cầu giao (`requirementId`). */
  orderId?: string
  /** ISO 8601 */
  createdAt: string
  createdBy: string | null
  /** Lịch sử của kiện, cũ trước; mốc đầu luôn là `created`. */
  history: PackageHistoryEntry[]
}

/** Đầu vào tạo kiện. Công ty, mã QR, trạng thái do kho đặt. */
export type PackageInput = Pick<Package, 'lengthCm' | 'widthCm' | 'heightCm' | 'weightKg' | 'handlingClass' | 'destination'> & {
  packageCode?: string
  packageTypeId?: string
}

/** Trường sửa được của kiện; `packageTypeId: null` là bỏ loại kiện. */
export type PackageChanges = Partial<Omit<PackageInput, 'packageTypeId'>> & { packageTypeId?: string | null }

/**
 * Bảng chuyển trạng thái (D-70). Về `IMPORTED`: kiện bị bỏ khỏi chuyến, hoặc chuyến huỷ trước khi xe chạy; `IN_TRANSIT` → `RETURNED`:
 * khách không nhận. `DELIVERED` và `RETURNED` là trạng thái cuối.
 */
export const PACKAGE_TRANSITIONS: Readonly<Record<PackageStatus, readonly PackageStatus[]>> = {
  IMPORTED: ['ASSIGNED'],
  ASSIGNED: ['STAGED', 'IMPORTED'],
  STAGED: ['LOADED', 'IMPORTED'],
  LOADED: ['IN_TRANSIT', 'IMPORTED'],
  IN_TRANSIT: ['DELIVERED', 'RETURNED'],
  DELIVERED: [],
  RETURNED: [],
}

export function canTransitionPackage(from: PackageStatus, to: PackageStatus): boolean {
  return PACKAGE_TRANSITIONS[from].includes(to)
}

/** Chọn được vào đơn hay chuyến: còn ở kho kiện (`IMPORTED`), không cờ, chưa đơn nào giữ. */
export function isSelectablePackage(pkg: Pick<Package, 'status' | 'flags' | 'orderId'>): boolean {
  return pkg.status === 'IMPORTED' && pkg.flags.length === 0 && pkg.orderId === undefined
}
