import { expandPackages } from '@/domain/cargo'
import type { OptimizationRequest } from '@/domain/models'
import { routeEta, simulateVehicle, type DeadlineStatus, type GeoPoint } from '@/domain/routing'
import { stopZones } from '@/domain/zones'
import { LANDING_REQUEST } from '../landing-sample.mock'
import { ROLES_LOADED_STOPS, ROLES_ROUTE, ROLES_STOP_ORDER, ROLES_VIEW_AT } from './roles-sample.mock'

/** Bốn vai trò của một chuyến, theo thứ tự tab; mỗi vai trò một loại thiết bị. */
export const ROLE_TABS = ['dispatcher', 'warehouse', 'driver', 'companyManager'] as const
export type RoleTab = (typeof ROLE_TABS)[number]

export type RoleDevice = 'laptop' | 'tablet' | 'phone'

export const ROLE_DEVICE: Readonly<Record<RoleTab, RoleDevice>> = {
  dispatcher: 'laptop',
  warehouse: 'tablet',
  driver: 'phone',
  companyManager: 'laptop',
}

/** Hai vai trò có ứng dụng di động riêng. */
export const MOBILE_APP_ROLES: readonly RoleTab[] = ['warehouse', 'driver']

/** Toạ độ đã chiếu vào hộp 0–1 (x sang phải theo kinh độ, y xuống dưới theo vĩ độ). */
export type UnitPoint = { readonly x: number; readonly y: number }

export type RoleStop = {
  /** Số điểm giao, đếm từ 1 theo thứ tự đi. */
  readonly number: number
  /** Giờ đến dự kiến, ISO 8601 (UTC) — kết quả của `routeEta`. */
  readonly eta: string
  readonly deadline: string
  readonly status: DeadlineStatus
  readonly at: UnitPoint
}

export type RoleRoute = {
  readonly departureTime: string
  readonly stops: readonly RoleStop[]
  readonly depot: UnitPoint
  readonly vehicle: UnitPoint
  /** Số điểm giao xe đang tới. */
  readonly headingTo: number
  readonly totalKm: number
  readonly totalMinutes: number
  /** 0 khi tuyến không có chặng nào dài tới mức phải nghỉ. */
  readonly restCount: number
  readonly restMinutes: number
  readonly lateCount: number
}

/** Phần tử thứ `index`; thiếu là dữ liệu mẫu hỏng — lỗi bất biến cho lập trình viên. */
function at<T>(items: readonly T[], index: number): T {
  const item = items[index]
  if (item === undefined) throw new Error(`Dữ liệu mẫu thiếu phần tử thứ ${index}`)
  return item
}

/**
 * Chiếu các điểm vào hộp đơn vị, mỗi trục giãn hết hộp: đây là **sơ đồ** tuyến (thứ tự và vị trí tương đối), không phải bản đồ theo tỉ
 * lệ. Mọi điểm trùng một kinh độ (hoặc vĩ độ) thì nằm giữa trục đó.
 */
export function projectPoints(points: readonly GeoPoint[]): UnitPoint[] {
  const lats = points.map((point) => point.lat)
  const lngs = points.map((point) => point.lng)
  const [south, north] = [Math.min(...lats), Math.max(...lats)]
  const [west, east] = [Math.min(...lngs), Math.max(...lngs)]
  return points.map((point) => ({
    x: east === west ? 0.5 : (point.lng - west) / (east - west),
    y: north === south ? 0.5 : (north - point.lat) / (north - south),
  }))
}

/** Tuyến mẫu đã tính: giờ đến và mức hạn của từng điểm, tổng quãng đường và thời gian, giờ nghỉ bắt buộc, vị trí xe mô phỏng lúc xem. */
export function roleRoute(): RoleRoute {
  const result = routeEta(ROLES_ROUTE, ROLES_STOP_ORDER)
  const vehicle = simulateVehicle(
    {
      depot: ROLES_ROUTE.depot,
      departureTime: ROLES_ROUTE.departureTime,
      stops: ROLES_ROUTE.stops.map(({ stopId, location }) => ({ stopId, location })),
    },
    ROLES_VIEW_AT,
  )
  const points = projectPoints([ROLES_ROUTE.depot, vehicle, ...ROLES_ROUTE.stops.map((stop) => stop.location)])
  const stops = ROLES_ROUTE.stops.map((stop, index): RoleStop => {
    const computed = result.stops.find((item) => item.stopId === stop.stopId)
    if (!computed?.deadlineStatus || stop.deadline === undefined) throw new Error(`Điểm ${stop.stopId} của tuyến mẫu thiếu hạn giao`)
    return { number: index + 1, eta: computed.eta, deadline: stop.deadline, status: computed.deadlineStatus, at: at(points, index + 2) }
  })
  return {
    departureTime: ROLES_ROUTE.departureTime,
    stops,
    depot: at(points, 0),
    vehicle: at(points, 1),
    headingTo: ROLES_STOP_ORDER.findIndex((id) => id === vehicle.stopId) + 1,
    totalKm: result.totalKm,
    totalMinutes: result.totalMinutes,
    restCount: result.restCount ?? 0,
    restMinutes: result.restMinutes ?? 0,
    lateCount: result.missedStopIds.length,
  }
}

