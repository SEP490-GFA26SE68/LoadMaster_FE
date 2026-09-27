import type { TripReadiness } from '@/domain/constraints'
import type {
  Company,
  OptimizationRun,
  OrderChanges,
  OrderInput,
  PackageType,
  PackageTypeInput,
  PlanSuggestion,
  ReceiptResult,
  RegisteredPackage,
  RegisteredPackageInput,
  RegisteredPackageRow,
  ReviewDecision,
  ReviewQueueItem,
  RunFailureCode,
  RunSettings,
  ScanResult,
  Shipment,
  ShipmentChanges,
  ShipmentInput,
  TransportOrder,
  TripLabel,
  VehicleType,
  VehicleTypeAssignment,
  VehicleTypeInput,
} from './source-types'
import type { Trip } from './types'

/**
 * Phần kho của 5 luồng Review 1 (LM-104). Cùng quy ước với `MockDb`: bất đồng bộ, trả bản sao, từ chối bằng `MockDbError`, mỗi hàm
 * ghi thêm một sự kiện nhật ký. Hàm đọc lọc theo người đang đăng nhập như server sẽ làm (nhà sản xuất chỉ thấy của công ty mình…).
 */
export type Review1Db = {
  /** Mọi công ty, `kind` lọc nhà sản xuất / logistics. */
  listCompanies(kind?: Company['kind']): Promise<Company[]>

  listPackageTypes(): Promise<PackageType[]>
  getPackageType(id: string): Promise<PackageType>
  /** Dữ liệu kiểm bằng `cargoPackageSchema`: sai thì `PACKAGE_TYPE_INVALID` kèm mã issue. */
  createPackageType(input: PackageTypeInput): Promise<PackageType>
  updatePackageType(id: string, input: PackageTypeInput): Promise<PackageType>
  /** Còn kiện đăng ký dùng: `PACKAGE_TYPE_IN_USE`. */
  deletePackageType(id: string): Promise<void>

  /**
   * Kiện đăng ký người đang đăng nhập được thấy: nhà sản xuất — của công ty mình; logistics — kiện trong lô giao cho công ty mình;
   * vai trò khác — tất cả. Trạng thái `loaded` / `delivered` suy từ tiến độ chuyến.
   */
  listRegisteredPackages(): Promise<RegisteredPackage[]>
  getRegisteredPackage(id: string): Promise<RegisteredPackage>
  /** Tra kiện theo mã QR (đã chuẩn hoá); không có thì `QR_UNKNOWN`. */
  findPackageByQr(token: string): Promise<RegisteredPackage>
  registerPackage(input: RegisteredPackageInput): Promise<RegisteredPackage>
  /** `quantity` kiện cùng loại (1…500), một sự kiện nhật ký. */
  registerPackages(input: RegisteredPackageInput, quantity: number): Promise<RegisteredPackage[]>
  /** Nhiều dòng (nhập file): kiểm hết trước, lỗi một dòng thì không ghi gì. */
  registerPackageRows(rows: readonly RegisteredPackageRow[]): Promise<RegisteredPackage[]>

  /** Nhà sản xuất: lô của công ty mình; logistics: lô đã bàn giao cho công ty mình; vai trò khác: tất cả. Mới nhất trước. */
  listShipments(): Promise<Shipment[]>
  getShipment(id: string): Promise<Shipment>
  /** Lô nháp. Kiện phải `registered`, thuộc nhà sản xuất của lô, chưa ở lô khác. */
  createShipment(input: ShipmentInput): Promise<Shipment>
  /** Chỉ lô nháp. */
  updateShipment(id: string, changes: ShipmentChanges): Promise<Shipment>
  /** Chỉ lô nháp; kiện được trả về tự do. */
  deleteShipment(id: string): Promise<void>
  /** Nháp → đã bàn giao; kiện sang `in_shipment`. */
  handOverShipment(id: string): Promise<Shipment>
  /**
   * Logistics quét QR nhận một kiện: kiện phải trong lô đã bàn giao cho **công ty của người quét** (quản trị viên nhận thay được),
   * chưa nhận. Nhận đủ thì lô `received`, chưa đủ `partially_received`.
   */
  receivePackageByQr(token: string): Promise<ReceiptResult>

  /** Mới nhất trước; `delivered` suy từ chuyến đã hoàn thành. */
  listOrders(): Promise<TransportOrder[]>
  getOrder(id: string): Promise<TransportOrder>
  /** Kiện phải `received` và chưa thuộc đơn khác. */
  createOrder(input: OrderInput): Promise<TransportOrder>
  /** Chỉ đơn `pending`. */
  updateOrder(id: string, changes: OrderChanges): Promise<TransportOrder>
  /** Chỉ đơn `pending`; lý do bắt buộc; kiện trả về tự do. */
  cancelOrder(id: string, reason: string): Promise<TransportOrder>
  /**
   * Gán đơn `pending` vào điểm giao `stopId` của chuyến ở pha lập kế hoạch: mỗi loại kiện thành một dòng `CargoPackage` mới (mã
   * `PKG-NNN`, `groupId` = mã đơn) ở điểm đó; chuyến tăng `inputVersion` (revision cũ lỗi thời, D-31); kiện sang `planned`.
   */
  assignOrder(orderId: string, tripId: string, stopId: string): Promise<{ order: TransportOrder; trip: Trip }>
  /** Bỏ gán: gỡ các dòng kiện của đơn khỏi chuyến (chuyến còn lập kế hoạch) và trả đơn về `pending`. */
  unassignOrder(orderId: string): Promise<TransportOrder>

  /** Bản tối ưu chờ quản lý duyệt, cũ nhất trước. */
  listReviewQueue(): Promise<ReviewQueueItem[]>
  /** Quyết định của chuyến (hoặc mọi chuyến), cũ trước. */
  listReviewDecisions(tripId?: string): Promise<ReviewDecision[]>
  rejectRevision(revisionId: string, reason: string): Promise<ReviewDecision>
  requestReoptimization(revisionId: string, reason: string): Promise<ReviewDecision>
  suggestPlanChange(revisionId: string, suggestion: PlanSuggestion): Promise<ReviewDecision>

  /** Lịch sử lần chạy tối ưu của chuyến, cũ trước. */
  listOptimizationRuns(tripId: string): Promise<OptimizationRun[]>
  /** Ghi một lần chạy không ra kết quả (service từ chối hoặc không phản hồi). */
  recordFailedRun(tripId: string, run: RunSettings & { failureCode: RunFailureCode }): Promise<OptimizationRun>

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
  /** Kho quét QR kiện của bước hiện tại (kiện chưa ghi đầu tiên theo thứ tự xếp): ghi "đã xếp". Kiện khác: `QR_WRONG_PACKAGE`. */
  confirmLoadingByQr(tripId: string, token: string): Promise<ScanResult<Trip>>
  /** Ghi số seal khi đã xếp xong (`loaded`), trước khi xe chạy. */
  recordSeal(tripId: string, sealNumber: string): Promise<Trip>
  /** Tài xế quét QR kiện ở điểm giao hiện tại: ghi "đã dỡ". Kiện của điểm khác: `QR_WRONG_STOP`. */
  confirmUnloadByQr(tripId: string, stopNumber: number, token: string): Promise<ScanResult<Trip>>
}
