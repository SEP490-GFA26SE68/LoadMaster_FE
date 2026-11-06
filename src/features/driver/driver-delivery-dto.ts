import type { DeadlineStatus } from '@/domain/routing'
import { isoFromBackend } from '@/lib/backend-time'
import { LOCATION_SOURCES } from '@/lib/mock-db'
import type { DriverLoadedPlan, LoadedPlacement } from './driver-server-scene'
import type { ServerTripStop, ServerTripStops } from './server-stop-timing'

/*
 * DTO của các endpoint tài xế đọc phương án đã xếp, giờ đến, và ghi sự cố / xác nhận tay theo kiện — cùng luật với `driver-dto.ts`: chỉ
 * lớp gọi backend import file này, phần máy chủ không trả thì để trống.
 */

/** `GET /api/driver/trips/{id}/load-plan` — cm, đã áp hướng xoay; chỉ kiện kho đã xác nhận xếp hoặc đã ghi sai lệch. */
export type DriverLoadPlanDto = {
  readonly tripId: number
  readonly tripCode: string | null
  readonly loadPlanId: number | null
  readonly licensePlate: string | null
  readonly innerLength: number | null
  readonly innerWidth: number | null
  readonly innerHeight: number | null
  readonly doorWidth: number | null
  readonly doorHeight: number | null
  readonly maxPayloadKg: number | null
  readonly stops: readonly { readonly stopId: number | null; readonly stopSequence: number | null; readonly stopName: string | null }[] | null
  readonly placements: readonly {
    readonly placementId: number | null
    readonly packageId: number | null
    readonly packageCode: string | null
    readonly trackingBarcode: string | null
    readonly posX: number | null
    readonly posY: number | null
    readonly posZ: number | null
    readonly packedLength: number | null
    readonly packedWidth: number | null
    readonly packedHeight: number | null
    readonly rotation: number | null
    readonly weightKg: number | null
    readonly stepSequence: number | null
    readonly unloadOrder: number | null
    readonly stopSequence: number | null
    readonly unloaded: boolean | null
  }[] | null
}

type PlacementDto = NonNullable<DriverLoadPlanDto['placements']>[number]

function placementOf(dto: PlacementDto, index: number): LoadedPlacement[] {
  const { placementId, packageId, packedLength, packedWidth, packedHeight } = dto
  if (placementId === null || packageId === null || packedLength === null || packedWidth === null || packedHeight === null) return []
  return [{
    id: String(placementId),
    packageId: String(packageId),
    code: dto.packageCode?.trim() || dto.trackingBarcode?.trim() || String(packageId),
    weightKg: dto.weightKg ?? 0,
    x: dto.posX ?? 0, y: dto.posY ?? 0, z: dto.posZ ?? 0,
    lengthCm: packedLength, widthCm: packedWidth, heightCm: packedHeight,
    rotation: dto.rotation,
    step: dto.stepSequence ?? index + 1,
    unloadOrder: dto.unloadOrder ?? index + 1,
    stopSequence: dto.stopSequence,
    unloaded: dto.unloaded === true,
  }]
}

/** Phương án đã xếp ở dạng khung 3D tài xế đọc. Lòng thùng thiếu một chiều là chưa khai (`box: null`); cửa chưa khai là cả mặt cắt lòng thùng. */
export function loadedPlanOf(dto: DriverLoadPlanDto): DriverLoadedPlan {
  const { innerLength, innerWidth, innerHeight } = dto
  const box = innerLength === null || innerWidth === null || innerHeight === null
    ? null
    : { innerLengthCm: innerLength, innerWidthCm: innerWidth, innerHeightCm: innerHeight, doorWidthCm: dto.doorWidth ?? innerWidth, doorHeightCm: dto.doorHeight ?? innerHeight }
  return {
    tripId: String(dto.tripId),
    tripCode: dto.tripCode ?? String(dto.tripId),
    planId: String(dto.loadPlanId ?? dto.tripId),
    vehicleName: dto.licensePlate ?? '',
    box,
    maxPayloadKg: dto.maxPayloadKg,
    stops: (dto.stops ?? []).flatMap((stop) => (stop.stopSequence === null ? [] : [{ sequence: stop.stopSequence, name: stop.stopName ?? '' }])),
    placements: (dto.placements ?? []).flatMap(placementOf),
  }
}

/** `GET /api/driver/trips/{id}/stops` — mốc giờ là `LocalDateTime` giờ Việt Nam. */
export type DriverTripStopsDto = {
  readonly tripId: number
  readonly status: string | null
  readonly location: { readonly source: string | null } | null
  readonly refreshMs: number | null
  readonly stops: readonly {
    readonly stopSequence: number | null
    readonly stopName: string | null
    readonly address: string | null
    readonly status: string | null
    readonly packageCount: number | null
    readonly plannedArrival: string | null
    readonly actualArrival: string | null
    readonly deadline: string | null
    readonly plannedStatus: string | null
    readonly eta: string | null
    readonly etaStatus: string | null
  }[] | null
}

const DEADLINE_STATUSES: readonly DeadlineStatus[] = ['OK', 'AT_RISK', 'MISSED']
const statusOf = (value: string | null): DeadlineStatus | undefined => DEADLINE_STATUSES.find((status) => status === value)
const timeOf = (value: string | null) => (value ? isoFromBackend(value) : undefined)

/** Giờ đến của các điểm theo máy chủ. Nguồn vị trí lạ đọc là GPS (điện thoại tài xế là nguồn duy nhất máy chủ nhận). */
export function tripStopsOf(dto: DriverTripStopsDto): ServerTripStops {
  const source = dto.location === null ? null : (LOCATION_SOURCES.find((entry) => entry === dto.location?.source) ?? 'GPS')
  return {
    location: source === null ? null : { source },
    refreshMs: dto.refreshMs,
    stops: (dto.stops ?? []).flatMap((stop): ServerTripStop[] => stop.stopSequence === null ? [] : [{
      number: stop.stopSequence,
      name: stop.stopName ?? '',
      address: stop.address ?? '',
      done: stop.status === 'COMPLETED',
      packageCount: stop.packageCount ?? 0,
      plannedArrival: timeOf(stop.plannedArrival),
      plannedStatus: statusOf(stop.plannedStatus),
      actualArrival: timeOf(stop.actualArrival),
      deadline: timeOf(stop.deadline),
      eta: timeOf(stop.eta),
      etaStatus: statusOf(stop.etaStatus),
    }]),
  }
}

/** `POST /api/driver/packages/{id}/issues` */
export type DeliveryIssueDto = { readonly issueId: number; readonly packageId: number | null; readonly kind: string | null; readonly unloaded: boolean | null }

/** `POST /api/driver/packages/{id}/manual-unload` — một xác nhận tay; cùng dạng ở `GET /api/trips/{id}/manual-confirmations`. */
export type ManualConfirmationDto = {
  readonly id: number
  readonly stopSequence: number | null
  readonly packageId: number | null
  readonly packageCode: string | null
  readonly trackingBarcode: string | null
  readonly packageName: string | null
  /** `LABEL_DAMAGED`, `QR_UNREADABLE`, `OTHER`. */
  readonly reason: string | null
  readonly note: string | null
  /** `PENDING`, `APPROVED`, `REJECTED`. */
  readonly status: string | null
  readonly requestedByName: string | null
  /** `LocalDateTime` (giờ Việt Nam). */
  readonly requestedAt: string | null
}