export type CargoLine = {
  readonly id: string
  /** Điểm giao của dòng kiện. */
  readonly stop: number
  readonly quantity: number
  readonly lengthCm: number
  readonly widthCm: number
  readonly heightCm: number
  readonly weightKg: number
  /** Khối lượng cả dòng, kg. */
  readonly totalKg: number
}

/** Vùng của một điểm giao dọc lòng thùng, theo phần của chiều dài thùng (0 = vách trước, 1 = cửa sau). */
export type CargoZone = { readonly stop: number; readonly start: number; readonly end: number }

export type RoleCargo = {
  /** Theo thứ tự điểm giao. */
  readonly lines: readonly CargoLine[]
  readonly packageCount: number
  readonly stopCount: number
  readonly totalKg: number
  readonly payloadKg: number
  /** Tổng khối lượng hàng trên tải trọng xe, 0–1. */
  readonly payloadRatio: number
  /** Vùng theo điểm giao của `stopZones` (`@/domain/zones`) trên thùng của chuyến mẫu: điểm 1 sát cửa, điểm cuối sát vách trước. */
  readonly zones: readonly CargoZone[]
  /** Màn kho: số kiện đã lên xe (hàng của các điểm cuối tuyến xếp trước) và dòng kiện đang xếp. */
  readonly loadedCount: number
  readonly loadingLine: CargoLine
  /** Mã instance của kiện đang xếp (`expandPackages`): kiện đầu của dòng đang xếp. */
  readonly loadingId: string
  /** Màn tài xế: dòng kiện của điểm giao đầu tiên và mã ba kiện đầu của nó. */
  readonly firstStopLine: CargoLine
  readonly firstStopIds: readonly string[]
}

/** Chỗ của vùng một điểm giao trong thùng, cùng luật với thẻ kiện ở màn kho (`zonePlace`): vùng đầu sát cửa, vùng cuối sát vách trước. */
export function zonePlaceOf(stop: number, stopCount: number): 'door' | 'middle' | 'front' | 'whole' {
  if (stopCount === 1) return 'whole'
  return stop === 1 ? 'door' : stop === stopCount ? 'front' : 'middle'
}

/** Số của chuyến mẫu mà ba màn còn lại dùng — đếm thẳng từ request của chuyến mẫu, không số nào nhập tay. */
export function roleCargo(request: OptimizationRequest = LANDING_REQUEST, loadedStops: number = ROLES_LOADED_STOPS): RoleCargo {
  const lines = request.packages
    .map((line): CargoLine => ({
      id: line.id,
      stop: line.deliveryStop,
      quantity: line.quantity,
      lengthCm: line.lengthCm,
      widthCm: line.widthCm,
      heightCm: line.heightCm,
      weightKg: line.weightKg,
      totalKg: line.quantity * line.weightKg,
    }))
    .toSorted((a, b) => a.stop - b.stop)
  const totalKg = lines.reduce((sum, line) => sum + line.totalKg, 0)
  const payloadKg = request.vehicle.maxPayloadKg
  // Kho xếp ngược thứ tự giao: điểm cuối tuyến lên xe trước.
  const loadOrder = lines.toReversed()
  const loadingLine = at(loadOrder, Math.min(loadedStops, loadOrder.length - 1))
  const firstStopLine = at(lines, 0)
  const lengthCm = request.vehicle.innerLengthCm
  const zones = stopZones(request.vehicle, lines.map((line) => ({
    stopId: line.stop,
    volumeCm3: line.quantity * line.lengthCm * line.widthCm * line.heightCm,
  })))
  const ids = instanceIds(request)
  return {
    lines,
    packageCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    stopCount: new Set(lines.map((line) => line.stop)).size,
    totalKg,
    payloadKg,
    payloadRatio: totalKg / payloadKg,
    zones: zones.map((zone) => ({ stop: zone.stopId, start: zone.startXCm / lengthCm, end: zone.endXCm / lengthCm })),
    loadedCount: loadOrder.slice(0, loadedStops).reduce((sum, line) => sum + line.quantity, 0),
    loadingLine,
    loadingId: ids.get(loadingLine.id)?.[0] ?? loadingLine.id,
    firstStopLine,
    firstStopIds: (ids.get(firstStopLine.id) ?? []).slice(0, 3),
  }
}

/** Mã instance của từng dòng kiện, đúng dạng ứng dụng sinh (`SKU-A-01`). */
function instanceIds(request: OptimizationRequest): ReadonlyMap<string, readonly string[]> {
  const { instances, packageIdByInstanceId } = expandPackages(request.packages)
  const byLine = new Map<string, string[]>()
  for (const { packageInstanceId } of instances) {
    const lineId = packageIdByInstanceId.get(packageInstanceId) ?? packageInstanceId
    byLine.set(lineId, [...(byLine.get(lineId) ?? []), packageInstanceId])
  }
  return byLine
}

/** Tách phút thành giờ và phút cho câu "10 giờ 22 phút". */
export function hoursMinutes(totalMinutes: number): { hours: number; minutes: number } {
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 }
}
