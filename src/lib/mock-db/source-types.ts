import { PLAN_OBJECTIVES, type FragilityLevel, type OrientationCode, type PlanObjective } from '@/domain/models'
import type { DeadlineStatus } from '@/domain/routing'

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

/**
 * Ba trường ràng buộc của loại kiện theo backend (FE-5b-01, D-79): tải xếp chồng tối đa, có cho xoay kiện không, có dễ vỡ không. Là
 * hình chiếu thô của các trường Spec đã có (`maxTopLoadKg`, `allowedOrientations`, `fragilityLevel`); ánh xạ hai chiều ở
 * `package-type-limits.ts`, kho ghi lại mỗi lần lưu loại kiện.
 */
export type PackageTypeLimits = {
  /** Khối lượng tối đa xếp chồng lên trên, kg; 0 là không cho xếp chồng. */
  maxStackWeightKg: number
  rotationAllowed: boolean
  fragile: boolean
}

/** Loại kiện (`PT-NNN`): cùng trường xếp hàng với `CargoPackage`; kiện gắn loại này lấy hướng đặt, xếp chồng, tải trên của nó. */
export type PackageType = PackageTypeLimits & {
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

/** Đầu vào của kho: các trường Spec; ba trường của backend do kho suy ra (`backendLimitsOf`). */
export type PackageTypeInput = Omit<PackageType, 'id' | 'companyId' | 'createdAt' | keyof PackageTypeLimits>

/** Mục tiêu của một phương án ứng viên (FE-5b-05, D-77): mỗi lần chạy ra đủ ba mục tiêu — `PLAN_OBJECTIVES` của domain. */
export const OPTIMIZATION_OBJECTIVES = PLAN_OBJECTIVES
export type OptimizationObjective = PlanObjective

/**
 * Thuật toán đã chạy của một lần chạy. Hiện chỉ có một: mock xếp kệ chạy dưới tên "EP + DBLF" của hạng Basic cho mọi công ty; thuật
 * toán theo hạng gói (D-77) nối ở FE-8-05. Người dùng không chọn thuật toán.
 */
export const OPTIMIZATION_ALGORITHMS = ['EP_DBLF'] as const
export type OptimizationAlgorithm = (typeof OPTIMIZATION_ALGORITHMS)[number]

/** Thuật toán kho ghi cho lần chạy khi nơi gọi không nói. */
export const DEFAULT_RUN_ALGORITHM: OptimizationAlgorithm = 'EP_DBLF'

/** Mục tiêu và thuật toán của lần chạy đã tạo một revision; nhãn A · B · C suy từ mục tiêu (`PLAN_LABELS`). */
export type RunSettings = { objective: OptimizationObjective; algorithm: OptimizationAlgorithm }

/** Mặc định khi nơi gọi lưu một kết quả lẻ mà không nói mục tiêu (`addRevision`). */
export const DEFAULT_RUN_SETTINGS: RunSettings = { objective: 'MAX_VOLUME', algorithm: DEFAULT_RUN_ALGORITHM }

/** Một phương án ứng viên của lần chạy: revision đã lưu và vài số của kết quả. */
export type RunPlan = {
  objective: OptimizationObjective
  revisionId: string
  jobId: string
  placedCount: number
  unplacedCount: number
  volumeUtilizationPercent: number
}

/**
 * Một lần chạy tối ưu của chuyến (`RUN-NNN`), kể cả lần hỏng không có revision. Thuộc công ty của chuyến `tripId` (D-64). Lần chạy
 * xong mang các phương án ứng viên nó tạo (`plans`, theo thứ tự A · B · C) — ba phương án của một job (FE-5b-05), hoặc một khi kết quả
 * được lưu lẻ bằng `addRevision`.
 */
export type OptimizationRun = {
  id: string
  tripId: string
  algorithm: OptimizationAlgorithm
  status: 'COMPLETED' | 'FAILED'
  at: string
  by: string | null
  /** Lần chạy xong: mã job của service và các phương án đã lưu. */
  jobId?: string
  plans?: RunPlan[]
  /** Lần chạy hỏng: mã lý do (`REQUEST_REJECTED`, `SERVICE_UNAVAILABLE`), UI dịch. */
  failureCode?: string
}

export const RUN_FAILURE_CODES = ['REQUEST_REJECTED', 'SERVICE_UNAVAILABLE'] as const
export type RunFailureCode = (typeof RUN_FAILURE_CODES)[number]

/**
 * Loại xe (`VT-NNN`, backend có CRUD `/api/vehicle-types`): kích thước lòng thùng, tải trọng danh nghĩa và ba giới hạn xếp hàng của
 * backend (FE-5b-01). Xe gắn loại nào thì lấy giới hạn của loại đó (`vehicle-limits.ts`).
 */
export type VehicleType = {
  id: string
  /** Công ty có loại xe này trong danh mục (D-64). */
  companyId: string
  name: string
  cargoLengthCm: number
  cargoWidthCm: number
  cargoHeightCm: number
  payloadKg: number
  /** Giới hạn tải nhóm trục trước, kg (D-78); vắng là loại xe chưa khai — xe dùng `maxLoadKg` của trục đầu. */
  frontAxleLimitKg?: number
  /** Giới hạn tải nhóm trục sau, kg (D-78); vắng là loại xe chưa khai — xe dùng tổng `maxLoadKg` của các trục còn lại. */
  rearAxleLimitKg?: number
  /** Độ lệch trọng tâm hàng tối đa so với giữa thùng, tỷ lệ chiều dài / chiều rộng lòng thùng, trong (0, 0,5] (D-79). */
  maxCogOffsetRatio: number
  createdAt: string
}

/** `maxCogOffsetRatio` vắng thì kho đặt mặc định `DEFAULT_MAX_COG_OFFSET_RATIO`. */
export type VehicleTypeInput = Omit<VehicleType, 'id' | 'companyId' | 'createdAt' | 'maxCogOffsetRatio'> & { maxCogOffsetRatio?: number }

/** Xe gắn loại xe — lưu ngoài `VehicleConfig`; giới hạn của loại được ghép vào xe lúc đọc (`withTypeLimits`). */
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
  /** Mã của bên gửi (`Package.packageCode`): gõ mã này đối chiếu được kiện khi nó duy nhất trong chuyến (FE-6-03, D-83). */
  packageCode: string
}

