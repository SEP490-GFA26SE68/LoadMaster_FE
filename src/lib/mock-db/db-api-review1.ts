import type { TripReadiness } from '@/domain/constraints'
import type { Package, PackageChanges, PackageFlag, PackageInput, PackageSource, PackageStatus } from './package-model'
import type { DeliveryRequirement, RequirementChanges, RequirementInput } from './requirement-model'
import type {
  Company,
  OptimizationAlgorithm,
  OptimizationRun,
  PackageType,
  PackageTypeInput,
  RunFailureCode,
  ScanResult,
  StagingScanResult,
  TripLabel,
  VehicleType,
  VehicleTypeAssignment,
  VehicleTypeInput,
} from './source-types'
import type { TripPoolPackage, TripStopTarget } from './db-trip-pool'
import type { TripEta } from './db-trip-route'
import type { ShortageDecision } from './db-staging'
import type { TripSegregation } from './db-trip-segregation'
import type { Trip } from './types'
import type { LabelVerifyMethod, ManualConfirmInput } from './verify-model'

/**
 * Phần kho của các luồng Review 1 (LM-104). Cùng quy ước với `MockDb`: bất đồng bộ, trả bản sao, từ chối bằng `MockDbError`, mỗi hàm
 * ghi thêm một sự kiện nhật ký, và lọc theo công ty của phiên (D-64). Lô hàng và luồng quét nhận giữa nhà sản xuất và công ty
 * logistics đã bỏ (FE-0-06, D-63).
 */
/** Lý do vượt luật "một chuyến một loại hàng" gửi kèm một lần đưa kiện vào chuyến (D-74). */
export type SegregationOverride = { overrideReason?: string }

