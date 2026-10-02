import type { FragilityLevel, OrientationCode } from '@/domain/models'

/**
 * Kiểu dữ liệu Review 1 (LM-104): nguồn hàng (loại kiện, công ty), lần chạy tối ưu, loại xe và nhãn QR. Đơn vị cm / kg như
 * mọi dữ liệu của kho (D-03). Lô hàng và luồng nhận hàng giữa hai công ty đã bỏ (FE-0-06, D-63); kiện của kho kiện ở `package-model.ts`.
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
 * loại xe, loại kiện, kiện của kho kiện, yêu cầu giao, chuyến (kèm revision, lần chạy tối ưu) và sự kiện nhật ký.
 */
export type Company = {
  id: string
  name: string
  address: string
  phone: string
  depot: CompanyDepot
}

/** Loại kiện (`PT-NNN`): cùng trường xếp hàng với `CargoPackage`; kiện gắn loại này lấy hướng đặt, xếp chồng, tải trên của nó. */
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

/** Nhãn QR của một kiện trong chuyến: mã QR của kiện kho kiện ứng với instance đó (FE-3b-07). */
export type TripLabel = {
  packageInstanceId: string
  /** Dòng kiện của chuyến (`PKG-NNN`). */
  packageId: string
  name: string
  deliveryStop: number
  qrToken: string
  /** Kiện kho kiện (`PK-NNNN`) của instance này. */
  poolPackageId: string
}

/** Quét QR xác nhận một kiện (xếp hoặc dỡ). */
export type ScanResult<T> = { trip: T; packageInstanceId: string }
