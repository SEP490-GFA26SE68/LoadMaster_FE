import { vnClock, vnDate, vnTime } from './clock'
import { found, nextId, put, sameData, type DbContext } from './db-context'
import { releaseTripPackages, returnUndeliveredPackages } from './db-package-progress'
import { releaseTripRequirements } from './db-requirement-trips'
import { advanceTracking } from './db-tracking'
import { stopDemandsOf } from './db-trip-lines'
import { syncTripPool } from './db-trip-packages'
import { settleSegregation } from './db-trip-segregation'
import { MockDbError } from './errors'
import { canCancelTrip, tripStatus } from './operations'
import { isValidCoordinate } from './requirement-model'
import type { CompanyDepot } from './source-types'
import { tripChangeParams } from './trip-changes'
import { withFreshRoute } from './trip-route'
import { withStopDemands } from './trip-stops'
import type { MockDb, Trip, TripChanges } from './types'

type TripMethods = Pick<MockDb, 'listTrips' | 'getTrip' | 'createTrip' | 'updateTrip' | 'cancelTrip'>

/** Trường của `TripChanges`, theo thứ tự ghi vào tham số `fields` của sự kiện `trip.updated`. */
const EDITABLE = ['name', 'scheduledDate', 'departureAt', 'depot', 'driverId', 'vehicleId', 'stops', 'packages'] as const satisfies readonly (keyof TripChanges)[]

/** Pha `loading`/`loaded` vẫn đổi được tên, ngày giờ xuất phát, tài xế — xe, kho đi, điểm giao, kiện thì không (D-45). */
const LOCKED_WHILE_LOADING: ReadonlySet<keyof TripChanges> = new Set(['vehicleId', 'depot', 'stops', 'packages'])

/** Giờ xuất phát khi nơi tạo chuyến chỉ đưa ngày chạy (giờ Việt Nam). Form chuyến luôn gửi giờ người dùng chọn. */
export const DEFAULT_DEPARTURE_TIME = '08:00'

/** Giờ xuất phát đã chuẩn hoá thành ISO 8601 (UTC); không đọc được: `TRIP_INVALID`. */
function departureIso(value: string, tripId: string): string {
  const at = Date.parse(value)
  if (Number.isNaN(at)) throw new MockDbError('TRIP_INVALID', { tripId, field: 'departureAt' })
  return new Date(at).toISOString()
}

/** Kho xuất phát: tên và địa chỉ bỏ khoảng trắng hai đầu, tên bắt buộc, toạ độ trong khoảng hợp lệ. */
function depotFields(depot: CompanyDepot, tripId: string): CompanyDepot {
  const name = depot.name.trim()
  if (name === '' || !isValidCoordinate(depot.lat, depot.lng)) throw new MockDbError('TRIP_INVALID', { tripId, field: 'depot' })
  return { name, address: depot.address.trim(), lat: depot.lat, lng: depot.lng }
}

/**
 * Chuyến của công ty của phiên (D-64). Xe và tài xế của chuyến phải cùng công ty với chuyến: khác công ty là `FORBIDDEN_COMPANY`. Kiện
 * thêm ngay trong chuyến (form, nhập file) tự thành kiện của kho kiện, nguồn `TRIP` (`syncTripPool`, FE-3b-07). Chuyến có giờ xuất
 * phát và kho xuất phát (FE-4b-04, D-76): ngày chạy luôn là ngày của giờ xuất phát; kho đi mặc định là kho của công ty.
 */
