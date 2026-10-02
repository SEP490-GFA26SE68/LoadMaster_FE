/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm.
 *   createTrip                  → POST /api/trips
 *   updateTripFrame             → chưa có ở BE; riêng đổi xe: POST /api/trips/{id}/change-vehicle
 *   savePackage, importPackages → POST /api/trips/{id}/packages (sửa kiện đang có: chưa có ở BE); tên sẽ đổi khi nối BE: addTripPackages
 *   deletePackage               → DELETE /api/trips/{id}/packages/{packageId}
 *   chưa có ở BE: fetchTrips, fetchTripFormOptions, fetchTripDetail, fetchTripActivity, cancelTrip, fetchPackages,
 *   duplicateTripPackage, fetchTripRevisions
 * Điểm giao của chuyến (đổi thứ tự, thêm điểm tay, xoá): `trip-stops-api.ts`.
 */

import type { CargoPackage, VehicleConfig } from '@/domain/models'
import {
  getMockDb,
  isMockDbError,
  latestApproved,
  tripStatus,
  tripSubStatus,
  vnDate,
  type AuditEvent,
  type CompanyDepot,
  type Revision,
  type Trip,
  type VehicleStatus,
} from '@/lib/mock-db'
import type { TripStatus, TripSubStatus } from '@/types/trip'
import type { User } from '@/types/user'
import { tripRow, type TripRow } from './trip-list'
import { duplicatePackage, stopFields, type TripStopInput } from './trip-packages'

/**
 * Lớp gọi API cho chuyến hàng và kiện (LM-043, LM-088). Chi tiết chuyến, điểm giao và kiện đọc/ghi qua mock repository
 * (`@/lib/mock-db`, D-06); nối backend thật chỉ thay thân hàm, hook và component giữ nguyên.
 */

/** Danh sách chuyến (LM-088): mỗi dòng dựng từ chuyến, xe, tài xế và revision trong kho. */
// chưa có ở BE
export async function fetchTrips(): Promise<TripRow[]> {
  const db = getMockDb()
  const [trips, vehicles, users] = await Promise.all([db.listTrips(), db.listVehicles(), db.listUsers()])
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]))
  const userById = new Map(users.map((user) => [user.id, user]))
  const revisions = await Promise.all(trips.map((trip) => db.listRevisions(trip.id)))
  return trips.map((trip, index) => tripRow(
    trip,
    vehicleById.get(trip.vehicleId),
    revisions[index] ?? [],
    trip.driverId === null ? undefined : userById.get(trip.driverId),
  ))
}

export type TripFrame = {
  readonly name: string
  readonly vehicleId: string
  /** Giờ xuất phát, ISO 8601; ngày chạy của chuyến là ngày của nó theo giờ Việt Nam. */
  readonly departureAt: string
  /** Kho xuất phát; vắng thì kho của công ty. */
  readonly depot?: CompanyDepot
  readonly driverId?: string | null
}

/**
 * Tạo chuyến (FE-4b-04): kho cấp mã chuyến. Chuyến mới chưa có điểm giao và kiện — điểm giao tự sinh khi đưa yêu cầu giao vào chuyến,
 * hoặc thêm tay ở Chi tiết chuyến (D-73).
 */
// POST /api/trips
export async function createTrip({ name, vehicleId, departureAt, depot, driverId = null }: TripFrame): Promise<Trip> {
  return getMockDb().createTrip({ name, vehicleId, packages: [], stops: [], driverId, departureAt, depot, scheduledDate: vnDate(new Date(departureAt)) })
}

export type TripFrameChanges = {
  readonly name: string
  readonly departureAt: string
  readonly driverId: string | null
  /** Vắng khi chuyến đã khoá xe (kho đã bắt đầu xếp, D-45). */
  readonly vehicleId?: string
  /** Vắng khi chuyến đã khoá. */
  readonly depot?: CompanyDepot
  /** Sửa chữ của điểm giao hiện có theo thứ tự; mã và thứ tự giữ nguyên. Vắng khi chuyến đã khoá. */
  readonly stops?: readonly TripStopInput[]
}

