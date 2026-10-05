import type { PlacementPatch } from '@/domain/constraints'
import type { VehicleConfig } from '@/domain/models'
import type { User, UserStatus } from '@/types/user'
import type { AuditEvent, AuditNames } from './audit'
import type { ExceptionsDb } from './db-api-exceptions'
import type { Review1Db } from './db-api-review1'
import type { TrackingDb } from './db-api-tracking'
import type {
  AuditFilter,
  DeliveryIssue,
  NewOptimizationRun,
  NewRevision,
  NewTrip,
  NewUser,
  ProfileChanges,
  Revision,
  SavedOptimizationRun,
  Trip,
  TripChanges,
  UserChanges,
  VehicleState,
} from './types'

/** Kết quả tạo người dùng hoặc đặt lại mật khẩu: mật khẩu tạm chỉ trả về một lần. */
export type TemporaryPassword = { user: User; temporaryPassword: string }

export type DeliveryIssueInput = Pick<DeliveryIssue, 'stopNumber' | 'kind' | 'note'> & { packageInstanceId?: string }

/** `force`: người duyệt đã xem và xác nhận duyệt dù tuyến có điểm trễ hạn dự kiến (`POST /api/load-plans/{id}/approve`). */
export type ApproveOptions = { force?: boolean }

/**
 * Kho dữ liệu in-memory thay backend (D-06). Mọi hàm bất đồng bộ như gọi mạng thật, trả bản sao, và từ chối bằng
 * `MockDbError` (mã `NOT_FOUND` khi không có bản ghi). Mỗi hàm ghi thêm một sự kiện nhật ký với người làm là phiên hiện tại (D-43).
 *
 * **Lọc theo công ty của phiên** (D-64, `tenancy.ts`), áp cho mọi hàm dưới đây trừ nhóm đăng nhập / hồ sơ của chính mình: phiên của
 * một công ty chỉ liệt kê bản ghi của công ty đó, đọc theo mã bản ghi của công ty khác là `NOT_FOUND`, ghi vào hoặc tham chiếu tới nó
 * là `FORBIDDEN_COMPANY`; phiên nền tảng bị mọi hàm dữ liệu vận hành từ chối `COMPANY_REQUIRED` (người dùng, nhật ký, công ty thì
 * đọc hết); kho không có phiên thì không lọc. Thêm hàm công khai thì khai nó ở `tenancy.test.ts`.
 */
export type MockDb = CoreMockDb & Review1Db & TrackingDb & ExceptionsDb

