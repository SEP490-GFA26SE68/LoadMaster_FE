import { ApiError } from '@/lib/api-client'
import { isoFromBackend } from '@/lib/backend-time'
import { vnDate, type TripPhase } from '@/lib/mock-db'
import { TRIP_STATUSES, type TripStatus } from '@/types/trip'
import type { TripRow } from './trip-list'

/**
 * DTO của `TripController` backend (`TripResponse`) và hàm đổi sang kiểu của màn chuyến; chỉ
 * `trips-backend-api.ts` import file này. Mã chuyến của backend (`tripCode`) là mã chuyến của app ở mọi chỗ — URL, dòng danh sách, tìm
 * nhanh — như màn Giám sát (Chi tiết chuyến đổi mã chuyến sang mã số, `resolveBackendTripId`). Mốc giờ `LocalDateTime` qua `isoFromBackend`.
 */

export type TripDto = {
  readonly id: number | string
  readonly tripCode: string
  readonly tripName?: string | null
  readonly vehicleId?: number | string | null
  readonly vehicleName?: string | null
  readonly licensePlate?: string | null
  readonly driverId?: number | string | null
  readonly driverName?: string | null
  readonly departureTime?: string | null
  readonly originName?: string | null
  readonly originAddress?: string | null
  readonly originLatitude?: number | null
  readonly originLongitude?: number | null
  readonly status: string
  /** Chỉ danh sách có ba số đếm; `/detail` trả `null`. */
  readonly stopCount?: number | null
  readonly packageCount?: number | null
}

/** Pha của kho mẫu gần nghĩa nhất: backend không tách "đang xếp" và "đã xếp xong". */
const PHASE_OF: Record<TripStatus, TripPhase> = {
  DRAFT: 'planning',
  PLANNED: 'planning',
  LOADING: 'loading',
  IN_TRANSIT: 'delivering',
  DELIVERED: 'completed',
  CANCELLED: 'cancelled',
}

function statusOf(value: string): TripStatus {
  const status = TRIP_STATUSES.find((item) => item === value)
  if (status === undefined) throw new ApiError('SERVER_ERROR')
  return status
}

const timeOf = (value: string | null | undefined) => (value ? isoFromBackend(value) : null)

/** "Tên xe · biển số" như tên xe của kho mẫu, để bảng tách hai phần bằng `splitVehicleName`. */
function vehicleLabel(dto: TripDto): string {
  const name = dto.vehicleName?.trim() ?? ''
  const plate = dto.licensePlate?.trim() ?? ''
  return name && plate ? `${name} · ${plate}` : name || plate
}

/**
 * Một dòng danh sách chuyến. Backend không trả tên các điểm giao (tuyến), phương án xếp hàng hay tiến độ kho: tuyến rỗng, lấp đầy và
 * hai dòng phụ `null` — màn bỏ cột và số dựa trên chúng (`TRIPS_CAPABILITIES`). Danh sách luôn kèm số điểm và số kiện.
 */
export function tripRowOf(dto: TripDto): TripRow {
  const status = statusOf(dto.status)
  const departure = timeOf(dto.departureTime)
  return {
    id: dto.tripCode,
    name: dto.tripName?.trim() || dto.tripCode,
    scheduledDate: departure ? vnDate(new Date(departure)) : '',
    vehicleId: dto.vehicleId === null || dto.vehicleId === undefined ? '' : String(dto.vehicleId),
    vehicleName: vehicleLabel(dto),
    driverId: dto.driverId === null || dto.driverId === undefined ? null : String(dto.driverId),
    driverName: dto.driverName ?? null,
    route: '',
    packageCount: dto.packageCount ?? 0,
    stopCount: dto.stopCount ?? 0,
    volumePercent: null,
    hasActiveRoutePlan: false,
    status,
    sub: null,
    extraSub: null,
    phase: PHASE_OF[status],
  }
}
