import { gt, lt, roundCm, roundKg, volumeCm3 } from '@/domain/geometry'
import { addedConflicts, segregation } from '@/domain/constraints'
import { axleLoadsOf, checkAxleLoads, checkCenterOfGravity, type PointCm } from '@/domain/metrics'
import type { PickupContext, PickupRuleResult } from './types'

/**
 * Luật 3–8 và 10: còn tải, chỗ trống, tải trục, trọng tâm, xếp chồng, loại hàng, không chắn hàng đang chở. Luật 4–7 và 10 là ước lượng:
 * kiện nhận đặt vào **giữa các vùng đã trống** (vùng của các điểm đã hoàn tất), một lớp, chưa có vị trí 3D thật (P2).
 */

const sum = <T>(items: readonly T[], value: (item: T) => number) => items.reduce((total, item) => total + value(item), 0)

/** Vùng đã trống: vùng của các điểm đã hoàn tất, từ mép trong nhất tới cửa; không có vùng nào thì `lengthCm` bằng 0. */
function freedRegion({ stops, zones, vehicle }: PickupContext) {
  const done = new Set(stops.filter((stop) => stop.completed).map((stop) => stop.number))
  const freed = zones.filter((zone) => done.has(zone.stopId))
  const lengthCm = sum(freed, (zone) => zone.endXCm - zone.startXCm)
  const startXCm = Math.min(...freed.map((zone) => zone.startXCm))
  const endXCm = Math.max(...freed.map((zone) => zone.endXCm))
  return {
    lengthCm,
    startXCm,
    endXCm,
    volumeCm3: lengthCm * vehicle.innerWidthCm * vehicle.innerHeightCm,
    floorCm2: lengthCm * vehicle.innerWidthCm,
  }
}

const pickupKg = ({ request }: PickupContext) => sum(request.packages, (pkg) => pkg.weightKg)

/** Khối hàng sau khi nhận: kiện còn trên xe cộng kiện nhận ở giữa vùng đã trống (hoặc ở cửa sau khi chưa có vùng nào). */
function loadAfterPickup(context: PickupContext): { totalKg: number; center?: PointCm } {
  const { onboard, request, vehicle } = context
  const freed = freedRegion(context)
  const incomingKg = pickupKg(context)
  const tallestCm = Math.max(0, ...request.packages.map((pkg) => pkg.heightCm))
  const incoming = { weightKg: incomingKg, x: freed.lengthCm > 0 ? (freed.startXCm + freed.endXCm) / 2 : vehicle.innerLengthCm, y: vehicle.innerWidthCm / 2, z: tallestCm / 2 }
  const items = [
    ...onboard.map((item) => ({ weightKg: item.weightKg, x: item.xCm + item.lengthCm / 2, y: item.yCm + item.widthCm / 2, z: item.zCm + item.heightCm / 2 })),
    incoming,
  ]
  const totalKg = sum(items, (item) => item.weightKg)
  if (!gt(totalKg, 0)) return { totalKg }
  return { totalKg, center: { x: sum(items, (i) => i.weightKg * i.x) / totalKg, y: sum(items, (i) => i.weightKg * i.y) / totalKg, z: sum(items, (i) => i.weightKg * i.z) / totalKg } }
}

/** Luật 3: kiện còn trên xe cộng kiện nhận không vượt tải trọng. */
export function payloadRule(context: PickupContext): PickupRuleResult {
  const totalKg = sum(context.onboard, (item) => item.weightKg) + pickupKg(context)
  const passed = !gt(totalKg, context.vehicle.maxPayloadKg)
  return {
    rule: 3, passed, code: passed ? 'PICKUP_PAYLOAD_OK' : 'PICKUP_PAYLOAD_EXCEEDED', estimated: false,
    params: { totalKg: roundKg(totalKg), maxPayloadKg: context.vehicle.maxPayloadKg, overKg: passed ? 0 : roundKg(totalKg - context.vehicle.maxPayloadKg) },
  }
}

/** Luật 4: thể tích kiện nhận không vượt thể tích các vùng đã trống. */
export function freedSpaceRule(context: PickupContext): PickupRuleResult {
  const pickupCm3 = sum(context.request.packages, (pkg) => volumeCm3({ xCm: 0, yCm: 0, zCm: 0, lengthCm: pkg.lengthCm, widthCm: pkg.widthCm, heightCm: pkg.heightCm }))
  const freedCm3 = freedRegion(context).volumeCm3
  const passed = !gt(pickupCm3, freedCm3)
  return { rule: 4, passed, code: passed ? 'PICKUP_FREED_SPACE_OK' : 'PICKUP_FREED_SPACE_INSUFFICIENT', estimated: true, params: { pickupCm3, freedCm3 } }
}

