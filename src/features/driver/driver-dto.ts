import type { DeliveryView, ItemProgress } from './delivery-progress'
import type { DeliveryItem, StopDelivery } from './driver-plan'
import type { MyTripRow, MyTrips } from './my-trips'

/*
 * Dữ liệu backend trả cho tài xế (`/api/driver/**`) và cách đổi sang kiểu của màn tài xế. Chỉ `driver-backend-api.ts` import file này:
 * kiểu DTO không ra khỏi lớp gọi backend. Phần backend chưa trả thì để trống — màn bỏ hẳn phần đó, không điền số thay.
 */

/** `GET /api/users/me` — chỉ cần mã người dùng của backend: xe gắn tài xế bằng mã này, và mọi endpoint của tài xế lọc theo nó. */
export type UserMeDto = { readonly id: number | null }

/** `GET /api/driver/trips` — backend chỉ trả chuyến đang vận chuyển. */
export type DriverTripDto = {
  readonly tripId: number
  readonly tripCode: string | null
  readonly vehicleLicensePlate: string | null
  readonly stopCount: number | null
  /** `LocalDateTime` của backend: không kèm múi giờ, là giờ Việt Nam. */
  readonly departureTime: string | null
  readonly status: string | null
}

export type StopPackageDto = {
  readonly packageId: number | null
  readonly packageName: string | null
  readonly trackingBarcode: string | null
  /**
   * Mã của bên gửi và mã QR in trên nhãn: `StopPackageResponse` của backend chưa trả hai trường này (chỉ có mã vạch) — trả thì tài xế gõ
   * được chúng.
   */
  readonly packageCode?: string | null
  readonly qrToken?: string | null
  readonly weight: number | null
  readonly unloadOrder: number | null
}

/** `GET /api/driver/trips/{id}/current-stop` — điểm chưa hoàn tất đầu tiên và kiện của điểm đó theo thứ tự dỡ. */
export type CurrentStopDto = {
  readonly stopId: number
  readonly stopSequence: number
  readonly stopName: string | null
  readonly address: string | null
  readonly packages: readonly StopPackageDto[] | null
}

/** `POST /api/driver/packages/{id}/unload` — `remainingPackagesCount` là số kiện của điểm còn chưa dỡ. */
export type ConfirmUnloadDto = { readonly packageId: number; readonly remainingPackagesCount: number | null }

/** `POST /api/driver/stops/{id}/complete` */
export type CompleteStopDto = { readonly tripCompleted: boolean | null }

/** `POST /api/driver/location` — `recordedAt` là ISO 8601 (UTC). */
export type LocationPointDto = { readonly recordedAt: string }

/** Ngày chạy `YYYY-MM-DD` của giờ xuất phát kiểu `LocalDateTime` (giờ Việt Nam, nên ngày đọc thẳng); rỗng hoặc sai dạng thì `undefined`. */
export function departureDateOf(value: string | null): string | undefined {
  return /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}/.exec(value?.trim() ?? '')?.[1]
}

/** Một chuyến của "Chuyến của tôi": backend chưa có tên tuyến, số kiện, điểm đang giao, sự cố — để trống. */
export function tripRowOf(dto: DriverTripDto): MyTripRow {
  const id = String(dto.tripId)
  return {
    id,
    code: dto.tripCode ?? id,
    name: undefined,
    scheduledDate: departureDateOf(dto.departureTime),
    vehicleName: dto.vehicleLicensePlate ?? '',
    status: 'IN_TRANSIT',
    sub: null,
    manualSub: null,
    stopCount: dto.stopCount ?? 0,
    packageCount: undefined,
    currentStop: undefined,
    completedAt: undefined,
    issueCount: 0,
    recheck: 0,
    stops: [],
    schedule: { stops: [] },
  }
}

/** Danh sách của backend chỉ có chuyến đang vận chuyển: các nhóm khác rỗng. Giờ xuất phát sớm trước, rồi mã chuyến. */
export function myTripsOf(dtos: readonly DriverTripDto[] | null): MyTrips {
  const inTransit = (dtos ?? [])
    .filter((dto) => dto.status === 'IN_TRANSIT')
    .toSorted((a, b) => (a.departureTime ?? '').localeCompare(b.departureTime ?? '') || a.tripId - b.tripId)
    .map(tripRowOf)
  return { inTransit, loaded: [], preparing: [], recent: [] }
}

type StopPackage = StopPackageDto & { readonly packageId: number }

/** Kiện của điểm, bỏ dòng backend trả không kèm kiện. */
const stopPackagesOf = (dto: CurrentStopDto): StopPackage[] =>
  (dto.packages ?? []).flatMap((pkg) => (pkg.packageId === null ? [] : [{ ...pkg, packageId: pkg.packageId }]))

/** Mã so được: bỏ khoảng trắng hai đầu, không phân biệt hoa thường. */
const normalized = (value: string | null | undefined) => value?.trim().toLocaleUpperCase('vi') ?? ''

/** Mã của bên gửi của kiện, khi chỉ kiện đó của điểm mang nó (nhập file không cấm hai kiện trùng mã của bên gửi). */
function uniqueSenderCode(pkg: StopPackage, packages: readonly StopPackage[]): string | undefined {
  const code = normalized(pkg.packageCode)
  if (code === '') return undefined
  return packages.filter((other) => normalized(other.packageCode) === code).length === 1 ? pkg.packageCode?.trim() : undefined
}

