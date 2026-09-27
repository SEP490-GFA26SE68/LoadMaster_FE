import { roundKg } from '@/domain/geometry'
import type { VehicleConfig } from '@/domain/models'
import type { VehicleState, VehicleStatus } from '@/lib/mock-db'
import { compareText } from '@/lib/list-filter'
import type { TripStatus } from '@/types/trip'
import type { User } from '@/types/user'
import { daysOf, isWithinPeriod, type DateRange } from './dashboard-period'
import { tripFacts, type TripFacts, type TripWithRevisions } from './trip-facts'

export type { TripWithRevisions } from './trip-facts'

/** Dữ liệu kho bảng điều khiển đọc một lần; kỳ lọc lại trên máy, đổi kỳ không phải đọc lại kho. */
export type DashboardData = {
  /** Hôm nay theo giờ Việt Nam lúc đọc kho — mốc của kỳ 7 ngày, 30 ngày, tháng này. */
  readonly today: string
  readonly trips: readonly TripWithRevisions[]
  readonly vehicles: readonly Pick<VehicleConfig, 'id' | 'name'>[]
  readonly vehicleStates: readonly VehicleState[]
  readonly users: readonly Pick<User, 'id' | 'fullName'>[]
}

export type DashboardTripRow = TripFacts & { readonly vehicleName: string; readonly driverName: string | null }

export type VehicleSummary = {
  readonly vehicleId: string
  readonly vehicleName: string
  /** Chuyến của xe trong kỳ, gồm cả chuyến huỷ. */
  readonly tripCount: number
  readonly deliveredWeightKg: number
  /** Lấp đầy trung bình các bản đã duyệt của xe (không tính chuyến huỷ); `null` khi không có. */
  readonly averageFillPercent: number | null
}

export type DashboardSummary = {
  readonly period: DateRange
  /** Chuyến có ngày chạy trong kỳ, gồm cả chuyến huỷ. */
  readonly tripCount: number
  readonly completedCount: number
  /** Trung bình lấp đầy thể tích của bản đã duyệt mới nhất, chuyến không huỷ. */
  readonly fill: { readonly averagePercent: number | null; readonly planCount: number; readonly isMockResult: boolean }
  readonly deliveredWeightKg: number
  /** Kiện giao không sự cố trên kiện của các điểm giao đã hoàn tất. */
  readonly delivery: { readonly cleanPercent: number | null; readonly cleanItems: number; readonly finishedItems: number }
  /**
   * Đội xe lúc đọc kho — không theo kỳ: số xe đang chạy chuyến trên tổng, và số xe theo ba trạng thái của màn Đội xe.
   */
  readonly vehicles: {
    readonly inUse: number
    readonly total: number
    readonly byStatus: Readonly<Record<VehicleStatus, number>>
  }
  /** Mỗi ngày của kỳ một phần tử; ngày không có bản đã duyệt thì `null`. */
  readonly fillByDay: readonly { readonly date: string; readonly averagePercent: number | null; readonly planCount: number }[]
  /** Theo vòng đời chuyến, chỉ trạng thái có chuyến. */
  readonly tripsByStatus: readonly { readonly status: TripStatus; readonly count: number }[]
  /** Xe có chuyến trong kỳ, khối lượng đã giao giảm dần. */
  readonly byVehicle: readonly VehicleSummary[]
  /** Chuyến trong kỳ, ngày chạy mới nhất trước. */
  readonly trips: readonly DashboardTripRow[]
}

/** Thứ tự vòng đời cho biểu đồ chuyến theo trạng thái: năm trạng thái của backend cộng Đã huỷ (LM-104). */
const STATUS_ORDER: readonly TripStatus[] = [
  'nhap', 'da_toi_uu', 'da_duyet', 'dang_van_chuyen', 'hoan_thanh', 'da_huy',
]

function average(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length
}

/** Tỷ lệ lấp đầy của các chuyến được tính trung bình: đã duyệt và không huỷ. */
function fillValues(rows: readonly TripFacts[]): number[] {
  return rows.flatMap((row) => (row.cancelled || row.volumePercent === null ? [] : [row.volumePercent]))
}

