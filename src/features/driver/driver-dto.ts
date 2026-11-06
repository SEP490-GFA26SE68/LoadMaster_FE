import { isoFromBackend } from '@/lib/backend-time'
import type { DeliveryView, PickupItemProgress } from './delivery-progress'
import { itemProgressOf } from './driver-item-progress'
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
  /** Kho đã hoàn tất xếp hàng (phiên xếp `COMPLETED`): chỉ khi đó tài xế xuất phát được. */
  readonly loadingCompleted?: boolean | null
}

export type StopPackageDto = {
  readonly packageId: number | null
  readonly packageName: string | null
  readonly trackingBarcode: string | null
  /** Mã của bên gửi và mã QR in trên nhãn — tài xế quét hoặc gõ được cả hai. */
  readonly packageCode?: string | null
  readonly qrToken?: string | null
  readonly weight: number | null
  readonly unloadOrder: number | null
  /** Kiện đã dỡ ở điểm này (máy chủ đọc từ các lần xác nhận dỡ): tải lại trang vẫn đúng. */
  readonly unloaded?: boolean | null
  /** `LocalDateTime` (giờ Việt Nam) lúc dỡ; `null` khi chưa dỡ. */
  readonly unloadedAt?: string | null
  /** Sự cố mới nhất tài xế báo cho kiện ở điểm này: `DAMAGED`, `MISSING`, `REFUSED`, `OTHER`. */
  readonly issueKind?: string | null
  readonly issueNote?: string | null
  /** Xác nhận tay mới nhất của kiện ở điểm này: `PENDING`, `APPROVED`, `REJECTED`. */
  readonly manualStatus?: string | null
  /** Lý do tài xế chọn khi xác nhận tay: `LABEL_DAMAGED`, `QR_UNREADABLE`, `OTHER`. */
  readonly manualReason?: string | null
  /** Lý do điều phối viên ghi khi từ chối xác nhận tay. */
  readonly manualRejectReason?: string | null
  /** Kiện nhận dọc đường: yêu cầu nhận của kiện (ở điểm nhận, và ở điểm giao của kiện đó). */
  readonly pickupRequestId?: number | null
  /** Điểm nhận: kiện đã đối chiếu lên xe chưa. */
  readonly picked?: boolean | null
}

/** `GET /api/driver/trips/{id}/current-stop` — điểm chưa hoàn tất đầu tiên và kiện của điểm đó theo thứ tự dỡ. */
export type CurrentStopDto = {
  readonly stopId: number
  readonly stopSequence: number
  readonly stopName: string | null
  readonly address: string | null
  /** `PENDING`, `ARRIVED` hoặc `COMPLETED`. */
  readonly status?: string | null
  /** Giờ đến thật (`LocalDateTime`, giờ Việt Nam); `null` khi chưa báo đến. */
  readonly actualArrival?: string | null
  readonly packages: readonly StopPackageDto[] | null
  /** `DELIVERY` hoặc `PICKUP` (điểm nhận dọc đường chèn lúc duyệt); máy chủ cũ không trả thì là điểm giao. */
  readonly stopType?: string | null
  /** Điểm nhận: kiện phải đối chiếu lên xe (của các yêu cầu đã duyệt ở điểm này); điểm giao: rỗng. */
  readonly pickupPackages?: readonly StopPackageDto[] | null
}

/** `POST /api/driver/packages/{id}/unload` — `remainingPackagesCount` là số kiện của điểm còn chưa dỡ. */
export type ConfirmUnloadDto = { readonly packageId: number; readonly remainingPackagesCount: number | null }

/** `POST /api/driver/stops/{id}/arrive` — `actualArrival` là `LocalDateTime` (giờ Việt Nam). */
export type ArriveStopDto = { readonly stopId: number; readonly actualArrival: string | null }

/** `POST /api/driver/stops/{id}/complete` */
export type CompleteStopDto = { readonly tripCompleted: boolean | null }

/** `POST /api/driver/location` — `recordedAt` là ISO 8601 (UTC). */
export type LocationPointDto = { readonly recordedAt: string }

/** Ngày chạy `YYYY-MM-DD` của giờ xuất phát kiểu `LocalDateTime` (giờ Việt Nam, nên ngày đọc thẳng); rỗng hoặc sai dạng thì `undefined`. */
export function departureDateOf(value: string | null): string | undefined {
  return /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}/.exec(value?.trim() ?? '')?.[1]
}

/**
 * Một chuyến của "Chuyến của tôi": backend chưa có tên tuyến, số kiện, điểm đang giao, sự cố — để trống. Chuyến Đang xếp hàng mà kho đã
 * xếp xong (`loadingCompleted`) mang dòng phụ "Xếp xong — chờ xuất phát".
 */
