import { gt, roundKg, volumeCm3 } from '@/domain/geometry'
import { addedConflicts, segregation } from '@/domain/constraints'
import { checkAxleLoads, checkCenterOfGravity, type PointCm } from '@/domain/metrics'
import { freedZones } from './freed-zones'
import type { PickupContext, PickupRuleResult } from './types'

/**
 * Luật 3–8 và 10: còn tải, chỗ trống, tải trục, trọng tâm, xếp chồng, loại hàng, không chắn hàng đang chở. Luật 4–7 và 10 đọc kết quả
 * thật của việc xếp kiện nhận vào vùng trống (`context.packing`, FE-BL-01): kiện đang chở giữ nguyên chỗ, kiện nhận có vị trí cụ thể.
 */

const sum = <T>(items: readonly T[], value: (item: T) => number) => items.reduce((total, item) => total + value(item), 0)

const pickupKg = ({ request }: PickupContext) => sum(request.packages, (pkg) => pkg.weightKg)

/** Luật 3: kiện còn trên xe cộng kiện nhận không vượt tải trọng. */
export function payloadRule(context: PickupContext): PickupRuleResult {
  const totalKg = sum(context.onboard, (item) => item.weightKg) + (context.looseKg ?? 0) + pickupKg(context)
  const passed = !gt(totalKg, context.vehicle.maxPayloadKg)
  return {
    rule: 3, passed, code: passed ? 'PICKUP_PAYLOAD_OK' : 'PICKUP_PAYLOAD_EXCEEDED',
    params: { totalKg: roundKg(totalKg), maxPayloadKg: context.vehicle.maxPayloadKg, overKg: passed ? 0 : roundKg(totalKg - context.vehicle.maxPayloadKg) },
  }
}

/** Luật 4: mọi kiện nhận có chỗ trong vùng đã trống. Kiện chỉ ở lại vì phải đè lên kiện không chịu tải là việc của luật 7. */
export function freedSpaceRule(context: PickupContext): PickupRuleResult {
  const { packing, request } = context
  const noRoom = packing.unplaced.filter((item) => item.reasonCode !== 'STACKING_VIOLATION')
  const passed = noRoom.length === 0
  const pickupCm3 = sum(request.packages, (pkg) => volumeCm3({ xCm: 0, yCm: 0, zCm: 0, lengthCm: pkg.lengthCm, widthCm: pkg.widthCm, heightCm: pkg.heightCm }))
  const freedCm3 = freedZones({ vehicle: context.vehicle, zones: context.zones, stops: context.stops, onboardKg: 0 }).totalVolumeCm3
  return {
    rule: 4, passed, code: passed ? 'PICKUP_FREED_SPACE_OK' : 'PICKUP_FREED_SPACE_INSUFFICIENT',
    params: { pickupCm3, freedCm3, placedCount: packing.placements.length, totalCount: request.packages.length, unplacedCount: noRoom.length },
  }
}

/** Luật 5: tải trục sau khi nhận. Xe không đủ dữ liệu trục thì không kiểm (đạt, kèm mã nói rõ). */
export function axleRule({ packing }: PickupContext): PickupRuleResult {
  const loads = packing.after.axle
  if (loads.status !== 'computed') return { rule: 5, passed: true, code: 'PICKUP_AXLE_UNAVAILABLE', params: { reason: loads.reason } }
  const overloads = checkAxleLoads(loads)
  const passed = overloads.length === 0
  return {
    rule: 5, passed, code: passed ? 'PICKUP_AXLE_OK' : 'PICKUP_AXLE_OVERLOAD',
    params: { frontLoadKg: roundKg(loads.front.loadKg), rearLoadKg: roundKg(loads.rear.loadKg), overKg: Math.max(0, ...overloads.map((issue) => issue.params.overKg)) },
  }
}

type CogIssue = ReturnType<typeof checkCenterOfGravity>[number]

