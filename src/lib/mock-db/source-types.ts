import type { FragilityLevel, OptimizationResult, OrientationCode } from '@/domain/models'

/**
 * Kiểu dữ liệu Review 1 (LM-104): nguồn hàng (loại kiện, kiện đăng ký, công ty, lô hàng), đơn hàng, quyết định duyệt, lần chạy tối
 * ưu, loại xe và nhãn QR. Đơn vị cm / kg như mọi dữ liệu của kho (D-03).
 */

export const COMPANY_KINDS = ['manufacturer', 'logistics'] as const
export type CompanyKind = (typeof COMPANY_KINDS)[number]

/** Công ty ngoài: nhà sản xuất (`MFR-NNN`) đăng ký kiện, công ty logistics (`LOG-NNN`) nhận lô hàng. */
export type Company = {
  id: string
  kind: CompanyKind
  name: string
  address: string
  phone: string
}

/** Loại kiện (`PT-NNN`): khuôn để đăng ký kiện, cùng trường xếp hàng với `CargoPackage` (kiện đăng ký theo loại này). */
export type PackageType = {
  id: string
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

export type PackageTypeInput = Omit<PackageType, 'id' | 'createdAt'>

/**
 * Trạng thái kiện đăng ký. Kho lưu tới `planned`; `loaded` và `delivered` suy từ tiến độ chuyến lúc đọc (kiện đã lên xe / đã dỡ ở
 * điểm giao), không có hàm ghi riêng.
 */
export const REGISTERED_PACKAGE_STATUSES = ['registered', 'in_shipment', 'received', 'planned', 'loaded', 'delivered'] as const
export type RegisteredPackageStatus = (typeof REGISTERED_PACKAGE_STATUSES)[number]

/** Một kiện vật lý nhà sản xuất đăng ký trước khi có chuyến (`RPK-NNNN` — mã in trên nhãn). */
export type RegisteredPackage = {
  id: string
  packageTypeId: string
  /** Nhà sản xuất sở hữu kiện. */
  ownerCompanyId: string
  /** Mã trên QR: chuỗi ngẫu nhiên không chứa dữ liệu kiện, tra ngược bằng `findPackageByQr`. */
  qrToken: string
  status: RegisteredPackageStatus
  /** Mã lô / SKU của nhà sản xuất, tuỳ chọn. */
  reference?: string
  note?: string
  registeredAt: string
  registeredBy: string | null
  /** Lô hàng đang chứa kiện (kể cả lô nháp). */
  shipmentId?: string
  received?: { at: string; by: string | null }
  /** Đơn hàng đang dùng kiện (đơn chưa huỷ). */
  orderId?: string
}

export type RegisteredPackageInput = {
  packageTypeId: string
  reference?: string
  note?: string
  /** Chỉ quản trị viên truyền: nhà sản xuất luôn đăng ký cho công ty của mình. */
  ownerCompanyId?: string
}

/** Một dòng đăng ký theo số lượng / nhập file: `quantity` kiện cùng loại. */
export type RegisteredPackageRow = RegisteredPackageInput & { quantity: number }

export const SHIPMENT_STATUSES = ['draft', 'handed_over', 'partially_received', 'received'] as const
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number]

export type ShipmentReceipt = { packageId: string; at: string; by: string | null }

/** Lô hàng (`SHP-NNN`): nhóm kiện đã đăng ký nhà sản xuất giao cho một công ty logistics. */
export type Shipment = {
  id: string
  manufacturerId: string
  logisticsCompanyId: string
  packageIds: string[]
  status: ShipmentStatus
  note?: string
  createdAt: string
  createdBy: string | null
  handedOverAt?: string
  handedOverBy?: string | null
  /** Mỗi kiện đã quét nhận một dòng, theo thứ tự quét. */
  receipts: ShipmentReceipt[]
}

export type ShipmentInput = {
  logisticsCompanyId: string
  packageIds: string[]
  note?: string
  /** Chỉ quản trị viên truyền; nhà sản xuất tạo lô cho công ty của mình. */
  manufacturerId?: string
}

export type ShipmentChanges = Partial<Pick<Shipment, 'logisticsCompanyId' | 'packageIds' | 'note'>>

/** Kết quả quét nhận một kiện. */
export type ReceiptResult = { package: RegisteredPackage; shipment: Shipment }

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

/** Đơn vận chuyển (`ORD-NNN`) từ kiện đã nhận ở kho logistics. */
export type TransportOrder = {
  id: string
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

/** Quyết định của quản lý với một phương án chờ duyệt, ngoài Duyệt (Duyệt tạo revision mới như trước, D-31). */
export const REVIEW_DECISION_KINDS = ['rejected', 'reoptimize_requested', 'change_vehicle_suggested', 'split_trip_suggested'] as const
export type ReviewDecisionKind = (typeof REVIEW_DECISION_KINDS)[number]

export type ReviewDecision = {
  /** `RVW-NNN` */
  id: string
  tripId: string
  revisionId: string
  kind: ReviewDecisionKind
  /** Lý do / ghi chú người duyệt nhập (bắt buộc). */
  reason: string
  /** Chỉ ở đề xuất đổi xe: xe đề xuất, tuỳ chọn. */
  vehicleId?: string
  at: string
  by: string | null
}

export type PlanSuggestion = { kind: 'change_vehicle' | 'split_trip'; note: string; vehicleId?: string }

/** Một phương án đang chờ quản lý duyệt: bản tối ưu mới nhất của chuyến ở pha lập kế hoạch, chưa duyệt, không lỗi thời. */
export type ReviewQueueItem = {
  tripId: string
  tripName: string
  scheduledDate: string
  vehicleId: string
  revisionId: string
  jobId: string
  /** Lúc lưu kết quả tối ưu (ISO 8601) — UI tính tuổi từ đây. */
  submittedAt: string
  /** Người chạy tối ưu, nếu kho biết. */
  submittedBy: string | null
  metrics: OptimizationResult['metrics']
  isMockResult: boolean
  manuallyEdited: boolean
  run?: RunSettings
}

export const OPTIMIZATION_OBJECTIVES = ['MAX_VOLUME', 'AXLE_BALANCE'] as const
export type OptimizationObjective = (typeof OPTIMIZATION_OBJECTIVES)[number]

export const OPTIMIZATION_ALGORITHMS = ['EP_DBLF', 'GENETIC_ALGORITHM'] as const
export type OptimizationAlgorithm = (typeof OPTIMIZATION_ALGORITHMS)[number]

/** Mục tiêu và thuật toán người dùng chọn cho một lần chạy. Mock tối ưu bỏ qua, kho vẫn lưu để hiện lịch sử. */
export type RunSettings = { objective: OptimizationObjective; algorithm: OptimizationAlgorithm }

/** Mặc định khi nơi gọi không chọn (màn thiết lập cũ). */
export const DEFAULT_RUN_SETTINGS: RunSettings = { objective: 'MAX_VOLUME', algorithm: 'EP_DBLF' }

/** Một lần chạy tối ưu của chuyến (`RUN-NNN`), kể cả lần hỏng không có revision. */
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
  name: string
  cargoLengthCm: number
  cargoWidthCm: number
  cargoHeightCm: number
  payloadKg: number
  createdAt: string
}

export type VehicleTypeInput = Omit<VehicleType, 'id' | 'createdAt'>

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