export function tripRowOf(dto: DriverTripDto, status: 'IN_TRANSIT' | 'LOADING' = 'IN_TRANSIT'): MyTripRow {
  const id = String(dto.tripId)
  return {
    id,
    code: dto.tripCode ?? id,
    name: undefined,
    scheduledDate: departureDateOf(dto.departureTime),
    vehicleName: dto.vehicleLicensePlate ?? '',
    status,
    sub: status === 'LOADING' && dto.loadingCompleted === true ? { kind: 'loaded' } : null,
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

const byDeparture = (a: DriverTripDto, b: DriverTripDto) => (a.departureTime ?? '').localeCompare(b.departureTime ?? '') || a.tripId - b.tripId

/**
 * Chuyến của tài xế theo backend: Đang vận chuyển; Đang xếp hàng mà kho đã xếp xong ở nhóm "Xếp xong — chờ xuất phát" (tài xế xuất phát ở
 * thẻ); Đang xếp hàng mà kho chưa xong ở nhóm "Kho đang soạn / xếp". Chuyến khác (chưa tới kho, đã giao, đã huỷ) không hiện. Giờ xuất phát
 * sớm trước, rồi mã chuyến.
 */
export function myTripsOf(dtos: readonly DriverTripDto[] | null): MyTrips {
  const of = (status: 'IN_TRANSIT' | 'LOADING', keep: (dto: DriverTripDto) => boolean = () => true) =>
    (dtos ?? []).filter((dto) => dto.status === status && keep(dto)).toSorted(byDeparture).map((dto) => tripRowOf(dto, status))
  const loaded = (dto: DriverTripDto) => dto.loadingCompleted === true
  return { inTransit: of('IN_TRANSIT'), loaded: of('LOADING', loaded), preparing: of('LOADING', (dto) => !loaded(dto)), recent: [] }
}

type StopPackage = StopPackageDto & { readonly packageId: number }

/** Bỏ dòng backend trả không kèm kiện. */
const withId = (rows: readonly StopPackageDto[] | null | undefined): StopPackage[] =>
  (rows ?? []).flatMap((pkg) => (pkg.packageId === null ? [] : [{ ...pkg, packageId: pkg.packageId }]))

/** Điểm nhận dọc đường: việc ở đây là đối chiếu kiện nhận lên xe, không dỡ kiện nào. */
const isPickupStop = (dto: CurrentStopDto): boolean => dto.stopType === 'PICKUP'

/** Kiện nhận phải đối chiếu lên xe ở điểm này (chỉ điểm nhận có). */
const pickupPackagesOf = (dto: CurrentStopDto): StopPackage[] => (isPickupStop(dto) ? withId(dto.pickupPackages) : [])

/** Kiện đối chiếu được ở điểm: kiện cần dỡ và kiện nhận lên xe. */
const stopPackagesOf = (dto: CurrentStopDto): StopPackage[] => [...withId(dto.packages), ...pickupPackagesOf(dto)]

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
 * nó. Mã QR quét bằng camera hay gõ tay đều so không phân biệt hoa thường (mã QR của máy chủ là chữ thường); máy chủ không trả mã QR, mã
 * của bên gửi thì chỉ còn mã vạch và mã của kho kiện.
 */
export function packageOfCode(dto: CurrentStopDto, code: string): StopCodeMatch {
  const wanted = normalized(code)
  if (wanted === '') return { kind: 'unknown' }
  const packages = stopPackagesOf(dto)
  const byOwnCode = packages.filter((pkg) => [pkg.qrToken, pkg.trackingBarcode, String(pkg.packageId)].some((value) => normalized(value) === wanted))
  const bySenderCode = packages.filter((pkg) => normalized(pkg.packageCode) === wanted)
  return matchOf(byOwnCode, packages) ?? matchOf(bySenderCode, packages) ?? { kind: 'unknown' }
}

/** Kiện `packageId` là kiện nhận phải đối chiếu lên xe ở điểm nhận này (không phải kiện cần dỡ). */
export function isPickupPackage(dto: CurrentStopDto, packageId: number): boolean {
  return pickupPackagesOf(dto).some((pkg) => pkg.packageId === packageId)
}

/** Kiện `packageId` của điểm đã xong theo lần đọc gần nhất của máy chủ: đã dỡ, hoặc — kiện nhận ở điểm nhận — đã lên xe. */
export function isUnloaded(dto: CurrentStopDto, packageId: number): boolean {
  return (dto.packages ?? []).some((pkg) => pkg.packageId === packageId && pkg.unloaded === true)
    || pickupPackagesOf(dto).some((pkg) => pkg.packageId === packageId && pkg.picked === true)
}

/** Điểm sau khi máy chủ nhận lệnh dỡ (hoặc nhận lên xe) kiện `packageId` — giữ tới lần đọc lại kế tiếp. */
export function withUnloaded(dto: CurrentStopDto, packageId: number): CurrentStopDto {
  return {
    ...dto,
    packages: (dto.packages ?? []).map((pkg) => (pkg.packageId === packageId ? { ...pkg, unloaded: true } : pkg)),
    pickupPackages: (dto.pickupPackages ?? []).map((pkg) => (pkg.packageId === packageId ? { ...pkg, picked: true } : pkg)),
  }
}

/** Kiện nhận của điểm nhận ở dạng màn dùng: tên là mã của bên gửi, xong khi đã lên xe. */
function pickupItemsOf(dto: CurrentStopDto): PickupItemProgress[] {
  return pickupPackagesOf(dto).map((pkg) => ({
    item: {
      id: String(pkg.packageId),
      name: pkg.packageName ?? pkg.packageCode ?? String(pkg.packageId),
      weightKg: pkg.weight ?? 0,
      requestId: pkg.pickupRequestId === null || pkg.pickupRequestId === undefined ? '' : String(pkg.pickupRequestId),
      role: 'pick',
    },
    done: pkg.picked === true,
    verification: undefined,
  }))
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
 * Giờ đến của điểm: chỉ giờ máy chủ ghi khi tài xế bấm "Đã đến". Máy chủ đòi giờ đó mới cho dỡ, nên trạng thái `ARRIVED` không kèm giờ vẫn là
 * chưa đến.
 */
function arrivalOf(dto: CurrentStopDto): Pick<DeliveryView, 'arrivedAt'> {
  return { arrivedAt: dto.actualArrival ? isoFromBackend(dto.actualArrival) : undefined }
}

/**
 * Màn điểm giao từ điểm hiện tại của backend: giờ đến và kiện đã dỡ đọc từ máy chủ (`actualArrival`, `packages[].unloaded`), nên tải lại
 * trang hay mở ở máy khác vẫn đúng. Chỉ biết điểm hiện tại nên các điểm khác của chuyến chỉ có số, và các điểm trước nó là đã hoàn tất
 * (backend hoàn tất điểm theo thứ tự).
 */
export function stopScreenOf(dto: CurrentStopDto, tripStopCount: number): BackendStop {
  const number = dto.stopSequence
  const items = itemsOf(dto)
  const packageById = new Map(withId(dto.packages).map((pkg) => [String(pkg.packageId), pkg]))
  const pickupItems = pickupItemsOf(dto)
  const stop: StopDelivery = {
    number,
    name: dto.stopName ?? '',
    address: dto.address ?? '',
    items,
    kind: isPickupStop(dto) ? 'PICKUP' : 'DELIVERY',
    pickupItems: pickupItems.map((entry) => entry.item),
  }
  const stops = Array.from({ length: Math.max(tripStopCount, number) }, (_, index): StopDelivery =>
    index + 1 === number ? stop : { number: index + 1, name: '', address: '', items: [], kind: 'DELIVERY' })
  const progress = items.map((item) => itemProgressOf(item, packageById.get(item.id), number))
  const pickupWaiting = pickupItems.filter((entry) => !entry.done).length
  const unloadedCount = progress.filter((entry) => entry.unloaded).length + pickupItems.length - pickupWaiting
  const issueCount = progress.filter((entry) => entry.issue !== undefined).length
  // Kiện chưa dỡ mà đã báo sự cố không phải dỡ (máy chủ hoàn tất điểm thì kiện đó là hoàn trả)
  const remaining = progress.filter((entry) => !entry.unloaded && entry.issue === undefined).length + pickupWaiting
  const verifiable = progress.filter((entry) => !entry.unloaded && !entry.returned).length + pickupWaiting
  const pendingConfirms = progress.filter((entry) => entry.unloaded && entry.verification?.manual?.status === 'MANUAL_PENDING').length
  return {
    stopId: String(dto.stopId),
    stops,
    view: {
      mode: 'delivering',
      stop,
      ...arrivalOf(dto),
      items: progress,
      pickupItems,
      total: items.length + pickupItems.length,
      leftAtWarehouse: [],
      unloadedCount,
      issueCount,
      remaining,
      verifiable,
      pendingConfirms,
      completedStops: new Set(Array.from({ length: number - 1 }, (_, index) => index + 1)),
    },
  }
}
