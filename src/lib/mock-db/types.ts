import type { PlacementPatch } from '@/domain/constraints'
import type { CargoPackage, OptimizationRequest, OptimizationResult } from '@/domain/models'
import type { User } from '@/types/user'
import type { RequirementPriority } from './requirement-model'
import type { CompanyDepot, RunSettings, TripRoutePlan } from './source-types'

/**
 * Điểm giao của chuyến. Vị trí trong `Trip.stops` là số điểm giao: phần tử đầu là điểm 1, khớp `CargoPackage.deliveryStop`.
 *
 * Từ FE-4b-04 (D-73) điểm giao **tự sinh** khi đưa yêu cầu giao vào chuyến (`generated`), hoặc do điều phối viên **thêm tay** cho kiện
 * lẻ (không hạn). Hạn và ưu tiên của điểm do kho ghi theo các yêu cầu có kiện ở điểm đó (`withStopDemands`) — không nhập tay.
 */
export type DeliveryStop = {
  /** Duy nhất trong chuyến. */
  id: string
  name: string
  address: string
  /** Số điện thoại người nhận, dạng hiển thị (`0901 234 567`); tài xế gọi qua `tel:` (D-46). */
  phone?: string
  contactName?: string
  /** Toạ độ WGS84, độ thập phân; vắng cả hai khi chưa có (điểm của seed cũ, yêu cầu chưa chọn toạ độ). */
  lat?: number
  lng?: number
  /** Điểm tự sinh từ yêu cầu giao: hết dòng kiện thì kho tự bỏ. Vắng là điểm thêm tay. */
  generated?: boolean
  /** Hạn sớm nhất của các yêu cầu ở điểm này, ISO 8601; vắng khi điểm không có yêu cầu nào. */
  deadline?: string
  /** Ưu tiên cao nhất của các yêu cầu ở điểm này. */
  priority?: RequirementPriority
}

/**
 * Pha vận hành của chuyến (D-45), do kho lưu. `planning` là mọi thứ trước khi kho bắt đầu xếp — trạng thái hiển thị của pha này
 * suy lúc đọc: Nháp / Đã lập kế hoạch theo tuyến đã tối ưu (`Trip.routePlan`, FE-4b-09), dòng phụ chờ duyệt · đã duyệt · lỗi thời theo
 * revision (`tripStatus`, `tripSubStatus`). Từ `loading` trở đi xe, điểm giao và kiện bị khoá.
 */
export const TRIP_PHASES = ['planning', 'loading', 'loaded', 'delivering', 'completed', 'cancelled'] as const
export type TripPhase = (typeof TRIP_PHASES)[number]

export type LoadingOutcome = 'loaded' | 'missing'

/** Tiến độ xếp ở kho (D-47): làm theo bản đã duyệt mới nhất lúc bắt đầu. */
export type LoadingProgress = {
  revisionId: string
  /** ISO 8601 */
  startedAt: string
  /** Người bấm bắt đầu; `null` khi không có phiên (seed, test). */
  startedBy: string | null
  completedAt?: string
  /** Mỗi kiện một dòng, theo thứ tự ghi. Kiện chưa có dòng là chưa xử lý. */
  steps: { packageInstanceId: string; outcome: LoadingOutcome; at: string; via?: 'qr' }[]
  /** Số seal niêm phong thùng, ghi khi xếp xong (LM-104). */
  seal?: { number: string; at: string; by: string | null }
}

export const DELIVERY_ISSUE_KINDS = ['damaged', 'missing', 'refused', 'other'] as const
export type DeliveryIssueKind = (typeof DELIVERY_ISSUE_KINDS)[number]

export type DeliveryIssue = {
  /** `ISS-NNN`, duy nhất trong chuyến. */
  id: string
  stopNumber: number
  /** Vắng khi sự cố của cả điểm giao, không gắn kiện nào. */
  packageInstanceId?: string
  kind: DeliveryIssueKind
  note: string
  at: string
  reportedBy: string | null
}

export type StopProgress = {
  /** Số điểm giao, khớp vị trí trong `Trip.stops` + 1. */
  number: number
  unloadedIds: string[]
  /** Kiện dỡ được xác nhận bằng quét QR (tập con của `unloadedIds`, LM-104). */
  qrConfirmedIds?: string[]
  completedAt?: string
}

