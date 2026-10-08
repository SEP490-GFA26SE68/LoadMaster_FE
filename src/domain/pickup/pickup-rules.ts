import { gt } from '@/domain/geometry'
import { deadlineStatus, liveEta, type GeoPoint, type LiveEtaStop } from '@/domain/routing'
import { insertPickupStops } from './insert-stops'
import {
  axleRule, blockingRule, centerOfGravityRule, freedSpaceRule, handlingClassRule, payloadRule, stackingRule,
} from './load-rules'
import { currentStopIndex, locateOnPath, protectedStopIndex } from './route-path'
import { PICKUP_CONSTANTS, type PickupContext, type PickupRuleResult } from './types'

/** Mã điểm tạm của điểm nhận và điểm giao khi tính ETA sau khi chèn; không ra ngoài hàm này. */
const NEW_PICKUP_STOP_ID = '$pickup'
const NEW_DELIVERY_STOP_ID = '$delivery'

const noStop = (rule: 1 | 2 | 9): PickupRuleResult => ({ rule, passed: false, code: 'PICKUP_NO_REMAINING_STOP', params: {} })

/** Luật 1: điểm nhận cách tuyến còn lại của xe (vị trí xe → các điểm chưa hoàn tất) tối đa 10 km, và nằm phía trước vị trí xe. */
function routeRule({ request, position, stops }: PickupContext): PickupRuleResult {
  const current = currentStopIndex(stops)
  if (current < 0) return noStop(1)
  const route = [position, ...stops.slice(current).map((stop) => stop.location)]
  const { distanceKm, progressKm } = locateOnPath(route, request.pickup)
  const params = { distanceKm: Math.round(distanceKm * 100) / 100, maxKm: PICKUP_CONSTANTS.MAX_ROUTE_DISTANCE_KM }
  const code = gt(distanceKm, PICKUP_CONSTANTS.MAX_ROUTE_DISTANCE_KM) ? 'PICKUP_OFF_ROUTE' : progressKm < 0 ? 'PICKUP_BEHIND_VEHICLE' : 'PICKUP_ON_ROUTE'
  return { rule: 1, passed: code === 'PICKUP_ON_ROUTE', code, params }
}

/**
 * Luật 2: điểm giao nằm sau điểm hiện tại và không vượt quá điểm được bảo vệ (điểm kế tiếp còn hàng trên xe; được trùng điểm đó). Đo
 * bằng tiến độ của điểm giao dọc đường từ điểm hiện tại qua các điểm còn lại; không có điểm được bảo vệ thì chỉ cần sau điểm hiện tại.
 * Điểm hiện tại là điểm cuối của tuyến: sau nó không còn đoạn đường nào để đo và không còn hàng nào để chắn — điểm giao nào cũng đạt.
 */
function deliveryRule({ request, stops }: PickupContext): PickupRuleResult {
  const current = currentStopIndex(stops)
  if (current < 0) return noStop(2)
  if (current === stops.length - 1) return { rule: 2, passed: true, code: 'PICKUP_DELIVERY_IN_RANGE', params: {} }
  const route = stops.slice(current).map((stop) => stop.location)
  const { progressKm, vertexKm } = locateOnPath(route, request.delivery)
  const protectedIndex = protectedStopIndex(stops, current)
  const limitKm = protectedIndex < 0 ? Number.POSITIVE_INFINITY : (vertexKm[protectedIndex - current] as number)
  const code = !gt(progressKm, 0) ? 'PICKUP_DELIVERY_NOT_AFTER_CURRENT' : gt(progressKm, limitKm) ? 'PICKUP_DELIVERY_BEYOND_PROTECTED' : 'PICKUP_DELIVERY_IN_RANGE'
  return { rule: 2, passed: code === 'PICKUP_DELIVERY_IN_RANGE', code, params: protectedIndex < 0 ? {} : { protectedStopId: stops[protectedIndex]?.stopId ?? '' } }
}

/** Luật 9: ETA tới điểm giao, tính từ vị trí xe theo tuyến **sau khi chèn**, không muộn hơn hạn của yêu cầu. */
function deadlineRule(context: PickupContext): PickupRuleResult {
  const { request, stops, position, at } = context
  const inserted = insertPickupStops(stops, { pickupStopId: NEW_PICKUP_STOP_ID, deliveryStopId: NEW_DELIVERY_STOP_ID }, request.delivery)
  if (inserted === null) return noStop(9)
  if (request.deadline === undefined) return { rule: 9, passed: true, code: 'PICKUP_NO_DEADLINE', params: {} }

  const known = new Map<string, LiveEtaStop>(stops.map((stop) => [stop.stopId, { stopId: stop.stopId, location: stop.location, ...(stop.deadline === undefined ? {} : { deadline: stop.deadline }), ...(stop.arrivedAt === undefined ? {} : { arrivedAt: stop.arrivedAt }) }]))
  const added: [string, GeoPoint][] = [[NEW_PICKUP_STOP_ID, request.pickup], [NEW_DELIVERY_STOP_ID, request.delivery]]
  const completed = new Set(stops.filter((stop) => stop.completed).map((stop) => stop.stopId))
  const route = inserted.orderedStopIds
    .filter((stopId) => !completed.has(stopId))
    .map((stopId) => known.get(stopId) ?? { stopId, location: added.find(([id]) => id === stopId)?.[1] as GeoPoint })
  const eta = liveEta({ position, at, stops: route }).find((item) => item.stopId === inserted.deliveryStopId)?.eta ?? at
  const passed = deadlineStatus(eta, request.deadline) !== 'MISSED'
  return { rule: 9, passed, code: passed ? 'PICKUP_DEADLINE_OK' : 'PICKUP_DEADLINE_MISSED', params: { eta, deadline: request.deadline } }
}

/**
 * Mười luật nhận hàng dọc đường (FE-7-02, D-88), theo thứ tự luật 1 → 10: mỗi luật một kết quả Đạt / Không đạt kèm mã và tham số. Luật
 * 4–7 và 10 đọc kết quả xếp kiện nhận vào vùng trống (`context.packing`, FE-BL-01). Mọi luật luôn được đánh giá — luật trước không đạt
 * không bỏ qua luật sau.
 */
export function evaluatePickup(context: PickupContext): PickupRuleResult[] {
  return [
    routeRule(context), deliveryRule(context), payloadRule(context), freedSpaceRule(context), axleRule(context),
    centerOfGravityRule(context), stackingRule(context), handlingClassRule(context), deadlineRule(context), blockingRule(context),
  ]
}
