import type { FragilityLevel, OrientationCode } from '@/domain/models'

/**
 * Kiểu dữ liệu Review 1 (LM-104): nguồn hàng (loại kiện, kiện đăng ký, công ty), đơn hàng, lần chạy tối ưu, loại xe và nhãn QR. Đơn vị
 * cm / kg như mọi dữ liệu của kho (D-03). Lô hàng và luồng nhận hàng giữa hai công ty đã bỏ (FE-0-06, D-63).
 */

/** Kho xuất phát của công ty: nơi xe nhận hàng và rời đi. Toạ độ WGS84, độ thập phân. */
export type CompanyDepot = {
  name: string
  address: string
  lat: number
  lng: number
}

/**
 * Công ty logistics dùng app (`LOG-NNN`, D-63, D-64): công ty của tài khoản (`User.companyId`) và chủ của mọi dữ liệu vận hành — xe,
 * loại xe, loại kiện, kiện đăng ký, đơn hàng, chuyến (kèm revision, lần chạy tối ưu) và sự kiện nhật ký.
 */
export type Company = {
  id: string
  name: string
  address: string
  phone: string
  depot: CompanyDepot
}

/** Loại kiện (`PT-NNN`): khuôn để đăng ký kiện, cùng trường xếp hàng với `CargoPackage` (kiện đăng ký theo loại này). */
export type PackageType = {
  id: string
  /** Công ty có loại kiện này trong danh mục (D-64). */
  companyId: string
  name: string
  lengthCm: number
  widthCm: number
  heightCm: number
  weightKg: number
  fragilityLevel: FragilityLevel
  allowedOrientations: OrientationCode[]
  keepUpright: boolean
  stackable: boolean
  /** Số tầng tối đa khi xếp chồng cùng loại; vắng là không giới hạn. */
  maxStackCount?: number
  /** Tải tối đa đặt lên trên, kg; 0 khi không xếp chồng được. */
  maxTopLoadKg: number
  /** ISO 8601 */
  createdAt: string
}

export type PackageTypeInput = Omit<PackageType, 'id' | 'companyId' | 'createdAt'>

/**
 * Trạng thái kiện đăng ký. Kho lưu `registered`, `received` (hàng có ở kho, đưa vào đơn được) và `planned`; `loaded` và `delivered`
 * suy từ tiến độ chuyến lúc đọc (kiện đã lên xe / đã dỡ ở điểm giao), không có hàm ghi riêng. Từ FE-0-06 không còn luồng quét nhận
 * hàng: kiện mới đăng ký ở `registered`, `received` chỉ do seed ghi — tới khi có mô hình kho kiện (FE-3b-03).
 */
export const REGISTERED_PACKAGE_STATUSES = ['registered', 'received', 'planned', 'loaded', 'delivered'] as const
export type RegisteredPackageStatus = (typeof REGISTERED_PACKAGE_STATUSES)[number]

/** Một kiện vật lý công ty đăng ký trước khi có chuyến (`RPK-NNNN` — mã in trên nhãn). */
export type RegisteredPackage = {
  id: string
  packageTypeId: string
  /** Công ty sở hữu kiện: công ty của người đăng ký (`User.companyId`). */
  ownerCompanyId: string
  /** Mã trên QR: chuỗi ngẫu nhiên không chứa dữ liệu kiện, tra ngược bằng `findPackageByQr`. */
  qrToken: string
  status: RegisteredPackageStatus
  /** Mã lô / SKU của bên gửi hàng, tuỳ chọn. */
  reference?: string
  note?: string
  registeredAt: string
  registeredBy: string | null
  /** Đơn hàng đang dùng kiện (đơn chưa huỷ). */
  orderId?: string
}

/** Kiện luôn thuộc công ty của người đăng ký, nên đầu vào không có công ty. */
export type RegisteredPackageInput = {
  packageTypeId: string
  reference?: string
  note?: string
}

/** Một dòng đăng ký theo số lượng / nhập file: `quantity` kiện cùng loại. */
export type RegisteredPackageRow = RegisteredPackageInput & { quantity: number }

