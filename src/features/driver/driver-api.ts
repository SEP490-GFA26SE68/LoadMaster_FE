/**
 * Hàm → endpoint backend (FE-0-09). Nhóm `driver` nối backend (`usesBackend('driver')`, thân hàm ở `driver-backend-api.ts`):
 *   fetchMyTrips          → GET /api/driver/trips?driverId= (mã tài xế đọc ở GET /api/users/me)
 *   fetchDriverStopScreen → GET /api/driver/trips/{id}/current-stop
 *   confirmUnloadByQr     → POST /api/driver/packages/{id}/unload (chỉ gõ mã)
 *   completeStop          → POST /api/driver/stops/{id}/complete
 *   postDriverLocation    → POST /api/driver/location
 *   fetchDriverTripMonitoring → GET /api/trips/{id}/monitoring (tài xế bị 403)
 *   chỉ kho mẫu: setDriverGps (đồng hồ mô phỏng chỉ có ở FE)
 *   chưa có ở BE: fetchDriverTrip (đọc thêm yêu cầu và kiện nhận dọc đường, FE-7-05), reportDeliveryIssue, fetchDriverTripLabels
 *   chưa có ở BE (Q-02, Q-11): startDelivery, arriveAtStop, confirmUnloadManually
 */

import { ApiError } from '@/lib/api-client'
import { usesBackend } from '@/lib/backend-config'
import {
  getMockDb,
  MockDbError,
  type DeliveryIssueInput,
  type DriverLocationInput,
  type LabelVerifyMethod,
  type ManualConfirmInput,
  type MockDb,
  type Package,
  type PickupRequest,
  type Revision,
  type ScanResult,
  type Trip,
  type TripLabel,
  type TripMonitoring,
} from '@/lib/mock-db'
import type { User } from '@/types/user'
import { createDriverBackend, type DriverBackend, type DriverStopScreen } from './driver-backend-api'
import { driverPlan, isVisibleTo, myTrips, type MyTrips } from './my-trips'

export type { DriverStopScreen } from './driver-backend-api'

const ON_BACKEND = usesBackend('driver')

/**
 * Màn tài xế làm được gì với nguồn dữ liệu đang dùng (D-20: không có nút giả). Kho mẫu làm được hết. Backend hiện có: chuyến đang vận
 * chuyển của tài xế, điểm đang giao kèm kiện cần dỡ, dỡ một kiện bằng mã gõ, hoàn tất điểm, gửi vị trí điện thoại. Backend chưa có — màn
 * ẩn phần đó: xuất phát, "Đã đến", quét QR (nhãn in mã QR mà điểm giao không trả), xác nhận tay, sự cố theo kiện và khách từ chối, sự cố
 * trên đường, nhận hàng dọc đường, vị trí hàng 3D (tài xế chưa đọc được phương án), giờ đến dự kiến và hạn giao, thông báo, tổng kết
 * chuyến, chuyến chưa xuất phát hoặc đã giao, vị trí xe mô phỏng.
 */
export type DriverCapabilities = {
  /** Dữ liệu từ backend: màn điểm giao là `BackendDriverStop`, chỉ dựng phần backend làm được. */
  readonly backend: boolean
  /** Bước "Đã đến" trước khi dỡ; không có thì điểm đang giao luôn dỡ được. */
  readonly arrive: boolean
  readonly qrVerify: boolean
  readonly manualConfirm: boolean
  readonly deliveryIssues: boolean
  readonly notifications: boolean
  /** Nhóm "Xếp xong — chờ xuất phát", "Kho đang soạn / xếp", "Đã giao gần đây". */
  readonly upcomingTrips: boolean
  /** GPS tắt thì vị trí xe về mô phỏng, và vị trí chỉ nằm trong trình duyệt này. */
  readonly simulatedPosition: boolean
}

export const DRIVER_CAPABILITIES: DriverCapabilities = {
  backend: ON_BACKEND,
  arrive: !ON_BACKEND,
  qrVerify: !ON_BACKEND,
  manualConfirm: !ON_BACKEND,
  deliveryIssues: !ON_BACKEND,
  notifications: !ON_BACKEND,
  upcomingTrips: !ON_BACKEND,
  simulatedPosition: !ON_BACKEND,
}

let backendSource: DriverBackend | null = null
const backend = (): DriverBackend => (backendSource ??= createDriverBackend())

/** Việc backend chưa có: màn đã ẩn nút, lỡ gọi tới thì từ chối — không bao giờ báo thành công giả hay đọc kho mẫu thay. */
const unsupported = (): Promise<never> => Promise.reject(new ApiError('NOT_SUPPORTED'))