/** Một kiểu lệch trọng tâm: mã, kèm phía bị dồn về với lệch dọc — dồn về đầu thùng và dồn về cửa là hai kiểu khác nhau. */
const cogKind = (issue: CogIssue) => `${issue.code}:${'toward' in issue.params ? issue.params.toward : ''}`

/**
 * Luật 6: kiện nhận không làm trọng tâm hàng lệch quá ngưỡng của xe (`checkCenterOfGravity`). Giữa chuyến, hàng còn lại thường đã dồn về
 * đầu thùng vì hàng gần cửa đã giao: kiểu lệch **có từ trước khi nhận** không tính cho yêu cầu (`PICKUP_COG_NOT_WORSE`, đạt); chỉ kiểu
 * lệch mới xuất hiện sau khi nhận mới làm luật không đạt.
 */
export function centerOfGravityRule(context: PickupContext): PickupRuleResult {
  const issuesAt = (center: PointCm | undefined) => (center === undefined ? [] : checkCenterOfGravity(context.vehicle, center))
  const after = issuesAt(context.packing.after.centerOfGravityCm)
  const before = new Set(issuesAt(context.packing.before.centerOfGravityCm).map(cogKind))
  const added = after.filter((issue) => !before.has(cogKind(issue)))
  const code = after.length === 0 ? 'PICKUP_COG_OK' : added.length === 0 ? 'PICKUP_COG_NOT_WORSE' : 'PICKUP_COG_OFF_CENTER'
  const reasons = (added.length === 0 ? after : added).map((issue) => issue.code).join(',')
  return { rule: 6, passed: code !== 'PICKUP_COG_OFF_CENTER', code, params: { reasons } }
}

/**
 * Luật 7: xếp chồng hợp lệ. Không đạt khi kết quả xếp có issue xếp chồng của constraint engine (tải đè, kiện không xếp chồng bị đè, quá
 * số tầng, diện tích tựa), hoặc có kiện ở lại vì chỉ còn cách đè lên kiện không chịu tải (kiện dễ vỡ).
 */
export function stackingRule({ packing }: PickupContext): PickupRuleResult {
  const stackedOut = packing.unplaced.filter((item) => item.reasonCode === 'STACKING_VIOLATION').length
  const count = packing.stackingIssues.length + stackedOut
  const passed = count === 0
  return { rule: 7, passed, code: passed ? 'PICKUP_STACK_OK' : 'PICKUP_FRAGILE_STACKED', params: { count } }
}

/** Luật 8: kiện nhận cùng loại hàng với loại đang khoá của chuyến, hoặc chuyến đã có lý do vượt luật (D-74). */
export function handlingClassRule(context: PickupContext): PickupRuleResult {
  const incoming = context.request.packages.map((pkg, index) => ({ id: `PICKUP-${index + 1}`, quantity: 1, handlingClass: pkg.handlingClass ?? ('STANDARD' as const) }))
  const conflicts = addedConflicts(context.tripCargo, [...context.tripCargo, ...incoming])
  const lockedClass = segregation([...context.tripCargo, ...incoming], undefined).lockedClass ?? 'STANDARD'
  const params = { lockedClass, conflictCount: conflicts.length, classes: [...new Set(conflicts.map((conflict) => conflict.handlingClass))].join(',') }
  if (conflicts.length === 0) return { rule: 8, passed: true, code: 'PICKUP_CLASS_OK', params }
  const overridden = (context.overrideReason ?? '').trim() !== ''
  return { rule: 8, passed: overridden, code: overridden ? 'PICKUP_CLASS_OVERRIDDEN' : 'PICKUP_CLASS_CONFLICT', params }
}

/** Luật 10: kiện nhận đã xếp không chắn lối dỡ kiện nào còn chở (LIFO của domain: kiện giao muộn hơn che kín mặt sau kiện giao sớm hơn). */
export function blockingRule({ packing }: PickupContext): PickupRuleResult {
  const passed = packing.blockedCount === 0
  return { rule: 10, passed, code: passed ? 'PICKUP_NOT_BLOCKING' : 'PICKUP_BLOCKS_CARGO', params: { blockedCount: packing.blockedCount } }
}