/** Kho lưu `pending`, `assigned`, `cancelled`; `delivered` suy ra khi chuyến được gán đã hoàn thành. */
export const ORDER_STATUSES = ['pending', 'assigned', 'delivered', 'cancelled'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

/** Gán đơn vào điểm giao: mỗi loại kiện của đơn thành một dòng kiện của chuyến, giữ danh sách kiện đăng ký theo dòng. */
export type OrderAssignment = {
  tripId: string
  stopId: string
  lines: { lineId: string; packageIds: string[] }[]
  at: string
  by: string | null
}

/** Đơn vận chuyển (`ORD-NNN`) từ kiện đã nhận ở kho của công ty. */
export type TransportOrder = {
  id: string
  /** Công ty lập đơn — cũng là công ty của mọi kiện trong đơn (D-64). */
  companyId: string
  customerName: string
  deliveryAddress: string
  contactName?: string
  phone?: string
  packageIds: string[]
  status: OrderStatus
  note?: string
  createdAt: string
  createdBy: string | null
  assignment?: OrderAssignment
  cancellation?: { at: string; by: string | null; reason: string }
}

export type OrderInput = Pick<TransportOrder, 'customerName' | 'deliveryAddress' | 'contactName' | 'phone' | 'packageIds' | 'note'>
export type OrderChanges = Partial<OrderInput>

export const OPTIMIZATION_OBJECTIVES = ['MAX_VOLUME', 'AXLE_BALANCE'] as const
export type OptimizationObjective = (typeof OPTIMIZATION_OBJECTIVES)[number]

export const OPTIMIZATION_ALGORITHMS = ['EP_DBLF', 'GENETIC_ALGORITHM'] as const
export type OptimizationAlgorithm = (typeof OPTIMIZATION_ALGORITHMS)[number]

/** Mục tiêu và thuật toán người dùng chọn cho một lần chạy. Mock tối ưu bỏ qua, kho vẫn lưu để hiện lịch sử. */
export type RunSettings = { objective: OptimizationObjective; algorithm: OptimizationAlgorithm }

/** Mặc định khi nơi gọi không chọn (màn thiết lập cũ). */
export const DEFAULT_RUN_SETTINGS: RunSettings = { objective: 'MAX_VOLUME', algorithm: 'EP_DBLF' }

/** Một lần chạy tối ưu của chuyến (`RUN-NNN`), kể cả lần hỏng không có revision. Thuộc công ty của chuyến `tripId` (D-64). */
export type OptimizationRun = RunSettings & {
  id: string
  tripId: string
  status: 'COMPLETED' | 'FAILED'
  at: string
  by: string | null
  /** Lần chạy xong: revision đã lưu và vài số của kết quả. */
  revisionId?: string
  jobId?: string
  placedCount?: number
  unplacedCount?: number
  volumeUtilizationPercent?: number
  /** Lần chạy hỏng: mã lý do (`REQUEST_REJECTED`, `SERVICE_UNAVAILABLE`), UI dịch. */
  failureCode?: string
}

export const RUN_FAILURE_CODES = ['REQUEST_REJECTED', 'SERVICE_UNAVAILABLE'] as const
export type RunFailureCode = (typeof RUN_FAILURE_CODES)[number]

/** Loại xe (`VT-NNN`, backend có CRUD `/api/vehicle-types`): kích thước lòng thùng và tải trọng danh nghĩa. */
export type VehicleType = {
  id: string
  /** Công ty có loại xe này trong danh mục (D-64). */
  companyId: string
  name: string
  cargoLengthCm: number
  cargoWidthCm: number
  cargoHeightCm: number
  payloadKg: number
  createdAt: string
}

export type VehicleTypeInput = Omit<VehicleType, 'id' | 'companyId' | 'createdAt'>

/** Xe gắn loại xe — lưu ngoài `VehicleConfig` vì type Spec không thêm trường (D-04). */
export type VehicleTypeAssignment = { vehicleId: string; vehicleTypeId: string }

/** Nhãn QR của một kiện trong chuyến: kiện nối từ đơn hàng dùng mã QR của kiện đăng ký, kiện nhập tay dùng mã sinh riêng. */
export type TripLabel = {
  packageInstanceId: string
  /** Dòng kiện của chuyến (`PKG-NNN`). */
  packageId: string
  name: string
  deliveryStop: number
  qrToken: string
  registeredPackageId?: string
}

/** Quét QR xác nhận một kiện (xếp hoặc dỡ). */
export type ScanResult<T> = { trip: T; packageInstanceId: string }