/**
 * Sửa khung chuyến: tên, giờ xuất phát, tài xế, xe, kho xuất phát và chữ của điểm giao (toạ độ, hạn, ưu tiên và nguồn của điểm giữ
 * nguyên). Đổi xe làm revision cũ lỗi thời (D-31).
 */
// chưa có ở BE; riêng đổi xe: POST /api/trips/{id}/change-vehicle
export async function updateTripFrame(tripId: string, changes: TripFrameChanges): Promise<Trip> {
  const db = getMockDb()
  const { stops: edited, ...frame } = changes
  const current = edited ? await db.getTrip(tripId) : undefined
  const stops = current && edited
    ? current.stops.map((stop, index) => {
      const { phone: _phone, contactName: _contactName, ...kept } = stop
      return { ...kept, ...stopFields(edited[index] ?? stop) }
    })
    : undefined
  return db.updateTrip(tripId, { ...frame, ...(stops ? { stops } : {}) })
}

export type VehicleOption = { readonly vehicle: VehicleConfig; readonly status: VehicleStatus }

/**
 * Xe và tài xế chọn được ở form chuyến (D-46, D-53): xe kèm trạng thái để khoá xe bảo dưỡng; mọi người dùng vai trò tài xế. `depot`:
 * kho của công ty của người đang đăng nhập — kho xuất phát mặc định của chuyến mới (D-76).
 */
export type TripFormOptions = { readonly vehicles: readonly VehicleOption[]; readonly drivers: readonly User[]; readonly depot: CompanyDepot | null }

// chưa có ở BE
export async function fetchTripFormOptions(): Promise<TripFormOptions> {
  const db = getMockDb()
  const [vehicles, states, users, companies] = await Promise.all([db.listVehicles(), db.listVehicleStates(), db.listUsers(), db.listCompanies()])
  const statusById = new Map(states.map((state) => [state.vehicleId, state.status]))
  // Phiên của một công ty chỉ thấy công ty mình; kho chưa có phiên (test) thì lấy công ty đầu tiên, như công ty mặc định của kho
  const company = companies.find((item) => item.id === db.sessionUser()?.companyId) ?? companies[0]
  return {
    vehicles: vehicles.map((vehicle) => ({ vehicle, status: statusById.get(vehicle.id) ?? 'available' })),
    drivers: users.filter((user) => user.role === 'driver'),
    depot: company?.depot ?? null,
  }
}

export type TripDetail = {
  readonly trip: Trip
  readonly vehicle: VehicleConfig
  /** `null` khi chưa gán, hoặc tài khoản đã bị xoá khỏi kho. */
  readonly driver: User | null
  readonly status: TripStatus
  /** Dòng phụ dưới chip: tiến độ kho hoặc phương án lỗi thời (LM-104). */
  readonly sub: TripSubStatus | null
  /** Revision Planner mở mặc định (bản đã duyệt mới nhất, không có thì bản mới nhất); `null` khi chưa tối ưu. */
  readonly plan: { readonly jobId: string; readonly revisionId: string } | null
}

/** Chuyến kèm xe, tài xế và trạng thái hiển thị — màn chi tiết, form sửa và màn thiết lập tối ưu cùng cần. */
// chưa có ở BE
export async function fetchTripDetail(tripId: string): Promise<TripDetail> {
  const db = getMockDb()
  const trip = await db.getTrip(tripId)
  const [vehicle, revisions, driver] = await Promise.all([
    db.getVehicle(trip.vehicleId),
    db.listRevisions(tripId),
    trip.driverId === null ? null : db.getUser(trip.driverId).catch(notFoundAsNull),
  ])
  const shown = latestApproved(revisions) ?? revisions.at(-1)
  return {
    trip, vehicle, driver,
    status: tripStatus(trip, revisions),
    sub: tripSubStatus(trip, revisions),
    plan: shown ? { jobId: shown.jobId, revisionId: shown.id } : null,
  }
}

function notFoundAsNull(error: unknown): null {
  if (isMockDbError(error) && error.code === 'NOT_FOUND') return null
  throw error
}