type CoreMockDb = {
  /** Theo thứ tự tạo: xe seed trước. */
  listVehicles(): Promise<VehicleConfig[]>
  getVehicle(id: string): Promise<VehicleConfig>
  /** Kho cấp mã `VEHICLE-NNN` kế tiếp; `id` trong đầu vào (nếu có) bị bỏ. */
  createVehicle(input: Omit<VehicleConfig, 'id'>): Promise<VehicleConfig>
  /** Thay toàn bộ cấu hình xe theo `vehicle.id`. Xe đang chạy chuyến (`loading`…`delivering`): `VEHICLE_LOCKED`. */
  updateVehicle(vehicle: VehicleConfig): Promise<VehicleConfig>
  /** Còn chuyến dùng xe (kể cả chuyến đã xong): `VEHICLE_IN_USE`. */
  deleteVehicle(id: string): Promise<void>
  /** Trạng thái mọi xe theo thứ tự `listVehicles`. */
  listVehicleStates(): Promise<VehicleState[]>
  /** Bật (`note`) hoặc tắt (`null`) bảo dưỡng. Xe đang chạy chuyến: `VEHICLE_LOCKED`. */
  setVehicleMaintenance(id: string, note: string | null): Promise<VehicleState>

  /** Theo thứ tự tạo: chuyến seed trước. */
  listTrips(): Promise<Trip[]>
  getTrip(id: string): Promise<Trip>
  /**
   * Kho cấp mã `TRIP-NNN` kế tiếp, pha `planning`, `inputVersion` 1. Xe phải tồn tại, không bảo dưỡng; tài xế (nếu có) hợp lệ. Mỗi kiện
   * của các dòng kiện tự thành một kiện kho kiện nguồn `TRIP`, `ASSIGNED`, có mã QR (FE-3b-07).
   */
  createTrip(input: NewTrip): Promise<Trip>
  /**
   * Xe mới (nếu đổi) phải tồn tại, không bảo dưỡng. Pha `loading`/`loaded` chỉ còn sửa tên, ngày, tài xế; pha sau đó không sửa gì
   * (`TRIP_LOCKED`). Đổi dòng kiện hay điểm giao thì kiện kho kiện của chuyến đổi theo: thêm kiện mới, kiện bị bỏ về `IMPORTED` (FE-3b-07).
   */
  updateTrip(id: string, changes: TripChanges): Promise<Trip>
  /**
   * Huỷ chuyến kèm lý do bắt buộc (`REASON_REQUIRED`), ghi nhật ký (FE-6-07, D-91). Từ Nháp, Đã lập kế hoạch, Đang xếp hàng: kiện của
   * chuyến về `IMPORTED`, yêu cầu giao về `PENDING`; huỷ lúc đang xếp thì sự kiện mang số kiện đã lên xe để kho dỡ ra. Từ Đang vận
   * chuyển: chỉ khi chuyến có sự cố cấp chuyến chưa xử lý (FE-6-11) — kiện chưa giao thành `RETURNED` và ở lại chuyến, yêu cầu giao
   * của chúng đọc là giao thiếu, sự kiện mang số kiện hoàn trả. Trạng thái khác (Đang vận chuyển không có sự cố đang mở, Đã giao, Đã
   * huỷ): `INVALID_TRIP_STATUS_TRANSITION`.
   */
  cancelTrip(id: string, reason: string): Promise<Trip>

  /** Revision của chuyến theo thứ tự tạo, cũ trước. */
  listRevisions(tripId: string): Promise<Revision[]>
  getRevision(id: string): Promise<Revision>
  /**
   * Lưu **một** kết quả tối ưu có sẵn thành revision mới, mang `inputVersion` hiện tại của chuyến, kèm một lần chạy một phương án.
   * Chuyến phải ở pha `planning`. Lối ghi kết quả dựng tay; lần chạy của app đi qua `saveOptimizationRun`.
   */
  addRevision(input: NewRevision): Promise<Revision>
  /**
   * Lưu ba phương án ứng viên của một job tối ưu (FE-5b-05, D-77): mỗi phương án một revision bất biến, cùng một lần chạy
   * (`Revision.runId`), theo thứ tự của `plans`; ghi một sự kiện `optimization.saved`. Chỉ khi chuyến **Đã lập kế hoạch** — còn Nháp
   * (chưa tối ưu tuyến): `ROUTE_NOT_PLANNED`; đã sang pha vận hành: `TRIP_LOCKED`. Không lưu gì khi từ chối.
   */
  saveOptimizationRun(input: NewOptimizationRun): Promise<SavedOptimizationRun>
  /**
   * Duyệt (D-31, D-32): tạo revision approved **mới** — áp draft `patches` (bản chỉnh tay của Planner, FE-0-07), tính lại thứ tự
   * xếp/dỡ và metrics — revision nguồn giữ nguyên. Duyệt lại một revision đã duyệt được. Từ chối: `TRIP_LOCKED`, `REVISION_STALE`
   * (chuyến đổi xe/kiện sau khi tối ưu), `REVISION_NOT_COMPLETED`, `PATCH_UNKNOWN_INSTANCE` (patch cho kiện không có placement);
   * không lưu gì khi từ chối. Luật duyệt (FE-5b-08, D-80), kho tự kiểm trên bản sẽ duyệt: còn lỗi ràng buộc, vượt tải trục hoặc kiện
   * bắt buộc chưa xếp là `APPROVAL_BLOCKED`; tuyến của chuyến có điểm trễ hạn dự kiến mà không có `force` là `LATE_STOPS_UNCONFIRMED`.
   * `force` chỉ là lời xác nhận cho điểm trễ hạn — không gỡ được lý do chặn nào.
   */
  approveRevision(revisionId: string, patches: readonly PlacementPatch[], options?: ApproveOptions): Promise<Revision>
  /**
   * Đổi xe của chuyến **Đã lập kế hoạch** (FE-5b-08, D-80). Xe mới phải sẵn sàng (`VEHICLE_IN_MAINTENANCE`, `VEHICLE_BUSY`), khác xe
   * đang dùng (`VEHICLE_UNCHANGED`) và chở được hàng của chuyến theo `vehicleFit` — kích thước, thể tích, tải trọng, trục
   * (`VEHICLE_UNFIT`); cảnh báo loại hàng không chặn. Chuyến còn Nháp: `TRIP_NOT_PLANNED`; đã sang pha vận hành: `TRIP_LOCKED`. Đổi
   * xong mọi phương án của chuyến lỗi thời, tuyến giữ nguyên; ghi `trip.vehicleChanged`.
   */
  changeTripVehicle(tripId: string, vehicleId: string): Promise<Trip>

  /**
   * Kho bắt đầu theo bản duyệt mới nhất (không lỗi thời): `planning` → `loading`, bước Soạn hàng (FE-6-02). Kiện đã `STAGED` từ phiên
   * trước (chuyến từng quay về Đã lập kế hoạch) vẫn tính là đã soạn.
   */
  startLoading(tripId: string): Promise<Trip>
  /**
   * `loading` → `loaded` (FE-6-05): mọi kiện của bản duyệt đã soạn và đã có kết quả xếp (`LOADING_INCOMPLETE`), không còn xác nhận tay
   * chờ duyệt (`MANUAL_CONFIRM_PENDING`). Kiện đã xếp sang `LOADED`.
   */
  completeLoading(tripId: string): Promise<Trip>
  /** Tài xế bấm Xuất phát: `loaded` → `delivering`; kiện sang `IN_TRANSIT`. Chưa xếp xong: `TRIP_PHASE_INVALID`. */
  startDelivery(tripId: string): Promise<Trip>
  /** Tài xế bấm "Đã đến" ở điểm giao hiện tại (FE-6-06, D-84): ghi giờ đến thật; bấm lại thì giữ giờ đầu. Điểm khác: `STOP_NOT_CURRENT`. */
  arriveAtStop(tripId: string, stopNumber: number): Promise<Trip>
  /**
   * Báo sự cố ở điểm giao hiện tại. Sự cố theo kiện cần tài xế đã đến điểm (`STOP_NOT_ARRIVED`); "khách từ chối" làm kiện ở lại xe —
   * dấu đã dỡ của nó bị bỏ, hoàn tất điểm thì kiện thành `RETURNED`.
   */
  reportDeliveryIssue(tripId: string, issue: DeliveryIssueInput): Promise<Trip>
  /**
   * Hoàn tất điểm giao hiện tại: tài xế đã đến (`STOP_NOT_ARRIVED`), mọi kiện đã dỡ hoặc có sự cố (`STOP_INCOMPLETE`), không còn xác
   * nhận tay của điểm chờ duyệt. Kiện đã dỡ sang `DELIVERED`, kiện còn lại của điểm `RETURNED`. Điểm cuối chuyển chuyến sang `completed`.
   */
  completeStop(tripId: string, stopNumber: number): Promise<Trip>

  /** Đăng nhập (D-42): đúng email + mật khẩu và tài khoản đang hoạt động thì đặt phiên của kho. */
  authenticate(email: string, password: string): Promise<User>
  signOut(): Promise<void>
  /** Phiên có sẵn khi mở trang (như cookie): khôi phục không ghi nhật ký. Người dùng không còn hoặc bị khoá thì không có phiên. */
  restoreSession(userId: string | null): User | null
  sessionUser(): User | null
  listUsers(): Promise<User[]>
  getUser(id: string): Promise<User>
  createUser(input: NewUser): Promise<TemporaryPassword>
  updateUser(id: string, changes: UserChanges): Promise<User>
  setUserStatus(id: string, status: UserStatus): Promise<User>
  deleteUser(id: string): Promise<void>
  resetPassword(id: string): Promise<TemporaryPassword>
  /** Người đang đăng nhập đổi mật khẩu của mình. */
  changePassword(currentPassword: string, nextPassword: string): Promise<void>
  /** Người đang đăng nhập sửa họ tên, số điện thoại. */
  updateProfile(changes: ProfileChanges): Promise<User>

  /** Nhật ký, mới nhất trước. Phiên của một công ty chỉ đọc sự kiện của công ty mình; phiên nền tảng đọc hết. */
  listEvents(filter?: AuditFilter): Promise<AuditEvent[]>
  /**
   * Tên của người dùng, chuyến và xe trong phạm vi nhật ký của phiên — để màn nhật ký và chuông đọc người làm, đối tượng của sự kiện.
   * Không đòi quyền dữ liệu vận hành: vai trò nền tảng đọc nhật ký nhưng `listTrips`, `listVehicles` từ chối họ.
   */
  listAuditNames(): Promise<AuditNames>
}
