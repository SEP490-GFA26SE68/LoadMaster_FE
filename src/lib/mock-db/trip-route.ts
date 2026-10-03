import type { CargoPackage } from '@/domain/models'
import { optimizeRoute, routeEta, type RouteInput } from '@/domain/routing'
import { REQUIREMENT_PRIORITIES } from './requirement-model'
import type { TripRoutePlan } from './source-types'
import type { DeliveryStop, Trip } from './types'

/**
 * Tuyến của chuyến (FE-4b-09, D-76) — hàm thuần nối chuyến với mock tối ưu tuyến `@/domain/routing`. Mock không kiểm toạ độ: nơi gọi
 * phải chặn điểm chưa có toạ độ trước (`stopsWithoutCoordinates`).
 */

type Routed = Pick<Trip, 'stops' | 'depot' | 'departureAt'>

/** Điểm giao chưa có toạ độ, kèm số điểm (1-based). */
export function stopsWithoutCoordinates(stops: readonly DeliveryStop[]): { stopId: string; number: number }[] {
  return stops.flatMap((stop, index) => (stop.lat === undefined || stop.lng === undefined ? [{ stopId: stop.id, number: index + 1 }] : []))
}

/** Đầu vào của mock: kho đi, giờ xuất phát và các điểm; ưu tiên của điểm thành số theo D-93 (Khẩn 4 · Cao 3 · Bình thường 2 · Thấp 1). */
function routeInput({ stops, depot, departureAt }: Routed): RouteInput {
  return {
    depot: { lat: depot.lat, lng: depot.lng },
    departureTime: departureAt,
    stops: stops.map((stop) => {
      if (stop.lat === undefined || stop.lng === undefined) throw new Error(`Điểm giao ${stop.id} chưa có toạ độ`)
      return {
        stopId: stop.id,
        location: { lat: stop.lat, lng: stop.lng },
        ...(stop.deadline === undefined ? {} : { deadline: stop.deadline }),
        ...(stop.priority === undefined ? {} : { priority: REQUIREMENT_PRIORITIES.indexOf(stop.priority) + 1 }),
      }
    }),
  }
}

/** Thứ tự đi của mock tối ưu tuyến: mã điểm giao, điểm đi trước đứng trước. */
export function optimizedStopOrder(trip: Routed): string[] {
  return [...optimizeRoute(routeInput(trip)).orderedStopIds]
}

type PlanMeta = Pick<TripRoutePlan, 'optimizedAt' | 'optimizedBy'>

/** Giờ đến dự kiến và mức hạn của từng điểm theo **thứ tự điểm hiện tại** của chuyến. */
export function routePlanOf(trip: Routed, meta: PlanMeta): TripRoutePlan {
  const result = routeEta(routeInput(trip), trip.stops.map((stop) => stop.id))
  return {
    stops: result.stops.map((stop) => ({ ...stop })),
    missedStopIds: [...result.missedStopIds],
    totalKm: result.totalKm,
    totalMinutes: result.totalMinutes,
    optimizedAt: meta.optimizedAt,
    optimizedBy: meta.optimizedBy,
    isMockResult: true,
  }
}

/**
 * Điểm giao xếp lại theo `orderedStopIds`, dòng kiện đánh số `deliveryStop` lại theo vị trí mới. `changed` là `false` khi thứ tự không
 * đổi — khi đó trả lại chính hai mảng đã nhận.
 */
export function reorderStops<S extends DeliveryStop, P extends CargoPackage>(
  stops: readonly S[], packages: readonly P[], orderedStopIds: readonly string[],
): { stops: readonly S[]; packages: readonly P[]; changed: boolean } {
  if (orderedStopIds.every((id, index) => stops[index]?.id === id)) return { stops, packages, changed: false }
  const byId = new Map(stops.map((stop) => [stop.id, stop]))
  const numberAfter = new Map(stops.map((stop, index) => [index + 1, orderedStopIds.indexOf(stop.id) + 1]))
  return {
    stops: orderedStopIds.flatMap((id) => byId.get(id) ?? []),
    packages: packages.map((pkg) => ({ ...pkg, deliveryStop: numberAfter.get(pkg.deliveryStop) ?? pkg.deliveryStop })),
    changed: true,
  }
}

/**
 * Giữ `routePlan` khớp chuyến sau một lần ghi (PRD v2 mục 7.1): **thêm hoặc bớt điểm giao** sau khi đã tối ưu tuyến — hoặc một điểm
 * mất toạ độ — thì bỏ tuyến, chuyến về Nháp; đổi thứ tự điểm, giờ xuất phát, kho đi, toạ độ hay hạn thì tính lại giờ đến và mức hạn,
 * chuyến vẫn Đã lập kế hoạch. Chuyến chưa tối ưu tuyến thì trả lại nguyên.
 */
export function withFreshRoute(trip: Trip): Trip {
  const { routePlan, ...rest } = trip
  if (!routePlan) return trip
  const planned = new Set(routePlan.stops.map((stop) => stop.stopId))
  const sameStops = planned.size === trip.stops.length && trip.stops.every((stop) => planned.has(stop.id))
  if (!sameStops || stopsWithoutCoordinates(trip.stops).length > 0) return rest
  return { ...rest, routePlan: routePlanOf(trip, routePlan) }
}
