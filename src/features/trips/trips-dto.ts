import { ApiError } from '@/lib/api-client'
import { isoFromBackend } from '@/lib/backend-time'
import { vnDate, type TripPhase } from '@/lib/mock-db'
import { TRIP_STATUSES, type TripStatus } from '@/types/trip'
import type { TripRow } from './trip-list'
import type { ServerTrip, ServerTripStop, ServerTripStopStatus } from './server-trip'

/**
 * DTO của `TripController` backend (`TripResponse`, `TripDetailResponse`, `TripStopResponse`) và hàm đổi sang kiểu của màn chuyến; chỉ
 * `trips-backend-api.ts` import file này. Mã chuyến của backend (`tripCode`) là mã chuyến của app ở mọi chỗ — URL, dòng danh sách, tìm
 * nhanh — như màn Giám sát; mã số chỉ dùng để gọi `/detail`. Mốc giờ `LocalDateTime` qua `isoFromBackend`.
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

export type TripStopDto = {
  readonly id: number | string
  readonly stopSequence: number
  readonly stopName?: string | null
  readonly address?: string | null
  readonly latitude?: number | null
  readonly longitude?: number | null
  readonly status?: string | null
  readonly plannedArrival?: string | null
  readonly actualArrival?: string | null
  readonly deadline?: string | null
}

export type TripDetailDto = { readonly trip: TripDto; readonly stops?: readonly TripStopDto[] | null }

const STOP_STATUSES: readonly ServerTripStopStatus[] = ['PENDING', 'ARRIVED', 'COMPLETED']

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

const coordinates = (lat: number | null | undefined, lng: number | null | undefined) =>
  typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : {}

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
    status,
    sub: null,
    extraSub: null,
    phase: PHASE_OF[status],
  }
}

function stopOf(dto: TripStopDto): ServerTripStop {
  const plannedArrival = timeOf(dto.plannedArrival)
  const actualArrival = timeOf(dto.actualArrival)
  const deadline = timeOf(dto.deadline)
  return {
    id: String(dto.id),
    number: dto.stopSequence,
    name: dto.stopName ?? '',
    address: dto.address ?? '',
    ...coordinates(dto.latitude, dto.longitude),
    status: STOP_STATUSES.find((item) => item === dto.status) ?? 'PENDING',
    ...(plannedArrival ? { plannedArrival } : {}),
    ...(actualArrival ? { actualArrival } : {}),
    ...(deadline ? { deadline } : {}),
  }
}

/**
 * Chuyến của Chi tiết chuyến: thông tin chuyến lấy từ dòng danh sách (`listed`, có số kiện và số điểm — `/detail` không có), điểm giao
 * từ `/detail` theo thứ tự đi. Kho xuất phát chỉ có toạ độ khi backend lưu đủ cả hai.
 */
export function serverTripOf(listed: TripDto, detail: TripDetailDto): ServerTrip {
  const status = statusOf(detail.trip.status)
  const stops = [...(detail.stops ?? [])].sort((a, b) => a.stopSequence - b.stopSequence).map(stopOf)
  const trip = detail.trip
  return {
    id: listed.tripCode,
    name: trip.tripName?.trim() || listed.tripCode,
    status,
    departureAt: timeOf(trip.departureTime),
    vehicleName: trip.vehicleName?.trim() ?? '',
    licensePlate: trip.licensePlate?.trim() ?? '',
    driverName: trip.driverName ?? null,
    origin: {
      name: trip.originName?.trim() ?? '',
      address: trip.originAddress?.trim() ?? '',
      ...coordinates(trip.originLatitude, trip.originLongitude),
    },
    packageCount: typeof listed.packageCount === 'number' ? listed.packageCount : null,
    stops,
  }
}