/** Tiến độ giao hàng của tài xế (D-47). */
export type DeliveryProgress = {
  startedAt: string
  startedBy: string | null
  completedAt?: string
  /** Mỗi điểm giao của chuyến một phần tử, theo thứ tự giao. */
  stops: StopProgress[]
  issues: DeliveryIssue[]
}

export type Cancellation = {
  at: string
  by: string | null
  reason: string
  fromPhase: TripPhase
}

export type Trip = {
  id: string
  /** Công ty của chuyến (D-64): xe, tài xế và đơn gán vào chuyến phải cùng công ty; revision và lần chạy tối ưu thuộc công ty này. */
  companyId: string
  name: string
  vehicleId: string
  stops: DeliveryStop[]
  packages: CargoPackage[]
  /** Phiên bản dữ liệu đầu vào tối ưu (xe + kiện) của chuyến; revision mang số lúc tạo để biết lỗi thời (D-31). */
  inputVersion: number
  /** Ngày chạy `YYYY-MM-DD` (D-46) — luôn là ngày của `departureAt` theo giờ Việt Nam; kho giữ hai trường khớp nhau. */
  scheduledDate: string
  /** Giờ xuất phát (ngày + giờ), ISO 8601 (FE-4b-04, D-76). */
  departureAt: string
  /** Kho xuất phát: bản chụp lúc lập chuyến, mặc định kho của công ty (D-76). Điểm đầu của tuyến. */
  depot: CompanyDepot
  /** Người dùng vai trò tài xế; `null` khi chưa gán. */
  driverId: string | null
  phase: TripPhase
  /** Thời điểm tạo, ISO 8601. */
  createdAt: string
  loading?: LoadingProgress
  delivery?: DeliveryProgress
  cancellation?: Cancellation
  /** Tuyến đã tối ưu (FE-4b-09); vắng là chưa tối ưu tuyến, hoặc điểm giao đã thêm / bớt sau lần tối ưu. */
  routePlan?: TripRoutePlan
  /** Lý do điều phối viên cho chở chung kiện khác loại hàng (FE-4b-06, D-74); kho tự gỡ khi chuyến hết kiện khác loại. */
  overrideReason?: string
}

/**
 * Dữ liệu tạo chuyến: kho cấp `id`, `inputVersion`, `phase`, `createdAt`; tiến độ vận hành chỉ do hàm vận hành ghi. `departureAt` vắng
 * thì xe xuất phát `DEFAULT_DEPARTURE_TIME` ngày `scheduledDate`; có thì ngày chạy lấy theo nó. `depot` vắng là kho của công ty.
 */
export type NewTrip = Pick<Trip, 'name' | 'vehicleId' | 'stops' | 'packages' | 'scheduledDate'> & {
  driverId?: string | null
  /** Lý do vượt luật phân tách hàng khi `packages` gồm nhiều loại hàng (D-74). */
  overrideReason?: string
  departureAt?: string
  depot?: CompanyDepot
}

/**
 * Trường sửa được của chuyến; trường vắng giữ nguyên. Trường do kho quản lý (`id`, `inputVersion`, `phase`, tiến độ…) có trong
 * đầu vào cũng bị bỏ. `overrideReason` chỉ có nghĩa khi `packages` đổi làm phát sinh kiện khác loại hàng (D-74) — không phải một trường
 * sửa riêng (ghi lý do cho xung đột đang có: `overrideTripSegregation`).
 */
export type TripChanges = Partial<Pick<Trip, 'name' | 'vehicleId' | 'stops' | 'packages' | 'scheduledDate' | 'driverId' | 'departureAt' | 'depot' | 'overrideReason'>>

/**
 * Một kết quả tối ưu của chuyến, **bất biến** (D-31): kho không có hàm sửa revision. Duyệt tạo revision mới.
 * `request` là ảnh chụp xe + kiện đã gửi tối ưu, không đổi theo dữ liệu chuyến về sau. Thuộc công ty của chuyến `tripId` (D-64).
 */
