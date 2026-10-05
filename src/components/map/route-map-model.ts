import type { GeoPoint } from '@/domain/routing'

export type RouteMapPlace = GeoPoint & { readonly name: string }

/** Điểm giao trên bản đồ. `number` là số định danh của điểm (quyết định màu điểm giao), không phải vị trí trong mảng. */
export type RouteMapStop = RouteMapPlace & { readonly id: string; readonly number: number }

/** Xe trên bản đồ. `tag` là nhãn ngắn hiện ngay dưới mốc xe (mã chuyến, nguồn vị trí) — màn Giám sát có nhiều xe cùng lúc. */
export type RouteMapVehicle = RouteMapPlace & { readonly tag?: string }

export type RouteMapData = {
  /** Kho xuất phát; không có thì tuyến bắt đầu từ điểm giao đầu tiên. */
  readonly depot?: RouteMapPlace
  /** Điểm giao **theo thứ tự đi**. */
  readonly stops: readonly RouteMapStop[]
  /** Vị trí xe (giám sát, F6). Không nằm trên đường tuyến. */
  readonly vehicle?: RouteMapVehicle
  /** Xe của các chuyến khác đang chạy (màn Giám sát, FE-6-10): chỉ vị trí, không tuyến, không quyết định khung nhìn. */
  readonly others?: readonly (RouteMapVehicle & { readonly id: string })[]
  /** Đường đi thật khi backend trả polyline; không có thì nối thẳng kho → các điểm theo thứ tự. */
  readonly path?: readonly GeoPoint[]
}

/** Đường tuyến để vẽ: polyline của backend, hoặc các đoạn thẳng kho → điểm giao theo thứ tự. */
export function routeLine({ depot, stops, path }: RouteMapData): readonly GeoPoint[] {
  if (path && path.length > 1) return path
  return depot ? [depot, ...stops] : stops
}

/** Mọi toạ độ cần nằm trong khung nhìn: đường tuyến, kho, điểm giao, xe và xe của các chuyến khác. */
export function routeExtent(data: RouteMapData): readonly GeoPoint[] {
  return [...routeLine(data), ...(data.depot ? [data.depot] : []), ...data.stops, ...(data.vehicle ? [data.vehicle] : []), ...(data.others ?? [])]
}

/** Phần đứng yên của bản đồ — kho, điểm giao, đường tuyến: khung nhìn chỉ canh lại theo phần này, xe chạy không giật khung nhìn. */
export function staticExtent(data: RouteMapData): readonly GeoPoint[] {
  return routeExtent({ ...data, vehicle: undefined, others: undefined })
}

export type RouteMapPin = { readonly key: string; readonly point: GeoPoint; readonly kind: 'depot' | 'stop' | 'vehicle' | 'other'; readonly number?: number; readonly tag?: string }

/** Các mốc của bản đồ, mỗi mốc một khoá ổn định: dữ liệu đổi thì mốc cùng khoá chỉ dời chỗ, không dựng lại. */
export function routePins(data: RouteMapData): RouteMapPin[] {
  return [
    ...(data.depot ? [{ key: 'depot', point: data.depot, kind: 'depot' as const }] : []),
    ...data.stops.map((stop) => ({ key: `stop:${stop.id}`, point: stop, kind: 'stop' as const, number: stop.number })),
    ...(data.others ?? []).map((other) => ({ key: `other:${other.id}`, point: other, kind: 'other' as const, tag: other.tag })),
    ...(data.vehicle ? [{ key: 'vehicle', point: data.vehicle, kind: 'vehicle' as const, tag: data.vehicle.tag }] : []),
  ]
}

export type Size = { readonly width: number; readonly height: number; readonly padding: number }
export type SketchPoint = { readonly x: number; readonly y: number }

/**
 * Chiếu toạ độ địa lý lên khung SVG cho sơ đồ thay thế (không WebGL): phép chiếu trụ cách đều quanh vĩ độ giữa (kinh độ co theo
 * cos vĩ độ), co đều hai chiều cho vừa khung trừ lề, căn giữa; bắc ở trên. `extent` là tập điểm quyết định tỷ lệ; không có thì dùng
 * chính `points`. Mọi điểm trùng nhau thì nằm giữa khung.
 */
export function projectToSketch(points: readonly GeoPoint[], size: Size, extent: readonly GeoPoint[] = points): SketchPoint[] {
  if (extent.length === 0) return []
  const lats = extent.map((point) => point.lat)
  const lngs = extent.map((point) => point.lng)
  const [south, north, west, east] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)]
  const shrink = Math.cos((((south + north) / 2) * Math.PI) / 180)
  const spanX = (east - west) * shrink
  const spanY = north - south
  const innerWidth = size.width - size.padding * 2
  const innerHeight = size.height - size.padding * 2
  const scale = Math.min(spanX > 0 ? innerWidth / spanX : Infinity, spanY > 0 ? innerHeight / spanY : Infinity)
  const unit = Number.isFinite(scale) ? scale : 0
  const offsetX = size.padding + (innerWidth - spanX * unit) / 2
  const offsetY = size.padding + (innerHeight - spanY * unit) / 2
  return points.map((point) => ({
    x: offsetX + (point.lng - west) * shrink * unit,
    y: offsetY + (north - point.lat) * unit,
  }))
}