/**
 * Lớp dữ liệu của màn tài xế (LM-061, LM-087): nơi duy nhất trong `features/driver` biết về kho. Nối backend thật chỉ thay thân hàm.
 * Như server, kho biết người đang đăng nhập (phiên, D-42): tài xế chỉ đọc được chuyến gán cho mình (D-46); chuyến của người khác trả
 * `NOT_FOUND` như chuyến không tồn tại. Tiến độ giao ghi vào kho (D-47). Kiện chỉ được ghi "đã dỡ" qua đối chiếu (D-83) — không có hàm
 * đánh dấu tay.
 */

function sessionUser(db: MockDb): User {
  const user = db.sessionUser()
  if (!user) throw new MockDbError('NOT_SIGNED_IN', {})
  return user
}

// GET /api/driver/trips?driverId=
export async function fetchMyTrips(): Promise<MyTrips> {
  if (ON_BACKEND) return backend().fetchMyTrips()
  const db = getMockDb()
  const viewer = sessionUser(db)
  const [trips, vehicles] = await Promise.all([db.listTrips(), db.listVehicles()])
  // Chuyến còn lập kế hoạch và chuyến đã huỷ không hiện ở "Chuyến của tôi" (FE-6-01): không cần đọc revision của chúng
  const visible = trips.filter((trip) => isVisibleTo(trip, viewer) && trip.phase !== 'planning' && trip.phase !== 'cancelled')
  const entries = await Promise.all(visible.map(async (trip) => ({ trip, revisions: await db.listRevisions(trip.id) })))
  return myTrips(entries, new Map(vehicles.map((vehicle) => [vehicle.id, vehicle.name])), viewer)
}

/**
 * Chuyến và phương án tài xế làm theo (bản kho đã xếp, chưa xếp thì bản duyệt mới nhất); `plan` là `null` khi chưa có bản duyệt. Kèm
 * kiện nhận dọc đường đã duyệt (FE-7-05): yêu cầu và kiện kho kiện của chúng — ngoài phương án; chỗ xếp của kiện nhận nằm ở `PickupRequest.layout` (FE-BL-01).
 */
export type DriverTrip = { readonly trip: Trip; readonly plan: Revision | null; readonly pickups: readonly PickupRequest[]; readonly pickupPackages: readonly Package[] }

// chưa có ở BE
export async function fetchDriverTrip(tripId: string): Promise<DriverTrip> {
  if (ON_BACKEND) return unsupported()
  const db = getMockDb()
  const viewer = sessionUser(db)
  const [trip, revisions, pickups, pickupPackages] = await Promise.all([db.getTrip(tripId), db.listRevisions(tripId), db.listPickupRequests(tripId), db.listPickupPackages(tripId)])
  if (!isVisibleTo(trip, viewer)) throw new MockDbError('NOT_FOUND', { collection: 'trips', id: tripId })
  return { trip, plan: driverPlan(trip, revisions) ?? null, pickups, pickupPackages }
}

/**
 * Vị trí xe mới nhất và giờ đến dự kiến tính từ nó của các điểm chưa xong (FE-6-09), khi chuyến Đang vận chuyển; `refreshMs` là lúc nên
 * đọc lại (`null` khi chuyến không còn chạy). Chuyến của tài xế khác trả `NOT_FOUND`.
 */
// GET /api/trips/{id}/monitoring
export async function fetchDriverTripMonitoring(tripId: string): Promise<TripMonitoring> {
  if (ON_BACKEND) return unsupported()
  const db = getMockDb()
  const viewer = sessionUser(db)
  const [trip, monitoring] = await Promise.all([db.getTrip(tripId), db.getTripMonitoring(tripId)])
  if (!isVisibleTo(trip, viewer)) throw new MockDbError('NOT_FOUND', { collection: 'trips', id: tripId })
  return monitoring
}

/** Tài xế bấm Xuất phát: `loaded` → `delivering`, kiện sang `IN_TRANSIT` (D-84). Chỉ khi kho đã xếp xong. */
// chưa có ở BE (Q-11)
export function startDelivery(tripId: string): Promise<Trip> {
  if (ON_BACKEND) return unsupported()
  return getMockDb().startDelivery(tripId)
}

/** Tài xế bấm "Đã đến" ở điểm giao hiện tại: ghi giờ đến thật; từ lúc đó mới dỡ hàng được (FE-6-06). */
// chưa có ở BE (Q-02, Q-11)
export function arriveAtStop(tripId: string, stopNumber: number): Promise<Trip> {
  if (ON_BACKEND) return unsupported()
  return getMockDb().arriveAtStop(tripId, stopNumber)
}

// chưa có ở BE
export function reportDeliveryIssue(tripId: string, issue: DeliveryIssueInput): Promise<Trip> {
  if (ON_BACKEND) return unsupported()
  return getMockDb().reportDeliveryIssue(tripId, issue)
}