export type TripActivity = {
  readonly revisions: readonly Revision[]
  /** Nhật ký của chuyến, mới nhất trước. */
  readonly events: readonly AuditEvent[]
  /** Người dùng để đổi mã người làm thành tên. */
  readonly users: readonly User[]
}

/** Revision, nhật ký và người dùng cho thẻ Tiến trình (LM-088). */
// chưa có ở BE
export async function fetchTripActivity(tripId: string): Promise<TripActivity> {
  const db = getMockDb()
  const [revisions, events, users] = await Promise.all([db.listRevisions(tripId), db.listEvents({ targetId: tripId }), db.listUsers()])
  // `targetId` của kho khớp theo chuỗi con: giữ đúng sự kiện của chuyến này
  return { revisions, events: events.filter((event) => event.target.type === 'trip' && event.target.id === tripId), users }
}

/** Huỷ chuyến trước khi giao (D-45): kho bắt buộc lý do và ghi nhật ký. */
// chưa có ở BE
export async function cancelTrip(tripId: string, reason: string): Promise<Trip> {
  return getMockDb().cancelTrip(tripId, reason)
}

// chưa có ở BE
export async function fetchPackages(tripId: string): Promise<CargoPackage[]> {
  return (await getMockDb().getTrip(tripId)).packages
}

/** Thêm kiện mới hoặc thay kiện cùng mã; kiện đổi thì `inputVersion` tăng và revision cũ thành lỗi thời (D-31). */
// POST /api/trips/{id}/packages (sửa kiện đang có: chưa có ở BE)
export async function savePackage(tripId: string, pkg: CargoPackage): Promise<Trip> {
  const db = getMockDb()
  const { packages } = await db.getTrip(tripId)
  const index = packages.findIndex((item) => item.id === pkg.id)
  const next = index === -1 ? [...packages, pkg] : packages.with(index, pkg)
  return db.updateTrip(tripId, { packages: next })
}

/**
 * Nhập kiện từ file (LM-093, D-49): thêm sau các kiện đang có trong **một** lần ghi — `inputVersion` tăng một lần, kho ghi một sự kiện
 * nhật ký. Dòng lỗi đã bị bỏ ở bước xem trước; nơi gọi chỉ đưa kiện hợp lệ.
 */
// POST /api/trips/{id}/packages
export async function importPackages(tripId: string, imported: readonly CargoPackage[]): Promise<Trip> {
  const db = getMockDb()
  const { packages } = await db.getTrip(tripId)
  return db.updateTrip(tripId, { packages: [...packages, ...imported] })
}

// DELETE /api/trips/{id}/packages/{packageId}
export async function deletePackage(tripId: string, packageId: string): Promise<Trip> {
  const db = getMockDb()
  const { packages } = await db.getTrip(tripId)
  return db.updateTrip(tripId, { packages: packages.filter((item) => item.id !== packageId) })
}

/** Nhân bản kiện (D-33): mã mới lấy theo mã lớn nhất đang có, bản sao nằm ngay sau bản gốc. */
// chưa có ở BE
export async function duplicateTripPackage(tripId: string, packageId: string): Promise<CargoPackage> {
  const db = getMockDb()
  const { packages } = await db.getTrip(tripId)
  const index = packages.findIndex((item) => item.id === packageId)
  const source = packages[index]
  if (!source) throw new Error(`Chuyến ${tripId} không có kiện ${packageId}`)
  const copy = duplicatePackage(source, packages.map((item) => item.id))
  await db.updateTrip(tripId, { packages: packages.toSpliced(index + 1, 0, copy) })
  return copy
}

export type TripRevisions = { readonly trip: Trip; readonly revisions: Revision[] }

/** Chuyến kèm mọi revision đã lưu, cũ trước — màn So sánh phương án cần `inputVersion` của chuyến để biết bản lỗi thời (LM-051). */
// chưa có ở BE
export async function fetchTripRevisions(tripId: string): Promise<TripRevisions> {
  const db = getMockDb()
  const [trip, revisions] = await Promise.all([db.getTrip(tripId), db.listRevisions(tripId)])
  return { trip, revisions }
}
