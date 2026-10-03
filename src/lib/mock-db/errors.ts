import type { HandlingClass } from '@/domain/models'
import type { Role } from '@/types/user'
import type { TripExceptionStatus } from './exception-model'
import type { PackageFlag, PackageStatus } from './package-model'
import type { RequirementStoredStatus } from './requirement-model'
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
  | 'packages'
  | 'requirements'
  | 'vehicleTypes'
  // FE-6-11
  | 'exceptions'

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
  /** Chuyến sai dữ liệu ở trường `field`: giờ xuất phát không đọc được, kho xuất phát thiếu tên hoặc toạ độ ngoài khoảng, điểm giao thiếu tên. */
  TRIP_INVALID: { tripId: string; field: string }
  /** Kho bắt đầu xếp khi chuyến chưa có bản duyệt. */
  NO_APPROVED_REVISION: { tripId: string }
  /** Kiện không có trong phương án kho đang làm theo, hoặc không thuộc điểm giao đó. */
  INSTANCE_NOT_IN_PLAN: { tripId: string; packageInstanceId: string }
  /** Kiện hỏng lúc xếp đã bị bỏ lại kho nên không có trên xe. */
  INSTANCE_NOT_LOADED: { tripId: string; packageInstanceId: string }
  /** Hoàn tất xếp khi còn `remaining` kiện chưa soạn hoặc chưa có kết quả xếp. */
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
  /** Xoá loại kiện còn kiện của kho kiện dùng. */
  PACKAGE_TYPE_IN_USE: { packageTypeId: string; count: number }
  /** Số kiện của một lần tạo ngoài khoảng cho phép. */
  QUANTITY_INVALID: { min: number; max: number }
  /**
   * Gọi hàm dữ liệu vận hành (xe, loại xe, loại kiện, kiện, yêu cầu giao, chuyến, phương án, tiến độ, quét) khi phiên không thuộc công ty nào:
   * ba vai trò nền tảng không xem dữ liệu vận hành của công ty (D-64).
   */
  COMPANY_REQUIRED: Record<string, never>
  /** Ghi vào bản ghi `id` của công ty khác, hoặc tham chiếu tới nó (xe, tài xế, loại kiện, kiện… của công ty khác; D-64). */
  FORBIDDEN_COMPANY: { collection: MockDbCollection; id: string }
  /** Kiện không ở trạng thái cần cho thao tác (đã vào chuyến, đã thuộc yêu cầu giao khác…). */
  PACKAGE_UNAVAILABLE: { packageId: string; status: string }
  /** Lần tạo kiện hoặc yêu cầu giao không có kiện nào. */
  PACKAGES_REQUIRED: Record<string, never>
  /** Mã QR không khớp kiện nào. */
  QR_UNKNOWN: { token: string }
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

  // Kho kiện (FE-3b-01)
  /** Kiện sai dữ liệu ở trường `field`: kích thước hoặc khối lượng không dương, loại hàng lạ, thiếu điểm đến. */
  PACKAGE_INVALID: { field: string }
  /** Chuyển trạng thái kiện ngoài bảng `PACKAGE_TRANSITIONS` (D-70). */
  INVALID_PACKAGE_STATUS_TRANSITION: { packageId: string; from: PackageStatus; to: PackageStatus }
  /** Đưa kiện đang có cờ vào yêu cầu giao hay chuyến (D-92). */
  PACKAGE_FLAGGED: { packageId: string; flag: PackageFlag }
  /** Gỡ một cờ kiện không có. */
  PACKAGE_FLAG_NOT_SET: { packageId: string; flag: PackageFlag }
  /** Thao tác chỉ một vai trò khác được làm (gỡ cờ kiện là việc của điều phối viên). */
  ROLE_NOT_ALLOWED: { role: Role }

  // Yêu cầu giao (FE-4b-01)
  /** Yêu cầu giao sai dữ liệu ở trường `field`: thiếu tên điểm đến hoặc địa chỉ, ưu tiên lạ, hạn không đọc được, toạ độ ngoài khoảng. */
  REQUIREMENT_INVALID: { field: string }
  /** Hạn giao không ở tương lai theo đồng hồ của kho. */
  REQUIREMENT_DEADLINE_PAST: { deadline: string }
  /** Xoá, đổi điểm đến / kiện, hoặc đưa vào chuyến một yêu cầu không còn chờ xếp chuyến. */
  REQUIREMENT_NOT_PENDING: { requirementId: string; status: RequirementStoredStatus }
  /** Gỡ khỏi chuyến một yêu cầu chưa vào chuyến hoặc đã đang giao; sửa yêu cầu đã giao xong. */
  REQUIREMENT_STATUS_INVALID: { requirementId: string; status: RequirementStoredStatus }

  // Phân tách hàng và tối ưu tuyến (FE-4b-06, FE-4b-09)
  /**
   * Đưa vào chuyến kiện khác loại hàng đang khoá mà chưa ghi lý do vượt luật (D-74). `packages`: mã của các kiện khác loại (mã của bên
   * gửi với kiện kho kiện, mã dòng kiện với kiện gõ trong chuyến).
   */
  CARGO_SEGREGATION_CONFLICT: { tripId: string; lockedClass: HandlingClass; packages: string[] }
  /** Lý do vượt luật dài quá `max` ký tự. */
  OVERRIDE_REASON_TOO_LONG: { max: number }
  /** Tối ưu tuyến khi chuyến chưa có điểm giao nào. */
  ROUTE_STOPS_REQUIRED: { tripId: string }
  /** Tối ưu tuyến khi còn điểm giao chưa có toạ độ: `stopNumbers` là số của các điểm đó (1-based), `stopIds` là mã. */
  MISSING_STOP_COORDINATES: { tripId: string; stopIds: string[]; stopNumbers: number[] }

  // Luật duyệt và đổi xe (FE-5b-08, D-80)
  /**
   * Duyệt phương án còn lý do chặn: lỗi ràng buộc, vượt tải trục, kiện bắt buộc chưa xếp. `count` là số lý do, `codes` là mã của
   * chúng (không lặp, theo thứ tự gặp).
   */
  APPROVAL_BLOCKED: { revisionId: string; count: number; codes: string[] }
  /** Duyệt khi tuyến của chuyến có điểm trễ hạn dự kiến mà người duyệt chưa xác nhận (`force`). `stopNumbers`: số điểm, 1-based. */
  LATE_STOPS_UNCONFIRMED: { tripId: string; stopIds: string[]; stopNumbers: number[] }
  /** Đổi xe khi chuyến chưa Đã lập kế hoạch (còn Nháp: chưa tối ưu tuyến). */
  TRIP_NOT_PLANNED: { tripId: string }
  /** Chạy tối ưu xếp hàng khi chuyến chưa Đã lập kế hoạch (FE-5b-05): phải tối ưu tuyến trước. */
  ROUTE_NOT_PLANNED: { tripId: string }
  /** Đổi sang chính xe chuyến đang dùng. */
  VEHICLE_UNCHANGED: { vehicleId: string }
  /** Xe đang chạy chuyến `tripId` (đang xếp, đã xếp xong, đang giao) nên chưa sẵn sàng cho chuyến khác. */
  VEHICLE_BUSY: { vehicleId: string; tripId: string }
  /** Xe không chở được hàng của chuyến; `reasons`: mã lỗi của `vehicleFit` (kích thước, thể tích, tải trọng, trục). */
  VEHICLE_UNFIT: { vehicleId: string; reasons: string[] }

  // Đối chiếu kiện ba mức và duyệt xác nhận tay (FE-6-03, FE-6-04, D-83)
  /** Mã của bên gửi vừa gõ trùng `count` kiện của chuyến: không biết là kiện nào, phải gõ mã QR in dưới hình. */
  PACKAGE_CODE_AMBIGUOUS: { tripId: string; code: string; count: number }
  /** Xong xếp hoặc hoàn tất điểm giao khi còn `count` xác nhận tay chờ điều phối viên duyệt. */
  MANUAL_CONFIRM_PENDING: { tripId: string; count: number }
  /** Duyệt hoặc từ chối một xác nhận tay không còn chờ: đã có quyết định, đã bị thay bằng lần đối chiếu khác, hoặc không có. */
  MANUAL_CONFIRM_NOT_PENDING: { tripId: string; confirmationId: string }
  // Soạn hàng, xếp có đối chiếu, tài xế đến điểm, huỷ chuyến (FE-6-02, FE-6-05, FE-6-06, FE-6-07)
  /** Đối chiếu kiện ở bước xếp, hoặc báo kiện hỏng, khi còn `remaining` kiện chưa soạn (D-82). */
  STAGING_INCOMPLETE: { tripId: string; remaining: number }
  /** Báo thiếu một kiện đã soạn. */
  PACKAGE_ALREADY_STAGED: { tripId: string; packageInstanceId: string }
  /** Điều phối viên quyết một kiện không có báo thiếu nào đang chờ. */
  SHORTAGE_NOT_OPEN: { tripId: string; packageInstanceId: string }
  /** Dỡ hàng, báo sự cố theo kiện hoặc hoàn tất điểm giao khi tài xế chưa bấm "Đã đến" ở điểm đó (D-84). */
  STOP_NOT_ARRIVED: { tripId: string; stopNumber: number }
  /** Chuyển trạng thái chuyến không được phép (D-91): huỷ chuyến đang vận chuyển, đã giao hoặc đã huỷ. `from`, `to` là trạng thái của backend. */
  INVALID_TRIP_STATUS_TRANSITION: { tripId: string; from: string; to: string }
  // Vị trí xe (FE-6-08)
  /** Vị trí tài xế gửi sai ở trường `field`: toạ độ ngoài khoảng, tốc độ âm, hướng ngoài 0–359. */
  LOCATION_INVALID: { field: string }

  // Sự cố cấp chuyến và tuyến thay thế (FE-6-11, FE-6-12)
  /** Sự cố sai ở trường `field`: loại lạ, thiếu mô tả, số phút chậm ngoài khoảng; gia hạn: yêu cầu giao không thuộc chuyến, hạn không đọc được. */
  EXCEPTION_INVALID: { field: string }
  /** Thao tác trên sự cố không ở trạng thái cần: chuyển quản lý một sự cố không còn mở, xử lý lại sự cố đã xử lý, gia hạn trên sự cố chưa chuyển lên. */
  EXCEPTION_STATUS_INVALID: { exceptionId: string; status: TripExceptionStatus }
  /** Tìm tuyến khác khi xe chưa có vị trí hoặc không còn điểm nào chưa tới; xác nhận một lựa chọn không có trong lần tìm gần nhất. */
  REROUTE_UNAVAILABLE: { tripId: string }

  // Nhập file vào kho kiện (FE-3b-02) — mã theo backend; lớp `-api.ts` của kho kiện từ chối bằng các mã này
  /** File không phải `.csv` / `.xlsx`, hoặc không đọc được. */
  UNSUPPORTED_FILE_TYPE: Record<string, never>
  /** File không có dòng dữ liệu nào. */
  EMPTY_FILE: Record<string, never>
  FILE_TOO_LARGE: { maxMb: number }
  /** File có `rows` dòng dữ liệu, quá `max`. */
  BATCH_TOO_LARGE: { max: number; rows: number }
  /** Dòng tiêu đề thiếu cột bắt buộc `columns` (tên cột của backend). */
  IMPORT_COLUMNS_MISSING: { columns: string[] }
  /** Xác nhận nhập khi bản xem trước còn `errors` dòng lỗi: không dòng nào được ghi (D-68). */
  PACKAGE_IMPORT_INVALID: { errors: number }
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
