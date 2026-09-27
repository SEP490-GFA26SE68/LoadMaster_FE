import { expandPackages } from '@/domain/cargo'
import type { VehicleConfig } from '@/domain/models'
import { tripProgress, type ProgressStep } from '@/features/trips/trip-progress'
import { fetchTripActivity } from '@/features/trips/trips-api'
import { getMockDb, latestApproved, tripStatus, type Revision, type Trip } from '@/lib/mock-db'
import type { UserStatus } from '@/types/user'

/**
 * Dữ liệu mẫu của `/kieu-dang` và `/thanh-phan` (V2.3): đọc thẳng kho như `-api.ts` của các màn, để mọi số, tên, mã trên hai trang
 * tài liệu truy được về seed (AGENTS mục 6 "Không bịa số"). Bảng chuyến và ô số liệu dùng lại hook của màn Chuyến hàng và Bảng
 * điều khiển; file này gom phần còn lại.
 */

export type SheetTrip = {
  readonly id: string
  readonly name: string
  readonly vehicleId: string
  readonly vehicleName: string
  /** Chiều dài lòng thùng của xe, cm. */
  readonly vehicleLengthCm: number
  /** Số kiện sau khi mở rộng `quantity`. */
  readonly packageCount: number
  readonly weightKg: number
  readonly maxPayloadKg: number
  /** Revision Planner mở mặc định (bản duyệt mới nhất, không có thì bản mới nhất); `null` khi chưa tối ưu. */
  readonly volumePercent: number | null
  readonly payloadPercent: number | null
  readonly usedPayloadKg: number | null
  readonly scheduledDate: string
}

export type SheetSample = {
  /** Chuyến đầu danh sách của kho (luôn `TRIP-2026-0914`). */
  readonly trip: SheetTrip
  /** Một kiện của chuyến đó, cho dòng "số trong bảng" và hộp thoại xoá kiện. */
  readonly pkg: { readonly id: string; readonly weightKg: number; readonly lengthCm: number; readonly widthCm: number; readonly heightCm: number }
  /** Chuyến chưa huỷ dùng tải trọng cao nhất. */
  readonly heaviest: SheetTrip | null
  readonly cancellation: { readonly at: string; readonly reason: string } | null
  /** Tiến trình của chuyến đầu tiên đang chờ duyệt (đã tối ưu). */
  readonly progress: { readonly tripId: string; readonly steps: readonly ProgressStep[] } | null
  readonly vehicles: readonly { readonly id: string; readonly name: string }[]
  readonly drivers: readonly { readonly id: string; readonly fullName: string }[]
  readonly dispatcherEmail: string
  readonly people: readonly { readonly id: string; readonly fullName: string; readonly status: UserStatus }[]
}

function shownRevision(revisions: readonly Revision[]) {
  return latestApproved(revisions) ?? revisions.at(-1)
}

function sheetTrip(trip: Trip, revisions: readonly Revision[], vehicle: VehicleConfig | undefined): SheetTrip {
  const metrics = shownRevision(revisions)?.result.metrics
  const instances = expandPackages(trip.packages).instances
  return {
    id: trip.id,
    name: trip.name,
    vehicleId: trip.vehicleId,
    vehicleName: vehicle?.name ?? '',
    vehicleLengthCm: vehicle?.innerLengthCm ?? 0,
    packageCount: instances.length,
    weightKg: instances.reduce((sum, item) => sum + item.weightKg, 0),
    maxPayloadKg: vehicle?.maxPayloadKg ?? 0,
    volumePercent: metrics?.volumeUtilizationPercent ?? null,
    payloadPercent: metrics?.payloadUtilizationPercent ?? null,
    usedPayloadKg: metrics?.usedPayloadKg ?? null,
    scheduledDate: trip.scheduledDate,
  }
}

export async function fetchSheetSample(): Promise<SheetSample> {
  const db = getMockDb()
  const [trips, vehicles, users] = await Promise.all([db.listTrips(), db.listVehicles(), db.listUsers()])
  const revisions = await Promise.all(trips.map((trip) => db.listRevisions(trip.id)))
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]))
  const rows = trips.map((trip, index) => {
    const vehicle = vehicleById.get(trip.vehicleId)
    return { trip, revisions: revisions[index] ?? [], row: sheetTrip(trip, revisions[index] ?? [], vehicle) }
  })
  const main = rows[0]
  if (!main) throw new Error('Kho mẫu không có chuyến nào')

  const instances = expandPackages(main.trip.packages).instances
  const pkg = instances[Math.min(27, instances.length - 1)] ?? instances[0]
  if (!pkg) throw new Error(`Chuyến ${main.trip.id} không có kiện nào`)

  const heaviest = rows
    .filter(({ trip }) => trip.phase !== 'cancelled')
    .reduce<SheetTrip | null>((best, { row }) => ((row.payloadPercent ?? -1) > (best?.payloadPercent ?? -1) ? row : best), null)
  const cancelled = trips.find((trip) => trip.cancellation)?.cancellation
  const waiting = rows.find(({ trip, revisions: list }) => tripStatus(trip, list) === 'da_toi_uu')
  const activity = waiting ? await fetchTripActivity(waiting.trip.id) : null

  return {
    trip: main.row,
    pkg: { id: pkg.packageInstanceId, weightKg: pkg.weightKg, lengthCm: pkg.lengthCm, widthCm: pkg.widthCm, heightCm: pkg.heightCm },
    heaviest,
    cancellation: cancelled ? { at: cancelled.at, reason: cancelled.reason } : null,
    progress: waiting && activity
      ? { tripId: waiting.trip.id, steps: tripProgress(waiting.trip, activity.revisions, activity.events) }
      : null,
    vehicles: vehicles.map((vehicle) => ({ id: vehicle.id, name: vehicle.name })),
    drivers: users.filter((user) => user.role === 'driver' && user.status === 'active').map(({ id, fullName }) => ({ id, fullName })),
    dispatcherEmail: users.find((user) => user.role === 'dispatcher')?.email ?? '',
    people: users.slice(0, 3).map(({ id, fullName, status }) => ({ id, fullName, status })),
  }
}