/**
 * Mã đứng đầu dòng kiện — mã tài xế gõ được: mã của bên gửi (in trên nhãn) khi nó duy nhất trong điểm; không thì mã vạch; không có mã
 * vạch thì mã của kho kiện (số in ở góc trên nhãn).
 */
const labelOf = (pkg: StopPackage, packages: readonly StopPackage[]) =>
  uniqueSenderCode(pkg, packages) ?? (pkg.trackingBarcode?.trim() || String(pkg.packageId))

/** Kiện của điểm ứng với mã tài xế gõ. `ambiguous`: mã khớp `count` kiện của điểm — không biết là kiện nào. */
export type StopCodeMatch =
  | { readonly kind: 'matched'; readonly packageId: number; readonly label: string }
  | { readonly kind: 'ambiguous'; readonly count: number }
  | { readonly kind: 'unknown' }

function matchOf(found: readonly StopPackage[], packages: readonly StopPackage[]): StopCodeMatch | undefined {
  const [only] = found
  if (only === undefined) return undefined
  return found.length > 1 ? { kind: 'ambiguous', count: found.length } : { kind: 'matched', packageId: only.packageId, label: labelOf(only, packages) }
}

/**
 * Kiện của điểm ứng với mã tài xế gõ (bỏ khoảng trắng hai đầu, không phân biệt hoa thường), như `resolveVerifyCode` của kho mẫu: trước hết
 * các mã riêng của một kiện — mã QR, mã vạch, mã của kho kiện —; không khớp thì mã của bên gửi, chỉ nhận khi đúng một kiện của điểm mang
 * nó. Backend chưa trả mã QR và mã của bên gửi cho tài xế (`StopPackageDto`): khi thiếu, chỉ còn mã vạch và mã của kho kiện.
 */
export function packageOfCode(dto: CurrentStopDto, code: string): StopCodeMatch {
  const wanted = normalized(code)
  if (wanted === '') return { kind: 'unknown' }
  const packages = stopPackagesOf(dto)
  const byOwnCode = packages.filter((pkg) => [pkg.qrToken, pkg.trackingBarcode, String(pkg.packageId)].some((value) => normalized(value) === wanted))
  const bySenderCode = packages.filter((pkg) => normalized(pkg.packageCode) === wanted)
  return matchOf(byOwnCode, packages) ?? matchOf(bySenderCode, packages) ?? { kind: 'unknown' }
}

/** Mã kiện (dạng chuỗi) của mọi kiện của điểm, bỏ dòng backend trả không kèm kiện. */
export function packageIdsOf(dto: CurrentStopDto): string[] {
  return stopPackagesOf(dto).map((pkg) => String(pkg.packageId))
}

function itemsOf(dto: CurrentStopDto): DeliveryItem[] {
  const packages = stopPackagesOf(dto)
  return (dto.packages ?? []).flatMap((pkg, index): DeliveryItem[] => {
    if (pkg.packageId === null) return []
    const id = String(pkg.packageId)
    const label = labelOf({ ...pkg, packageId: pkg.packageId }, packages)
    return [{ id, packageId: id, label, name: pkg.packageName ?? label, weightKg: pkg.weight ?? undefined, unloadingOrder: pkg.unloadOrder ?? index + 1 }]
  })
}

/** Điểm hiện tại của backend ở dạng màn điểm giao dùng: số điểm, kiện còn phải dỡ, và các điểm của chuyến (chỉ điểm hiện tại có tên). */
export type BackendStop = { readonly stopId: string; readonly view: DeliveryView; readonly stops: readonly StopDelivery[] }

/**
 * Màn điểm giao từ điểm hiện tại của backend. Backend chưa có bước "Đã đến" nên điểm hiện tại luôn dỡ được (`arrivedAt` vẫn trống: không
 * có giờ đến nào để nói); chưa trả kiện nào đã dỡ nên lớp gọi backend đưa vào những kiện nó đã ghi (`unloaded`); chỉ biết điểm hiện tại
 * nên các điểm khác của chuyến chỉ có số, và các điểm trước nó là đã hoàn tất (backend hoàn tất điểm theo thứ tự).
 */
export function stopScreenOf(dto: CurrentStopDto, tripStopCount: number, unloaded: ReadonlySet<string>): BackendStop {
  const number = dto.stopSequence
  const items = itemsOf(dto)
  const stop: StopDelivery = { number, name: dto.stopName ?? '', address: dto.address ?? '', items, kind: 'DELIVERY' }
  const stops = Array.from({ length: Math.max(tripStopCount, number) }, (_, index): StopDelivery =>
    index + 1 === number ? stop : { number: index + 1, name: '', address: '', items: [], kind: 'DELIVERY' })
  const progress = items.map((item): ItemProgress => ({ item, unloaded: unloaded.has(item.id), issue: undefined, returned: false, verification: undefined }))
  const unloadedCount = progress.filter((entry) => entry.unloaded).length
  return {
    stopId: String(dto.stopId),
    stops,
    view: {
      mode: 'delivering',
      stop,
      arrivedAt: undefined,
      items: progress,
      pickupItems: [],
      total: items.length,
      leftAtWarehouse: [],
      unloadedCount,
      issueCount: 0,
      remaining: items.length - unloadedCount,
      verifiable: items.length - unloadedCount,
      pendingConfirms: 0,
      completedStops: new Set(Array.from({ length: number - 1 }, (_, index) => index + 1)),
    },
  }
}