export function tripMethods(ctx: DbContext): TripMethods {
  const { trips, maintenance, users, companies } = ctx.state
  const scope = ctx.scope.trips

  function assertVehicleUsable(vehicleId: string, companyId: string) {
    ctx.scope.vehicles.ref(vehicleId, companyId)
    if (maintenance.has(vehicleId)) throw new MockDbError('VEHICLE_IN_MAINTENANCE', { vehicleId })
  }

  function assertDriver(userId: string | null, companyId: string) {
    if (userId === null) return
    const user = users.get(userId)
    if (user?.role !== 'driver' || user.status !== 'active') throw new MockDbError('DRIVER_INVALID', { userId })
    if (user.companyId !== companyId) throw new MockDbError('FORBIDDEN_COMPANY', { collection: 'users', id: userId })
  }

  return {
    listTrips: () => ctx.respond(() => scope.list()),
    getTrip: (id) => ctx.respond(() => scope.read(id)),
    createTrip: ({ name, vehicleId, stops, packages, scheduledDate, driverId = null, departureAt, depot, overrideReason }) =>
      ctx.respond(() => {
        const companyId = ctx.scope.newRecordCompany()
        assertVehicleUsable(vehicleId, companyId)
        assertDriver(driverId, companyId)
        const id = nextId('TRIP', trips.keys())
        const departure = departureAt === undefined ? vnTime(scheduledDate, DEFAULT_DEPARTURE_TIME) : departureIso(departureAt, id)
        const trip: Trip = {
          id,
          companyId,
          name,
          vehicleId,
          stops,
          packages,
          inputVersion: 1,
          scheduledDate: vnDate(new Date(departure)),
          departureAt: departure,
          depot: depot === undefined ? found(companies, 'companies', companyId).depot : depotFields(depot, id),
          driverId,
          phase: 'planning',
          createdAt: ctx.nowIso(),
        }
        // Chuyến tạo kèm kiện nhiều loại hàng cần lý do vượt luật (D-74)
        const created = put(trips, settleSegregation(ctx, { id, packages: [] }, trip, { overrideReason }))
        syncTripPool(ctx, created)
        ctx.log('trip.created', { type: 'trip', id: created.id }, { name })
        return created
      }),
    updateTrip: (id, changes) =>
      ctx.respond(() => {
        const current = scope.own(id)
        if (changes.vehicleId !== undefined) ctx.scope.vehicles.ref(changes.vehicleId, current.companyId)
        // Ngày chạy và giờ xuất phát đi cùng nhau: đổi giờ xuất phát thì ngày chạy theo nó; chỉ đổi ngày thì giữ giờ trong ngày
        const requested: TripChanges = { ...changes }
        if (changes.departureAt !== undefined) {
          requested.departureAt = departureIso(changes.departureAt, id)
          requested.scheduledDate = vnDate(new Date(requested.departureAt))
        } else if (changes.scheduledDate !== undefined) {
          requested.departureAt = vnTime(changes.scheduledDate, vnClock(new Date(current.departureAt)))
        }
        if (changes.depot !== undefined) requested.depot = depotFields(changes.depot, id)
        // Chỉ nhận các trường sửa được: trường kho quản lý trong một bản sao cũ bị trải vào `changes` không được ghi đè
        const changed = EDITABLE.filter((field) => requested[field] !== undefined && !sameData(requested[field], current[field]))
        if (changed.length === 0) return current
        if (current.phase !== 'planning') {
          const lockedNow = current.phase !== 'loading' && current.phase !== 'loaded'
          if (lockedNow || changed.some((field) => LOCKED_WHILE_LOADING.has(field))) {
            throw new MockDbError('TRIP_LOCKED', { tripId: id, phase: current.phase })
          }
        }
        if (changed.includes('vehicleId')) assertVehicleUsable(requested.vehicleId ?? current.vehicleId, current.companyId)
        if (changed.includes('driverId')) assertDriver(requested.driverId ?? null, current.companyId)
        let next: Trip = { ...current }
        for (const field of changed) Object.assign(next, { [field]: requested[field] })
        const inputChanged = changed.includes('vehicleId') || changed.includes('packages')
        next.inputVersion = current.inputVersion + (inputChanged ? 1 : 0)
        // Điểm giao hoặc dòng kiện đổi (đổi thứ tự, chuyển dòng sang điểm khác): hạn và ưu tiên của từng điểm tính lại (D-73)
        if (changed.includes('packages') || changed.includes('stops')) next.stops = withStopDemands(next.stops, stopDemandsOf(ctx, next))
        // Dòng kiện đổi: một chuyến một loại hàng (D-74) — kiện khác loại mới cần lý do vượt, hết kiện khác loại thì gỡ lý do
        if (changed.includes('packages')) next = settleSegregation(ctx, current, next, { overrideReason: changes.overrideReason })
        // Tuyến đã tối ưu (FE-4b-09): thêm / bớt điểm thì chuyến về Nháp; đổi thứ tự, giờ xuất phát, kho đi thì tính lại giờ đến
        next = withFreshRoute(next)
        // Dời ngày chạy mà giữ giờ trong ngày: nhật ký chỉ ghi ngày chạy, như trước khi chuyến có giờ xuất phát
        const dateOnly = changed.includes('scheduledDate') && vnClock(new Date(next.departureAt)) === vnClock(new Date(current.departureAt))
        const logged = changed.filter((field) => !(dateOnly && field === 'departureAt'))
        // Kho xuất phát của chuyến ghi tên trường riêng: `depot` trong nhật ký là kho / chi nhánh của một tài khoản
        const fields = logged.map((field) => (field === 'depot' ? 'departureDepot' : field)).join(',')
        ctx.log('trip.updated', { type: 'trip', id }, { fields, ...tripChangeParams(current, next, logged) })
        const stored = put(trips, next)
        // Dòng kiện và điểm giao chỉ đổi được khi chuyến còn lập kế hoạch: kiện kho kiện của chuyến đổi theo (FE-3b-07)
        if (changed.includes('packages') || changed.includes('stops')) syncTripPool(ctx, stored)
        return stored
      }),
    cancelTrip: (id, reason) =>
      ctx.respond(() => {
        const current = scope.own(id)
        // Đang vận chuyển chỉ huỷ được khi có sự cố cấp chuyến chưa xử lý (FE-6-11); Đã giao, Đã huỷ thì không huỷ được (D-91)
        if (!canCancelTrip(current.phase, ctx.state.exceptions.get(id)?.exceptions ?? [])) {
          throw new MockDbError('INVALID_TRIP_STATUS_TRANSITION', { tripId: id, from: tripStatus(current), to: 'CANCELLED' })
        }
        const trimmed = reason.trim()
        if (trimmed === '') throw new MockDbError('REASON_REQUIRED', {})
        if (current.phase === 'delivering') {
          // Vị trí xe ghi bù tới lúc huỷ; kiện chưa giao thành Hoàn trả và ở lại chuyến — yêu cầu giao của chúng đọc là giao thiếu
          advanceTracking(ctx, current)
          const returned = returnUndeliveredPackages(ctx, current)
          ctx.log('trip.cancelled', { type: 'trip', id }, { reason: trimmed, returned })
        } else {
          // Huỷ lúc Đang xếp hàng: `loaded` là số kiện đã lên xe — kho được báo dỡ phần đã xếp
          const loaded = current.loading?.steps.filter((step) => step.outcome === 'loaded').length
          ctx.log('trip.cancelled', { type: 'trip', id }, { reason: trimmed, ...(loaded === undefined ? {} : { loaded }) })
          // Huỷ trước khi xe chạy (D-91): kiện về kho kiện, yêu cầu giao về "chờ xếp chuyến"
          releaseTripPackages(ctx, current)
          releaseTripRequirements(ctx, current)
        }
        const cancellation = { at: ctx.nowIso(), by: ctx.state.session.userId, reason: trimmed, fromPhase: current.phase }
        return put(trips, { ...current, phase: 'cancelled', cancellation })
      }),
  }
}