export type Revision = {
  /** `REV-NNN`, duy nhất trong kho. Khác `jobId`: revision đã duyệt dùng chung `jobId` với revision nguồn. */
  id: string
  jobId: string
  tripId: string
  request: OptimizationRequest
  result: OptimizationResult
  /** `Trip.inputVersion` lúc tạo revision. */
  inputVersion: number
  /** Thời điểm tạo, ISO 8601. */
  createdAt: string
  /** Chỉ ở revision đã duyệt: các patch của draft áp ở lần Duyệt này, theo thứ tự gửi (rỗng nếu lần này không chỉnh). */
  draftPatches?: PlacementPatch[]
  /** Chỉ ở revision đã duyệt, ISO 8601; bằng `createdAt`. */
  approvedAt?: string
  /** Chỉ ở revision đã duyệt: revision được duyệt. */
  sourceRevisionId?: string
  /** Placement có chỉnh tay: lần Duyệt này có patch, hoặc revision nguồn đã chỉnh tay. */
  manuallyEdited: boolean
  /** Thứ tự xếp/dỡ được tính lại ở FE khi Duyệt (D-32); UI gắn nhãn khi `true`. */
  ordersRecomputed: boolean
  /** Mục tiêu và thuật toán của lần chạy tạo revision (LM-104); revision đã duyệt giữ của revision nguồn. */
  run?: RunSettings
  /** Chỉ ở revision đã duyệt: người bấm Duyệt (`null` khi không có phiên — test logic kho). */
  approvedBy?: string | null
}

/**
 * Kết quả tối ưu cần lưu: `request` đã gửi service và `result` nhận về. `jobId` lấy từ `result`. `run` vắng thì kho ghi mục tiêu và
 * thuật toán mặc định (`DEFAULT_RUN_SETTINGS`).
 */
export type NewRevision = Pick<Revision, 'tripId' | 'request' | 'result'> & { run?: RunSettings }

/** Trạng thái xe (D-53): suy từ chuyến đang chạy, riêng bảo dưỡng đặt tay. */
export type VehicleStatus = 'available' | 'in_use' | 'maintenance'

export type VehicleState = {
  vehicleId: string
  status: VehicleStatus
  /** Chuyến đang xếp / đã xếp xong / đang giao dùng xe (khi `in_use`). */
  tripId?: string
  /** Khi `maintenance`: ghi chú và thời điểm bật. */
  maintenance?: { note: string; since: string }
}

/** Dữ liệu tạo người dùng: kho cấp mã, trạng thái hoạt động và mật khẩu tạm. */
export type NewUser = Pick<User, 'fullName' | 'email' | 'phone' | 'role' | 'depot'> & Partial<Pick<User, 'companyId'>>

export type UserChanges = Partial<Pick<User, 'fullName' | 'email' | 'phone' | 'role' | 'depot'>>

export type ProfileChanges = Partial<Pick<User, 'fullName' | 'phone'>>

/** Bộ lọc nhật ký; trường vắng là không lọc. Ngày dạng `YYYY-MM-DD` theo giờ Việt Nam, tính cả hai đầu. */
export type AuditFilter = {
  from?: string
  to?: string
  actorId?: string
  targetId?: string
  /** Công ty của sự kiện (`AuditEvent.companyId`); `null` là sự kiện của nền tảng, không thuộc công ty nào. */
  company?: string | null
}

export type MockDbOptions = {
  /** Độ trễ giả của mỗi lượt đọc/ghi, ms. Test dùng 0. */
  latencyMs?: number
  /**
   * Ngày neo của seed `YYYY-MM-DD` (D-44): ngày chạy, thời điểm revision, tiến độ và nhật ký seed tính tương đối từ ngày này.
   * Mặc định `SEED_ANCHOR_DATE` để test tất định; app truyền ngày hôm nay theo giờ Việt Nam.
   */
  today?: string
  /** Đồng hồ cho dữ liệu ghi mới (thời điểm tạo, sự kiện). Mặc định giờ máy. */
  now?: () => Date
  /** Nguồn ngẫu nhiên [0, 1) cho mã QR của kiện đăng ký mới (LM-104). Mặc định bộ có hạt giống cố định (tất định); app truyền `Math.random`. */
  random?: () => number
}

export type { ApproveOptions, DeliveryIssueInput, LoadingStepInput, MockDb, TemporaryPassword } from './db-api'
