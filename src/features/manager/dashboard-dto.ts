import { roundKg } from '@/domain/geometry'
import { ApiError } from '@/lib/api-client'
import { isoFromBackend } from '@/lib/backend-time'
import { vnDate } from '@/lib/mock-db'
import { TRIP_STATUSES, type TripStatus } from '@/types/trip'
import { daysOf, type DateRange } from './dashboard-period'
import type { DashboardSummary, DashboardTripView, VehicleSummary } from './dashboard-summary'

/**
 * DTO của `GET /api/manager/dashboard` (`ManagerDashboardResponse`) và phép đổi sang `DashboardSummary` của màn. Chỉ
 * `dashboard-backend-api.ts` import file này. Hàm thuần. Số không có nguồn máy chủ trả `null` (không phải 0) — giữ nguyên `null` để màn
 * hiện "—" kèm lý do. Tỷ lệ máy chủ trả là % (0–100), khối lượng kg.
 */

/** BigDecimal của Jackson: số, hoặc chuỗi khi máy chủ ghi BigDecimal bằng chuỗi. */
type Decimal = number | string

export type DashboardDto = {
  readonly from: string
  readonly to: string
  readonly tripCount: number
  readonly completedCount: number
  readonly cancelledCount: number
  readonly tripsByStatus: Readonly<Record<string, number>>
  readonly fill: { readonly averagePercent: Decimal | null; readonly planCount: number }
  readonly deliveredWeightKg: Decimal | null
  readonly delivery: { readonly cleanPercent: Decimal | null; readonly cleanItems: number; readonly finishedItems: number }
  readonly vehicles: {
    readonly total: number
    readonly inService: number
    readonly available: number
    readonly maintenance: number
    readonly retired: number
  }
  readonly fillByDay: readonly { readonly date: string; readonly averagePercent: Decimal | null; readonly planCount: number }[]
  readonly weightByVehicle: readonly {
    readonly vehicleId: number
    readonly vehicleName: string | null
    readonly tripCount: number
    readonly deliveredWeightKg: Decimal | null
    readonly averageFillPercent: Decimal | null
  }[]
  readonly recentTrips: readonly {
    readonly tripId: number
    readonly tripCode: string | null
    readonly tripName: string | null
    readonly departureTime: string | null
    readonly status: string | null
    readonly vehicleName: string | null
    readonly driverName: string | null
    readonly fillPercent: Decimal | null
  }[]
}

function numberOf(value: Decimal | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) throw new ApiError('SERVER_ERROR')
  return number
}

function isTripStatus(value: string | null): value is TripStatus {
  return TRIP_STATUSES.some((status) => status === value)
}

/** Trạng thái lạ là máy chủ đổi hợp đồng: báo lỗi thay vì vẽ chip sai. */
function tripStatusOf(value: string | null): TripStatus {
  if (!isTripStatus(value)) throw new ApiError('SERVER_ERROR')
  return value
}

function tripOf(dto: DashboardDto['recentTrips'][number]): DashboardTripView {
  // Máy chủ chỉ đếm chuyến có giờ xuất phát trong kỳ: chuyến không có giờ đó là máy chủ đổi hợp đồng
  if (dto.departureTime === null) throw new ApiError('SERVER_ERROR')
  const code = dto.tripCode ?? String(dto.tripId)
  return {
    id: code,
    name: dto.tripName ?? code,
    // Kỳ của máy chủ theo giờ xuất phát giờ Việt Nam: ngày chạy là ngày của giờ đó
    scheduledDate: vnDate(new Date(isoFromBackend(dto.departureTime))),
    vehicleName: dto.vehicleName ?? '',
    driverName: dto.driverName,
    status: tripStatusOf(dto.status),
    volumePercent: numberOf(dto.fillPercent),
  }
}

function vehicleOf(dto: DashboardDto['weightByVehicle'][number]): VehicleSummary {
  const vehicleId = String(dto.vehicleId)
  return {
    vehicleId,
    vehicleName: dto.vehicleName ?? vehicleId,
    tripCount: dto.tripCount,
    deliveredWeightKg: roundKg(numberOf(dto.deliveredWeightKg) ?? 0),
    averageFillPercent: numberOf(dto.averageFillPercent),
  }
}

/**
 * Số của máy chủ → `DashboardSummary`. Lấp đầy theo ngày: máy chủ chỉ trả ngày có phương án đã duyệt, màn vẽ mọi ngày của kỳ và để
 * trống ngày không có số (như kho mẫu). Chuyến theo trạng thái chỉ giữ trạng thái có chuyến. `period` là kỳ máy chủ trả về.
 */
export function dashboardSummaryOf(dto: DashboardDto): DashboardSummary {
  const period: DateRange = { from: dto.from, to: dto.to }
  const fillOf = new Map(dto.fillByDay.map((day) => [day.date, day]))
  return {
    period,
    tripCount: dto.tripCount,
    completedCount: dto.completedCount,
    fill: { averagePercent: numberOf(dto.fill.averagePercent), planCount: dto.fill.planCount, isMockResult: false },
    deliveredWeightKg: roundKg(numberOf(dto.deliveredWeightKg) ?? 0),
    delivery: {
      cleanPercent: numberOf(dto.delivery.cleanPercent),
      cleanItems: dto.delivery.cleanItems,
      finishedItems: dto.delivery.finishedItems,
    },
    vehicles: {
      inUse: dto.vehicles.inService,
      total: dto.vehicles.total,
      byStatus: {
        available: dto.vehicles.available,
        in_use: dto.vehicles.inService,
        maintenance: dto.vehicles.maintenance,
        retired: dto.vehicles.retired,
      },
    },
    fillByDay: daysOf(period).map((date) => {
      const day = fillOf.get(date)
      return { date, averagePercent: numberOf(day?.averagePercent), planCount: day?.planCount ?? 0 }
    }),
    tripsByStatus: TRIP_STATUSES
      .map((status) => ({ status, count: dto.tripsByStatus[status] ?? 0 }))
      .filter((entry) => entry.count > 0),
    byVehicle: dto.weightByVehicle.map(vehicleOf),
    trips: dto.recentTrips.map(tripOf),
  }
}