/** Hoàn tất điểm giao: kiện đã dỡ thành Đã giao, kiện ở lại xe thành Hoàn trả; điểm cuối chuyển chuyến sang `completed`. */
// POST /api/driver/stops/{id}/complete?driverId=
export async function completeStop(tripId: string, stopNumber: number): Promise<void> {
  if (ON_BACKEND) return backend().completeStop(tripId, stopNumber)
  await getMockDb().completeStop(tripId, stopNumber)
}

/** Màn điểm giao khi dữ liệu từ backend (`DRIVER_CAPABILITIES.backend`): điểm đang giao của chuyến, hoặc vì sao không giao được. */
// GET /api/driver/trips/{id}/current-stop
export function fetchDriverStopScreen(tripId: string): Promise<DriverStopScreen> {
  return backend().fetchStopScreen(tripId)
}

// Review 1 (LM-104): quét QR khi dỡ

/** Nhãn QR các kiện của chuyến (tên kiện cho câu báo sai điểm); chuyến của tài xế khác trả `NOT_FOUND`. */
// chưa có ở BE
export async function fetchDriverTripLabels(tripId: string): Promise<TripLabel[]> {
  if (ON_BACKEND) return unsupported()
  const db = getMockDb()
  const viewer = sessionUser(db)
  if (!isVisibleTo(await db.getTrip(tripId), viewer)) throw new MockDbError('NOT_FOUND', { collection: 'trips', id: tripId })
  return db.listTripLabels(tripId)
}

/** Mã đối chiếu bằng nhãn ở điểm `stopNumber` (FE-6-03): quét (`QR`) hoặc gõ (`CODE` — mã QR in dưới hình, hoặc mã của bên gửi duy nhất trong chuyến). */
export type UnloadVerifyInput = { readonly stopNumber: number; readonly method: LabelVerifyMethod; readonly code: string }

/**
 * Đối chiếu kiện ở điểm giao hiện tại bằng nhãn — mức 1 và 2: ghi "đã dỡ" và cách đối chiếu. Kiện của điểm khác: `QR_WRONG_STOP` (kèm
 * số điểm của kiện); mã của bên gửi trùng nhiều kiện: `PACKAGE_CODE_AMBIGUOUS`. Backend: chỉ mã gõ, khớp mã của một kiện của điểm
 * (`packageOfCode`; `UNLOAD_CODE_UNMATCHED` khi không khớp, `UNLOAD_CODE_AMBIGUOUS` khi mã của bên gửi trùng nhiều kiện, `DUPLICATE_UNLOAD`
 * khi đã dỡ, `WRONG_DELIVERY_STOP` khi backend từ chối điểm).
 */
// POST /api/driver/packages/{id}/unload?driverId=
export function confirmUnloadByQr(tripId: string, { stopNumber, method, code }: UnloadVerifyInput): Promise<UnloadRecorded> {
  if (ON_BACKEND) return backend().unload(tripId, { stopNumber, code })
  return getMockDb().confirmUnloadByQr(tripId, stopNumber, code, method)
}

/** Kiện vừa ghi "đã dỡ": mã instance của kho mẫu, mã kiện của backend. */
export type UnloadRecorded = Pick<ScanResult<Trip>, 'packageInstanceId'>

/** Xác nhận tay một kiện ở điểm giao hiện tại — mức 3 (D-83): ghi "đã dỡ" kèm xác nhận tay chờ điều phối viên duyệt. */
// chưa có ở BE (Q-11)
export function confirmUnloadManually(tripId: string, stopNumber: number, input: ManualConfirmInput): Promise<ScanResult<Trip>> {
  if (ON_BACKEND) return unsupported()
  return getMockDb().confirmUnloadManually(tripId, stopNumber, input)
}

// GPS thật của điện thoại tài xế (FE-6-13)

/** Điện thoại tài xế gửi vị trí GPS thật của chuyến đang chạy; trả giờ máy chủ (hoặc kho mẫu) ghi điểm vị trí. */
// POST /api/driver/location
export function postDriverLocation(tripId: string, location: DriverLocationInput): Promise<{ readonly recordedAt: string }> {
  if (ON_BACKEND) return backend().postLocation(tripId, location)
  return getMockDb().postDriverLocation(tripId, location)
}

/**
 * Tài xế bật / tắt "Dùng GPS thật": kho mẫu cho đồng hồ mô phỏng chạy theo giờ thật khi bật, xe mô phỏng ghi tiếp khi tắt. Backend nhận
 * thẳng điểm GPS, không có đồng hồ mô phỏng — không gọi gì.
 */
// chỉ kho mẫu
export function setDriverGps(tripId: string, enabled: boolean): Promise<boolean> {
  if (ON_BACKEND) return Promise.resolve(enabled)
  return getMockDb().setDriverGps(tripId, enabled)
}