/**
 * Gộp số liệu bảng điều khiển của một kỳ (LM-090, D-48). Hàm thuần: `dashboard-api.ts` đọc kho, hàm này chỉ tính. Mọi số truy
 * về chuyến, revision, trạng thái xe của kho (AGENTS mục 6 "Không bịa số").
 */
export function summarizeDashboard(data: DashboardData, period: DateRange): DashboardSummary {
  const vehicleName = new Map(data.vehicles.map((vehicle) => [vehicle.id, vehicle.name]))
  const userName = new Map(data.users.map((user) => [user.id, user.fullName]))
  const rows: DashboardTripRow[] = data.trips
    .filter(({ trip }) => isWithinPeriod(trip.scheduledDate, period))
    .map((entry) => {
      const facts = tripFacts(entry)
      return {
        ...facts,
        vehicleName: vehicleName.get(facts.vehicleId) ?? facts.vehicleId,
        driverName: facts.driverId === null ? null : (userName.get(facts.driverId) ?? facts.driverId),
      }
    })
    .toSorted((a, b) => (a.scheduledDate === b.scheduledDate ? compareText(a.id, b.id) : a.scheduledDate < b.scheduledDate ? 1 : -1))

  const fills = fillValues(rows)
  const finishedItems = rows.reduce((sum, row) => sum + row.finishedItems, 0)
  const cleanItems = rows.reduce((sum, row) => sum + row.cleanItems, 0)

  return {
    period,
    tripCount: rows.length,
    completedCount: rows.filter((row) => row.status === 'hoan_thanh').length,
    fill: {
      averagePercent: average(fills),
      planCount: fills.length,
      isMockResult: rows.some((row) => !row.cancelled && row.volumePercent !== null && row.isMockResult),
    },
    deliveredWeightKg: roundKg(rows.reduce((sum, row) => sum + row.deliveredWeightKg, 0)),
    delivery: { cleanPercent: finishedItems === 0 ? null : (cleanItems / finishedItems) * 100, cleanItems, finishedItems },
    vehicles: summarizeFleet(data),
    fillByDay: daysOf(period).map((date) => {
      const values = fillValues(rows.filter((row) => row.scheduledDate === date))
      return { date, averagePercent: average(values), planCount: values.length }
    }),
    tripsByStatus: STATUS_ORDER
      .map((status) => ({ status, count: rows.filter((row) => row.status === status).length }))
      .filter((entry) => entry.count > 0),
    byVehicle: summarizeVehicles(rows),
    trips: rows,
  }
}

/**
 * Xe theo trạng thái, cùng luật với màn Đội xe (`vehicleRows`): xe không có trong danh sách trạng thái là Sẵn sàng. Đếm trên
 * danh sách xe, nên trạng thái của xe đã xoá không được tính.
 */
function summarizeFleet(data: DashboardData): DashboardSummary['vehicles'] {
  const statusOf = new Map(data.vehicleStates.map((state) => [state.vehicleId, state.status]))
  const byStatus: Record<VehicleStatus, number> = { available: 0, in_use: 0, maintenance: 0 }
  for (const vehicle of data.vehicles) byStatus[statusOf.get(vehicle.id) ?? 'available'] += 1
  return { inUse: byStatus.in_use, total: data.vehicles.length, byStatus }
}

function summarizeVehicles(rows: readonly DashboardTripRow[]): VehicleSummary[] {
  const byVehicle = new Map<string, DashboardTripRow[]>()
  for (const row of rows) byVehicle.set(row.vehicleId, [...(byVehicle.get(row.vehicleId) ?? []), row])
  return [...byVehicle]
    .map(([vehicleId, trips]) => ({
      vehicleId,
      vehicleName: trips[0]?.vehicleName ?? vehicleId,
      tripCount: trips.length,
      deliveredWeightKg: roundKg(trips.reduce((sum, trip) => sum + trip.deliveredWeightKg, 0)),
      averageFillPercent: average(fillValues(trips)),
    }))
    .toSorted((a, b) => b.deliveredWeightKg - a.deliveredWeightKg || compareText(a.vehicleName, b.vehicleName))
}