/** Quét QR xác nhận một kiện (xếp hoặc dỡ). */
export type ScanResult<T> = { trip: T; packageInstanceId: string }

/** Kết quả soạn một kiện (FE-6-02): `alreadyStaged` — kiện đã soạn từ trước, lần này kho không ghi gì. */
export type StagingScanResult<T> = ScanResult<T> & { alreadyStaged: boolean }

/** Giờ đến dự kiến của một điểm giao trong tuyến đã tối ưu. */
export type RouteStopEta = {
  stopId: string
  /** ISO 8601 (UTC). */
  eta: string
  /** Mức hạn (PRD v2 mục 7.3); chỉ có khi điểm có hạn. */
  deadlineStatus?: DeadlineStatus
}

/**
 * Tuyến đã tối ưu của chuyến (FE-4b-09, D-76): thứ tự điểm **là thứ tự `Trip.stops`**, ở đây giữ giờ đến dự kiến và mức hạn của từng
 * điểm theo đúng thứ tự đó. Có `routePlan` thì chuyến là Đã lập kế hoạch. Kho tính lại (`withFreshRoute`) mỗi khi thứ tự điểm, giờ
 * xuất phát, kho đi, toạ độ hay hạn của điểm đổi; thêm hoặc bớt điểm thì kho bỏ hẳn `routePlan` — chuyến về Nháp. Kết quả của mock.
 */
export type TripRoutePlan = {
  stops: RouteStopEta[]
  /** Điểm trễ hạn dự kiến (`MISSED`), theo thứ tự đi. */
  missedStopIds: string[]
  /** Quãng đường ước lượng kho → điểm cuối, km (làm tròn 0,1). */
  totalKm: number
  /** Từ lúc xuất phát tới khi xong điểm cuối, phút (gồm giờ nghỉ bắt buộc của tài xế, FE-BL-04). */
  totalMinutes: number
  /** Số lần nghỉ bắt buộc và tổng thời gian nghỉ (phút, đã nằm trong `totalMinutes`); vắng khi tuyến không phải nghỉ lần nào. */
  restCount?: number
  restMinutes?: number
  /** Lần bấm "Tối ưu tuyến" gần nhất, ISO 8601. */
  optimizedAt: string
  /** Người bấm; `null` khi không có phiên (seed, test). */
  optimizedBy: string | null
  isMockResult: true
}
