import type { PlacementPatch } from '@/domain/constraints'
import type { VehicleConfig } from '@/domain/models'
import type { User, UserStatus } from '@/types/user'
import type { AuditEvent, AuditNames } from './audit'
import type { Review1Db } from './db-api-review1'
import type {
  AuditFilter,
  DeliveryIssue,
  LoadingOutcome,
  NewRevision,
  NewTrip,
  NewUser,
  ProfileChanges,
  Revision,
  Trip,
  TripChanges,
  UserChanges,
  VehicleState,
} from './types'

/** Kết quả tạo người dùng hoặc đặt lại mật khẩu: mật khẩu tạm chỉ trả về một lần. */
export type TemporaryPassword = { user: User; temporaryPassword: string }

export type LoadingStepInput = { packageInstanceId: string; outcome: LoadingOutcome }

export type DeliveryIssueInput = Pick<DeliveryIssue, 'stopNumber' | 'kind' | 'note'> & { packageInstanceId?: string }

/**
 * Kho dữ liệu in-memory thay backend (D-06). Mọi hàm bất đồng bộ như gọi mạng thật, trả bản sao, và từ chối bằng
 * `MockDbError` (mã `NOT_FOUND` khi không có bản ghi). Mỗi hàm ghi thêm một sự kiện nhật ký với người làm là phiên hiện tại (D-43).
 *
 * **Lọc theo công ty của phiên** (D-64, `tenancy.ts`), áp cho mọi hàm dưới đây trừ nhóm đăng nhập / hồ sơ của chính mình: phiên của
 * một công ty chỉ liệt kê bản ghi của công ty đó, đọc theo mã bản ghi của công ty khác là `NOT_FOUND`, ghi vào hoặc tham chiếu tới nó
 * là `FORBIDDEN_COMPANY`; phiên nền tảng bị mọi hàm dữ liệu vận hành từ chối `COMPANY_REQUIRED` (người dùng, nhật ký, công ty thì
 * đọc hết); kho không có phiên thì không lọc. Thêm hàm công khai thì khai nó ở `tenancy.test.ts`.
 */
export type MockDb = CoreMockDb & Review1Db

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
  /** Kho cấp mã `TRIP-NNN` kế tiếp, pha `planning`, `inputVersion` 1. Xe phải tồn tại, không bảo dưỡng; tài xế (nếu có) hợp lệ. */
  createTrip(input: NewTrip): Promise<Trip>
  /**
   * Xe mới (nếu đổi) phải tồn tại, không bảo dưỡng. Pha `loading`/`loaded` chỉ còn sửa tên, ngày, tài xế; pha sau đó không sửa gì
   * (`TRIP_LOCKED`).
   */
  updateTrip(id: string, changes: TripChanges): Promise<Trip>
  /** Huỷ trước khi giao (`planning`, `loading`, `loaded`); lý do bắt buộc (D-45). */
  cancelTrip(id: string, reason: string): Promise<Trip>

  /** Revision của chuyến theo thứ tự tạo, cũ trước. */
  listRevisions(tripId: string): Promise<Revision[]>
  getRevision(id: string): Promise<Revision>
  /** Lưu một kết quả tối ưu thành revision mới, mang `inputVersion` hiện tại của chuyến. Chuyến phải ở pha `planning`. */
  addRevision(input: NewRevision): Promise<Revision>
  /**
   * Duyệt (D-31, D-32): tạo revision approved **mới** — áp draft `patches` (bản chỉnh tay của Planner, FE-0-07), tính lại thứ tự
   * xếp/dỡ và metrics — revision nguồn giữ nguyên. Duyệt lại một revision đã duyệt được. Từ chối: `TRIP_LOCKED`, `REVISION_STALE`
   * (chuyến đổi xe/kiện sau khi tối ưu), `REVISION_NOT_COMPLETED`, `PATCH_UNKNOWN_INSTANCE` (patch cho kiện không có placement);
   * không lưu gì khi từ chối.
   */
  approveRevision(revisionId: string, patches: readonly PlacementPatch[]): Promise<Revision>

  /** Kho bắt đầu xếp theo bản duyệt mới nhất (không lỗi thời): `planning` → `loading`. */
  startLoading(tripId: string): Promise<Trip>
  /** Ghi một kiện đã xếp hoặc thiếu ở kho; ghi lại thì thay kết quả cũ. */
  recordLoadingStep(tripId: string, step: LoadingStepInput): Promise<Trip>
  /** Mọi kiện của bản duyệt đã có kết quả: `loading` → `loaded`. */
  completeLoading(tripId: string): Promise<Trip>
  /** `loaded` → `delivering`. */
  startDelivery(tripId: string): Promise<Trip>
  /** Đánh dấu (`true`) hoặc bỏ đánh dấu kiện đã dỡ ở điểm chưa hoàn tất. */
  recordUnload(tripId: string, stopNumber: number, packageInstanceId: string, unloaded: boolean): Promise<Trip>
  reportDeliveryIssue(tripId: string, issue: DeliveryIssueInput): Promise<Trip>
  /** Hoàn tất điểm giao hiện tại: mọi kiện đã dỡ hoặc có sự cố. Điểm cuối chuyển chuyến sang `completed`. */
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
