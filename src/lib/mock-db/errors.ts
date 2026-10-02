import type { Role } from '@/types/user'
import type { TripPhase } from './types'

/** Bộ sưu tập của kho mock. */
export type MockDbCollection =
  | 'vehicles'
  | 'trips'
  | 'revisions'
  | 'users'
  // LM-104
  | 'companies'
  | 'packageTypes'
  | 'registeredPackages'
  | 'orders'
  | 'vehicleTypes'

/**
 * Tham số theo từng mã lỗi của kho. Kho chỉ trả mã + tham số, không trả câu hiển thị: UI dịch mã theo ngôn ngữ (D-28).
 */
export type MockDbErrorParams = {
  /** Không có bản ghi `id` trong `collection`. */
  NOT_FOUND: { collection: MockDbCollection; id: string }
  /** Xoá xe mà các chuyến `tripIds` còn dùng. */
  VEHICLE_IN_USE: { vehicleId: string; tripIds: string[] }
  /** Sửa hoặc đưa vào bảo dưỡng xe đang chạy chuyến `tripId` (pha `loading`…`delivering`, D-45). */
  VEHICLE_LOCKED: { vehicleId: string; tripId: string }
  /** Gán xe đang bảo dưỡng cho chuyến (D-53). */
  VEHICLE_IN_MAINTENANCE: { vehicleId: string }
  /** Duyệt revision đã lỗi thời: xe hoặc kiện của chuyến đổi sau khi tối ưu (D-31). */
  REVISION_STALE: { revisionId: string }
  /** Duyệt revision có `result.status` khác `COMPLETED`. */
  REVISION_NOT_COMPLETED: { revisionId: string }
  /** Draft chỉnh một kiện không có placement trong revision (mã lạ, hoặc kiện nằm trong `unplacedPackages`). */
  PATCH_UNKNOWN_INSTANCE: { packageInstanceId: string }
  /** Sửa dữ liệu, tối ưu hoặc Duyệt chuyến đã sang pha vận hành (D-45). */
  TRIP_LOCKED: { tripId: string; phase: TripPhase }
  /** Thao tác vận hành không hợp lệ ở pha hiện tại, ví dụ bắt đầu giao khi kho chưa xếp xong. */
  TRIP_PHASE_INVALID: { tripId: string; phase: TripPhase }
  /** Kho bắt đầu xếp khi chuyến chưa có bản duyệt. */
  NO_APPROVED_REVISION: { tripId: string }
  /** Kiện không có trong phương án kho đang làm theo, hoặc không thuộc điểm giao đó. */
  INSTANCE_NOT_IN_PLAN: { tripId: string; packageInstanceId: string }
  /** Kiện đã báo thiếu ở kho nên không có trên xe. */
  INSTANCE_NOT_LOADED: { tripId: string; packageInstanceId: string }
  /** Hoàn tất xếp khi còn kiện chưa có kết quả. */
  LOADING_INCOMPLETE: { tripId: string; remaining: number }
  /** Hoàn tất điểm giao khi còn kiện chưa dỡ và chưa báo sự cố. */
  STOP_INCOMPLETE: { tripId: string; stopNumber: number; remaining: number }
  /** Thao tác trên điểm giao không phải điểm hiện tại (điểm chưa hoàn tất đầu tiên). */
  STOP_NOT_CURRENT: { tripId: string; stopNumber: number }
  /** Huỷ chuyến hoặc báo sự cố không ghi lý do/ghi chú. */
  REASON_REQUIRED: Record<string, never>
  /** Tài xế gán cho chuyến không phải người dùng vai trò tài xế đang hoạt động. */
  DRIVER_INVALID: { userId: string }
  /** Sai email hoặc mật khẩu; một mã cho cả hai để không lộ email nào có thật. */
  INVALID_CREDENTIALS: Record<string, never>
  ACCOUNT_SUSPENDED: Record<string, never>
  /** Thao tác cần phiên đăng nhập. */
  NOT_SIGNED_IN: Record<string, never>
  EMAIL_TAKEN: { email: string }
  /** Tự khoá, tự xoá hoặc tự đổi vai trò của chính mình. */
  SELF_CHANGE_FORBIDDEN: Record<string, never>
  /**
   * Khoá, xoá hoặc hạ vai trò người quản trị đang hoạt động cuối cùng của phạm vi mình (FE-0-08): quản trị hệ thống cuối cùng của nền
   * tảng, hoặc quản trị công ty cuối cùng của một công ty.
   */
  LAST_ADMIN: Record<string, never>
  /**
   * Tạo tài khoản với vai trò `role`, hoặc đổi một tài khoản sang vai trò đó, ngoài phạm vi (D-65, FE-0-08): quản trị hệ thống chỉ tạo
   * tài khoản nền tảng, quản trị công ty chỉ tạo vai trò công ty, và không tài khoản nào đổi giữa hai nhóm vai trò.
   */
  ROLE_OUT_OF_SCOPE: { role: Role }
  /** Phiên nền tảng sửa hoặc xoá nhân sự của một công ty: việc của quản trị công ty đó; nền tảng chỉ khoá, mở khoá, đặt lại mật khẩu. */
  USER_MANAGED_BY_COMPANY: { userId: string }
  /** Xoá tài xế còn được gán cho chuyến chưa kết thúc. */
  USER_IN_USE: { userId: string; tripIds: string[] }
  PASSWORD_INCORRECT: Record<string, never>
  PASSWORD_TOO_SHORT: { min: number }

  // Review 1 (LM-104)
  /** Loại kiện sai dữ liệu: mã issue của model (`package.*`, `D-28`), UI dịch qua nhánh `issues`. */
  PACKAGE_TYPE_INVALID: { codes: string[] }
  /** Xoá loại kiện còn kiện đăng ký dùng. */
  PACKAGE_TYPE_IN_USE: { packageTypeId: string; count: number }
  /** Đăng ký theo số lượng ngoài khoảng cho phép. */
  QUANTITY_INVALID: { min: number; max: number }
  /**
   * Gọi hàm dữ liệu vận hành (xe, loại xe, loại kiện, kiện, đơn, chuyến, phương án, tiến độ, quét) khi phiên không thuộc công ty nào:
   * ba vai trò nền tảng không xem dữ liệu vận hành của công ty (D-64).
   */
  COMPANY_REQUIRED: Record<string, never>
  /** Ghi vào bản ghi `id` của công ty khác, hoặc tham chiếu tới nó (xe, tài xế, loại kiện, kiện… của công ty khác; D-64). */
  FORBIDDEN_COMPANY: { collection: MockDbCollection; id: string }
  /** Kiện không ở trạng thái cần cho thao tác (chưa nhận ở kho, đã có đơn…). */
  PACKAGE_UNAVAILABLE: { packageId: string; status: string }
  /** Lần đăng ký hoặc đơn hàng không có kiện nào. */
  PACKAGES_REQUIRED: Record<string, never>
  /** Mã QR không khớp kiện nào. */
  QR_UNKNOWN: { token: string }
  ORDER_STATUS_INVALID: { orderId: string; status: string }
  /** Điểm giao không có trong chuyến. */
  STOP_NOT_FOUND: { tripId: string; stopId: string }
  VEHICLE_TYPE_INVALID: { field: string }
  VEHICLE_TYPE_IN_USE: { vehicleTypeId: string; vehicleIds: string[] }
  /** Mã QR quét được không thuộc phương án / chuyến đang làm. */
  PACKAGE_NOT_IN_TRIP: { tripId: string; token: string }
  /** Quét đúng kiện của chuyến nhưng không phải kiện của bước hiện tại. */
  WRONG_PACKAGE_SCANNED: { expected: string; scanned: string }
  /** Kiện quét được thuộc điểm giao khác. */
  QR_WRONG_STOP: { packageInstanceId: string; stopNumber: number }
  /** Số seal trống hoặc dài quá. */
  SEAL_INVALID: { max: number }
}

export type MockDbErrorCode = keyof MockDbErrorParams

/** Lỗi nghiệp vụ của kho mock: promise bị từ chối bằng lỗi này, `code` cho UI chọn câu. */
export class MockDbError<Code extends MockDbErrorCode = MockDbErrorCode> extends Error {
  readonly code: Code
  readonly params: MockDbErrorParams[Code]

  constructor(code: Code, params: MockDbErrorParams[Code]) {
    // `message` chỉ cho người phát triển đọc trong log
    super(`${code} ${JSON.stringify(params)}`)
    this.name = 'MockDbError'
    this.code = code
    this.params = params
  }
}

export function isMockDbError(error: unknown): error is MockDbError {
  return error instanceof MockDbError
}
