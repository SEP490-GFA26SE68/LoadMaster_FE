import type { GeoPoint } from '@/domain/routing'

export type RouteMapPlace = GeoPoint & { readonly name: string }

/** Điểm giao trên bản đồ. `number` là số định danh của điểm (quyết định màu điểm giao), không phải vị trí trong mảng. */
export type RouteMapStop = RouteMapPlace & { readonly id: string; readonly number: number }

export type RouteMapData = {
  /** Kho xuất phát; không có thì tuyến bắt đầu từ điểm giao đầu tiên. */
  readonly depot?: RouteMapPlace
  /** Điểm giao **theo thứ tự đi**. */
  readonly stops: readonly RouteMapStop[]
  /** Vị trí xe (giám sát, F6). Không nằm trên đường tuyến. */
  readonly vehicle?: RouteMapPlace
  /** Đường đi thật khi backend trả polyline; không có thì nối thẳng kho → các điểm theo thứ tự. */
  readonly path?: readonly GeoPoint[]
}

/** Đường tuyến để vẽ: polyline của backend, hoặc các đoạn thẳng kho → điểm giao theo thứ tự. */
export function routeLine({ depot, stops, path }: RouteMapData): readonly GeoPoint[] {
  if (path && path.length > 1) return path
  return depot ? [depot, ...stops] : stops
}

/** Mọi toạ độ cần nằm trong khung nhìn: đường tuyến, kho, điểm giao và xe. */
export function routeExtent(data: RouteMapData): readonly GeoPoint[] {
  return [...routeLine(data), ...(data.depot ? [data.depot] : []), ...data.stops, ...(data.vehicle ? [data.vehicle] : [])]
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