export type Review1Db = {
  /** Các công ty logistics dùng app. Phiên của một công ty chỉ thấy công ty mình; phiên nền tảng thấy hết. */
  listCompanies(): Promise<Company[]>

  listPackageTypes(): Promise<PackageType[]>
  getPackageType(id: string): Promise<PackageType>
  /** Dữ liệu kiểm bằng `cargoPackageSchema`: sai thì `PACKAGE_TYPE_INVALID` kèm mã issue. */
  createPackageType(input: PackageTypeInput): Promise<PackageType>
  updatePackageType(id: string, input: PackageTypeInput): Promise<PackageType>
  /** Còn kiện của kho kiện dùng: `PACKAGE_TYPE_IN_USE`. */
  deletePackageType(id: string): Promise<void>

  /** Mọi kiện của kho kiện, theo thứ tự tạo. Trạng thái là trạng thái kho đã ghi (FE-3b-01), không suy lúc đọc. */
  listPackages(): Promise<Package[]>
  getPackage(id: string): Promise<Package>
  /** Tra kiện theo mã QR (đã chuẩn hoá); không có, hoặc là kiện của công ty khác, thì `QR_UNKNOWN`. */
  findPackageByQr(token: string): Promise<Package>
  /**
   * Tra kiện theo mã người dùng gõ (FE-3b-06): mã QR (đã chuẩn hoá), mã của bên gửi hoặc mã của kho, không phân biệt hoa thường — khớp
   * đúng cả mã. Mã của bên gửi trùng nhau thì trả mọi kiện khớp, mới nhất trước. Không khớp, hoặc chỉ khớp kiện của công ty khác:
   * `QR_UNKNOWN`.
   */
  lookupPackages(code: string): Promise<Package[]>
  /**
   * Thêm một kiện (`source` `MANUAL`) cho **công ty của người đang đăng nhập** (`User.companyId`): trạng thái `IMPORTED`, không cờ, mã QR
   * cấp ngay; loại kiện (nếu có) phải của công ty đó. Dữ liệu sai: `PACKAGE_INVALID`. Tài khoản nền tảng: `COMPANY_REQUIRED`.
   */
  createPackage(input: PackageInput): Promise<Package>
  /** Nhiều kiện một lần (1…1.000), một sự kiện nhật ký: kiểm hết trước, lỗi một dòng thì không ghi gì. `source` mặc định `MANUAL`. */
  createPackages(rows: readonly PackageInput[], source?: PackageSource): Promise<Package[]>
  /** Sửa kiện còn ở kho kiện (`IMPORTED`); mã QR giữ nguyên. Kiện đã vào chuyến: `PACKAGE_UNAVAILABLE`. */
  updatePackage(id: string, changes: PackageChanges): Promise<Package>
  /**
   * Chuyển trạng thái theo bảng `PACKAGE_TRANSITIONS` (D-70); sai bảng: `INVALID_PACKAGE_STATUS_TRANSITION`. Các mốc của chuyến (đưa
   * yêu cầu giao vào chuyến, bắt đầu xếp, xếp xong, xuất phát, hoàn tất điểm, huỷ) tự chuyển kiện của chuyến qua cùng luật này.
   */
  updatePackageStatus(id: string, status: PackageStatus): Promise<Package>
  /** Gắn cờ cho kiện `IMPORTED` (D-92); kiện ở trạng thái khác: `PACKAGE_UNAVAILABLE`. Đã có cờ đó thì không đổi gì. */
  flagPackage(id: string, flag: PackageFlag): Promise<Package>
  /** Gỡ cờ — chỉ điều phối viên (`ROLE_NOT_ALLOWED`), ghi nhật ký. Kiện không có cờ đó: `PACKAGE_FLAG_NOT_SET`. */
  clearPackageFlag(id: string, flag: PackageFlag): Promise<Package>
  /**
   * Nhân viên kho quét thấy lại kiện đang mang cờ "Không tìm thấy" (D-92): gỡ cờ đó, ghi lịch sử kiện và sự kiện `package.found` — điều
   * phối viên được báo qua chuông. Vai trò khác: `ROLE_NOT_ALLOWED`; mã không khớp kiện nào của công ty: `QR_UNKNOWN`; kiện không mang
   * cờ đó: `PACKAGE_FLAG_NOT_SET`.
   */
  reportPackageFound(token: string): Promise<Package>

  /**
   * Yêu cầu giao của công ty (FE-4b-01), mới nhất trước. `status` là trạng thái kho ghi (`PENDING` / `ASSIGNED` / `IN_TRIP`); "Đã giao"
   * và "Giao thiếu" suy từ kiện bằng `requirementStatus`.
   */
  listDeliveryRequirements(): Promise<DeliveryRequirement[]>
  getDeliveryRequirement(id: string): Promise<DeliveryRequirement>
  /**
   * Tạo yêu cầu `PENDING` (`REQ-NNN`). Kiện phải `IMPORTED`, không cờ (`PACKAGE_FLAGGED`) và chưa thuộc yêu cầu khác
   * (`PACKAGE_UNAVAILABLE`); không kiện nào: `PACKAGES_REQUIRED`. Hạn phải ở tương lai theo đồng hồ của kho
   * (`REQUIREMENT_DEADLINE_PAST`); trường sai: `REQUIREMENT_INVALID`.
   */
  createDeliveryRequirement(input: RequirementInput): Promise<DeliveryRequirement>
  /**
   * Sửa yêu cầu. Còn `PENDING`: mọi trường. Đã vào chuyến: chỉ hạn và ưu tiên, trường khác đổi là `REQUIREMENT_NOT_PENDING`; đổi ưu
   * tiên thì dòng kiện của yêu cầu trong chuyến còn lập kế hoạch đổi theo (phương án lỗi thời); hạn và ưu tiên của điểm giao chứa yêu
   * cầu tính lại (D-73). Đã giao xong:
   * `REQUIREMENT_STATUS_INVALID`. Hạn chỉ kiểm "ở tương lai" khi đổi. Không trường nào đổi thì không ghi gì.
   */
  updateDeliveryRequirement(id: string, changes: RequirementChanges): Promise<DeliveryRequirement>
  /** Xoá yêu cầu còn `PENDING` (khác: `REQUIREMENT_NOT_PENDING`); kiện của nó lại chọn được cho yêu cầu khác. */
  deleteDeliveryRequirement(id: string): Promise<void>
  /**
   * Đưa yêu cầu `PENDING` vào chuyến ở pha lập kế hoạch (FE-4b-04, D-73). **Điểm giao tự sinh**: yêu cầu cùng địa chỉ (đã chuẩn hoá) và
   * cùng toạ độ với một điểm đang có thì vào điểm đó, không thì thêm một điểm mới cuối tuyến (tên là tên điểm đến). Mỗi nhóm kiện giống
   * nhau thành một dòng `CargoPackage` mới (mã `PKG-NNN`, `groupId` = mã yêu cầu, `priority` / `mustLoad` theo ưu tiên của yêu cầu —
   * D-93) ở điểm đó; hạn của điểm = hạn sớm nhất, ưu tiên = cao nhất của các yêu cầu ở điểm; chuyến tăng `inputVersion` (revision cũ
   * lỗi thời, D-31); yêu cầu và kiện sang `ASSIGNED`. Yêu cầu có kiện đang mang cờ: `PACKAGE_FLAGGED`. Kiện khác loại hàng đang khoá của
   * chuyến mà chưa có lý do vượt luật: `CARGO_SEGREGATION_CONFLICT` — gọi lại kèm `overrideReason` để vượt (D-74).
   */
  assignDeliveryRequirement(requirementId: string, tripId: string, options?: SegregationOverride): Promise<{ requirement: DeliveryRequirement; trip: Trip }>
  /**
   * Gỡ yêu cầu `ASSIGNED` khỏi chuyến còn lập kế hoạch (D-91): gỡ các dòng kiện của nó, yêu cầu về `PENDING`, kiện về `IMPORTED`; điểm
   * giao tự sinh không còn dòng kiện nào tự mất (kiện ở các điểm sau đánh số lại), hạn và ưu tiên của các điểm còn lại tính lại.
   * Chuyến đã sang vận hành: `TRIP_LOCKED`; yêu cầu chưa vào chuyến hoặc đang giao: `REQUIREMENT_STATUS_INVALID`.
   */
  unassignDeliveryRequirement(requirementId: string): Promise<DeliveryRequirement>

  /**
   * Kiện kho kiện đang ở trong chuyến, theo thứ tự dòng kiện: kèm dòng, điểm giao và đường kiện vào chuyến (qua yêu cầu giao, đưa
   * thẳng từ kho kiện, thêm ngay trong chuyến).
   */
  listTripPackages(tripId: string): Promise<TripPoolPackage[]>
  /**
   * Đưa kiện kho kiện **thẳng** vào chuyến ở pha lập kế hoạch (FE-4b-05, D-68 đường 2), vào điểm giao `target`: một điểm đang có của
   * chuyến (`STOP_NOT_FOUND` nếu không có), hoặc một điểm tay mới cuối tuyến (thiếu tên, toạ độ sai: `TRIP_INVALID`). Kiện phải
   * `IMPORTED`, không cờ (`PACKAGE_FLAGGED`), không thuộc yêu cầu giao nào (`PACKAGE_UNAVAILABLE`); không kiện nào: `PACKAGES_REQUIRED`.
   * Mỗi nhóm kiện giống nhau thành một dòng `CargoPackage` mới ở điểm đó, không có hạn; kiện sang `ASSIGNED`, giữ mã và dữ liệu của
   * chính nó; chuyến tăng `inputVersion` (revision cũ lỗi thời, D-31). Chuyến đã sang vận hành: `TRIP_LOCKED`. Kiện khác loại hàng đang
   * khoá mà chưa có lý do vượt luật: `CARGO_SEGREGATION_CONFLICT` — gọi lại kèm `overrideReason` để vượt (D-74).
   */
  addTripPackages(tripId: string, packageIds: readonly string[], target: TripStopTarget, options?: SegregationOverride): Promise<Trip>
  /**
   * Bỏ một kiện kho kiện khỏi chuyến ở pha lập kế hoạch: kiện về `IMPORTED`, dòng kiện của nó bớt một (hết kiện thì bỏ dòng), chuyến
   * tăng `inputVersion`. Kiện của yêu cầu giao (rời chuyến bằng `unassignDeliveryRequirement`) hoặc kiện không ở chuyến này:
   * `PACKAGE_UNAVAILABLE`.
   */
  removeTripPackage(tripId: string, packageId: string): Promise<Trip>
  /**
   * Phân nhóm hàng của chuyến (FE-4b-06, D-74): loại hàng đang khoá (loại của kiện đầu tiên), nhóm theo loại, dòng kiện khác loại, cảnh
   * báo về xe, và lý do vượt luật đã ghi.
   */
  getTripSegregation(tripId: string): Promise<TripSegregation>
  /**
   * Ghi lý do vượt luật cho chuyến còn lập kế hoạch đang có kiện khác loại (lý do bắt buộc: `REASON_REQUIRED`; quá 500 ký tự:
   * `OVERRIDE_REASON_TOO_LONG`), ghi nhật ký. Chuyến không có kiện khác loại thì không ghi gì. Chuyến đã sang vận hành: `TRIP_LOCKED`.
   */
  overrideTripSegregation(tripId: string, reason: string): Promise<Trip>
  /**
   * Tối ưu tuyến của chuyến còn lập kế hoạch (FE-4b-09, D-76; mock, không tốn credit): xếp lại điểm giao theo thứ tự đi, đánh số lại
   * dòng kiện, ghi `routePlan` (giờ đến dự kiến, mức hạn) — chuyến thành Đã lập kế hoạch. Chưa có điểm giao: `ROUTE_STOPS_REQUIRED`;
   * còn điểm chưa có toạ độ: `MISSING_STOP_COORDINATES`; chuyến đã sang vận hành: `TRIP_LOCKED`.
   */
  optimizeTripRoute(tripId: string): Promise<Trip>
  /** Giờ đến dự kiến, hạn và mức hạn từng điểm của tuyến đã tối ưu; `null` khi chuyến chưa tối ưu tuyến. */
  getTripEta(tripId: string): Promise<TripEta | null>
  /** Lịch sử lần chạy tối ưu của chuyến, cũ trước. */
  listOptimizationRuns(tripId: string): Promise<OptimizationRun[]>
  /** Ghi một lần chạy không ra kết quả (service từ chối hoặc không phản hồi). */
  recordFailedRun(tripId: string, run: { failureCode: RunFailureCode; algorithm?: OptimizationAlgorithm }): Promise<OptimizationRun>

  listVehicleTypes(): Promise<VehicleType[]>
  getVehicleType(id: string): Promise<VehicleType>
  createVehicleType(input: VehicleTypeInput): Promise<VehicleType>
  updateVehicleType(id: string, input: VehicleTypeInput): Promise<VehicleType>
  /** Còn xe gắn loại này: `VEHICLE_TYPE_IN_USE`. */
  deleteVehicleType(id: string): Promise<void>
  listVehicleTypeAssignments(): Promise<VehicleTypeAssignment[]>
  /** Gắn (`vehicleTypeId`) hoặc bỏ (`null`) loại xe của một xe. */
  setVehicleType(vehicleId: string, vehicleTypeId: string | null): Promise<VehicleTypeAssignment | null>

  /** Nhãn QR của mọi kiện trong chuyến (in nhãn, chọn tay khi không quét được). */
  listTripLabels(tripId: string): Promise<TripLabel[]>
  /** Kiểm tra "Sẵn sàng tối ưu" của chuyến (luồng 2). */
  getTripReadiness(tripId: string): Promise<TripReadiness>
  /**
   * Kho soạn một kiện của chuyến đang xếp vào khu chờ bằng nhãn, không cần thứ tự (FE-6-02, D-82): kiện sang `STAGED`, ghi một lần đối
   * chiếu; `method` như `confirmLoadingByQr`. Kiện đã soạn: không ghi gì, trả `alreadyStaged`. Mã không thuộc chuyến:
   * `PACKAGE_NOT_IN_TRIP`. Kiện đang bị báo thiếu được thấy lại thì báo thiếu của nó tự đóng.
   */
  confirmStagingByQr(tripId: string, code: string, method?: LabelVerifyMethod): Promise<StagingScanResult<Trip>>
  /**
   * Soạn một kiện bằng xác nhận tay (mức 3) khi nhãn không đọc được: ghi "đã soạn" để kho làm tiếp, kèm một xác nhận tay chờ điều phối
   * viên duyệt — kiện chỉ sang `STAGED` khi được duyệt. Kiện đã soạn: `PACKAGE_ALREADY_STAGED`.
   */
  confirmStagingManually(tripId: string, input: ManualConfirmInput): Promise<ScanResult<Trip>>
  /**
   * Kho báo một kiện chưa soạn là không tìm thấy (D-82): chuyến mang dòng phụ "Thiếu kiện — chờ điều phối", điều phối viên được báo.
   * Báo lại kiện đang báo thiếu thì không ghi thêm. Kiện đã soạn: `PACKAGE_ALREADY_STAGED`.
   */
  reportStagingShortage(tripId: string, packageInstanceId: string): Promise<Trip>
  /**
   * Điều phối viên quyết một kiện đang bị báo thiếu (vai trò khác: `ROLE_NOT_ALLOWED`; không có báo thiếu đang chờ: `SHORTAGE_NOT_OPEN`).
   * `KEEP_SEARCHING`: đóng báo thiếu, kho tìm tiếp. `DROP`: bỏ kiện khỏi chuyến — kiện về `IMPORTED` kèm cờ `NOT_FOUND` (yêu cầu giao
   * của nó đọc ra "giao thiếu"), chuyến về Đã lập kế hoạch với phương án lỗi thời; kiện đã soạn giữ `STAGED`.
   */
  resolveStagingShortage(tripId: string, packageInstanceId: string, decision: ShortageDecision): Promise<Trip>
  /**
   * Kho báo kiện của bước xếp hiện tại bị hỏng (FE-6-05, D-92): kiện về `IMPORTED` kèm cờ `DAMAGED`. Trong phương án không kiện nào tựa
   * lên nó thì kho xếp tiếp, kiện không lên xe; có kiện tựa lên thì chuyến về Đã lập kế hoạch với phương án lỗi thời — kho dỡ ra, xếp
   * lại theo phương án mới. Chưa soạn đủ: `STAGING_INCOMPLETE`; không phải kiện của bước hiện tại: `WRONG_PACKAGE_SCANNED`.
   */
  reportDamagedPackage(tripId: string, packageInstanceId: string): Promise<Trip>
  /**
   * Kho đối chiếu kiện của bước hiện tại (kiện chưa ghi đầu tiên theo thứ tự xếp) bằng nhãn: ghi "đã xếp" và một lần đối chiếu (cách,
   * người, thời điểm — FE-6-03). `method` `QR` (mặc định) là quét, chỉ khớp mã QR; `CODE` là gõ mã — mã QR in dưới hình, hoặc mã của
   * bên gửi khi mã đó duy nhất trong chuyến (trùng: `PACKAGE_CODE_AMBIGUOUS`). Kiện khác của chuyến (sai kiện, sai thứ tự):
   * `WRONG_PACKAGE_SCANNED`; mã không thuộc chuyến: `PACKAGE_NOT_IN_TRIP`; chưa soạn đủ: `STAGING_INCOMPLETE`.
   */
  confirmLoadingByQr(tripId: string, code: string, method?: LabelVerifyMethod): Promise<ScanResult<Trip>>
  /** Ghi số seal khi đã xếp xong (`loaded`), trước khi xe chạy. */
  recordSeal(tripId: string, sealNumber: string): Promise<Trip>
  /**
   * Tài xế đối chiếu kiện ở điểm giao hiện tại bằng nhãn (`method` như `confirmLoadingByQr`): ghi "đã dỡ". Chưa bấm "Đã đến":
   * `STOP_NOT_ARRIVED`; kiện của điểm khác: `QR_WRONG_STOP`.
   */
  confirmUnloadByQr(tripId: string, stopNumber: number, code: string, method?: LabelVerifyMethod): Promise<ScanResult<Trip>>
  /**
   * Xác nhận tay kiện của bước xếp hiện tại (mức 3, D-83) khi nhãn không đọc được: ghi "đã xếp" để kho làm tiếp, kèm một xác nhận tay
   * `MANUAL_PENDING` chờ điều phối viên duyệt — còn chờ thì `completeLoading` từ chối `MANUAL_CONFIRM_PENDING`. Lý do "Khác" không có
   * ghi chú: `REASON_REQUIRED`; kiện không phải của bước hiện tại: `WRONG_PACKAGE_SCANNED`.
   */
  confirmLoadingManually(tripId: string, input: ManualConfirmInput): Promise<ScanResult<Trip>>
  /** Xác nhận tay một kiện ở điểm giao hiện tại: ghi "đã dỡ" kèm xác nhận tay chờ duyệt — còn chờ thì `completeStop` của điểm đó từ chối. */
  confirmUnloadManually(tripId: string, stopNumber: number, input: ManualConfirmInput): Promise<ScanResult<Trip>>
  /**
   * Điều phối viên duyệt một xác nhận tay còn chờ (FE-6-04): kiện giữ kết quả như đã đối chiếu. Vai trò khác: `ROLE_NOT_ALLOWED`; xác
   * nhận không còn chờ: `MANUAL_CONFIRM_NOT_PENDING`.
   */
  approveManualConfirmation(tripId: string, confirmationId: string): Promise<Trip>
  /**
   * Điều phối viên từ chối một xác nhận tay còn chờ, lý do bắt buộc (`REASON_REQUIRED`): kết quả xếp / dỡ của kiện bị gỡ để kho hoặc
   * tài xế kiểm lại; người gửi được báo qua chuông.
   */
  rejectManualConfirmation(tripId: string, confirmationId: string, reason: string): Promise<Trip>
}