/** Luật 5: tải trục sau khi nhận. Xe không đủ dữ liệu trục thì không kiểm (đạt, kèm mã nói rõ). */
export function axleRule(context: PickupContext): PickupRuleResult {
  const { totalKg, center } = loadAfterPickup(context)
  const loads = axleLoadsOf(context.vehicle, { totalKg, ...(center === undefined ? {} : { centerXCm: center.x }) })
  if (loads.status !== 'computed') return { rule: 5, passed: true, code: 'PICKUP_AXLE_UNAVAILABLE', estimated: true, params: { reason: loads.reason } }
  const overloads = checkAxleLoads(loads)
  const passed = overloads.length === 0
  return {
    rule: 5, passed, code: passed ? 'PICKUP_AXLE_OK' : 'PICKUP_AXLE_OVERLOAD', estimated: true,
    params: { frontLoadKg: roundKg(loads.front.loadKg), rearLoadKg: roundKg(loads.rear.loadKg), overKg: Math.max(0, ...overloads.map((issue) => issue.params.overKg)) },
  }
}

/** Luật 6: trọng tâm hàng sau khi nhận không lệch quá ngưỡng của xe (`checkCenterOfGravity`). */
export function centerOfGravityRule(context: PickupContext): PickupRuleResult {
  const { center } = loadAfterPickup(context)
  const issues = center === undefined ? [] : checkCenterOfGravity(context.vehicle, center)
  const passed = issues.length === 0
  return { rule: 6, passed, code: passed ? 'PICKUP_COG_OK' : 'PICKUP_COG_OFF_CENTER', estimated: true, params: { reasons: issues.map((issue) => issue.code).join(',') } }
}

/**
 * Luật 7: hàng dễ vỡ không bị đè. Kiện nhận chiếm sàn của vùng đã trống; cần hơn một lớp mà trong đó có kiện `FRAGILE` thì có kiện
 * khác phải xếp lên trên (ước lượng, không biết thứ tự xếp thật).
 */
export function stackingRule(context: PickupContext): PickupRuleResult {
  const footprintCm2 = sum(context.request.packages, (pkg) => pkg.lengthCm * pkg.widthCm)
  const floorCm2 = freedRegion(context).floorCm2
  const layers = gt(floorCm2, 0) ? Math.max(1, Math.ceil(footprintCm2 / floorCm2 - 1e-9)) : Number.POSITIVE_INFINITY
  const fragileCount = context.request.packages.filter((pkg) => pkg.handlingClass === 'FRAGILE').length
  const passed = fragileCount === 0 || layers <= 1
  return {
    rule: 7, passed, code: passed ? 'PICKUP_STACK_OK' : 'PICKUP_FRAGILE_STACKED', estimated: true,
    params: { layers: Number.isFinite(layers) ? layers : 0, fragileCount, footprintCm2: roundCm(footprintCm2), floorCm2: roundCm(floorCm2) },
  }
}

/** Luật 8: kiện nhận cùng loại hàng với loại đang khoá của chuyến, hoặc chuyến đã có lý do vượt luật (D-74). */
export function handlingClassRule(context: PickupContext): PickupRuleResult {
  const incoming = context.request.packages.map((pkg, index) => ({ id: `PICKUP-${index + 1}`, quantity: 1, handlingClass: pkg.handlingClass ?? ('STANDARD' as const) }))
  const conflicts = addedConflicts(context.tripCargo, [...context.tripCargo, ...incoming])
  const lockedClass = segregation([...context.tripCargo, ...incoming], undefined).lockedClass ?? 'STANDARD'
  const params = { lockedClass, conflictCount: conflicts.length, classes: [...new Set(conflicts.map((conflict) => conflict.handlingClass))].join(',') }
  if (conflicts.length === 0) return { rule: 8, passed: true, code: 'PICKUP_CLASS_OK', estimated: false, params }
  const overridden = (context.overrideReason ?? '').trim() !== ''
  return { rule: 8, passed: overridden, code: overridden ? 'PICKUP_CLASS_OVERRIDDEN' : 'PICKUP_CLASS_CONFLICT', estimated: false, params }
}

/** Luật 10: không kiện nào còn trên xe nằm trong vùng đã trống — kiện nhận đặt vào đó sẽ chắn lối dỡ của nó. */
export function blockingRule(context: PickupContext): PickupRuleResult {
  const freed = freedRegion(context)
  const blocked = freed.lengthCm > 0 ? context.onboard.filter((item) => lt(freed.startXCm, item.xCm + item.lengthCm) && gt(freed.endXCm, item.xCm)) : []
  const passed = blocked.length === 0
  return { rule: 10, passed, code: passed ? 'PICKUP_NOT_BLOCKING' : 'PICKUP_BLOCKS_CARGO', estimated: true, params: { blockedCount: blocked.length } }
}
