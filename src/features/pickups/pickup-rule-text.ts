import type { PickupRuleResult } from '@/domain/pickup'
import type { Formatter } from '@/lib/format'
import type { TFunction } from '@/lib/i18n'

/**
 * Câu của một luật nhận hàng dọc đường (FE-7-03): kho và domain chỉ trả **mã + tham số** (`PickupRuleResult`), hàm này dịch từng mã và
 * format số theo ngôn ngữ đang chọn. Mỗi mã một nhánh để TypeScript kiểm tên tham số của câu; thêm mã vào `PICKUP_RULE_CODES` mà quên
 * nhánh ở đây là lỗi kiểu.
 */

export type RuleTextContext = {
  readonly t: TFunction
  readonly format: Formatter
  /** Nhãn của điểm theo mã điểm của chuyến ("điểm 3 (Bếp ăn công nghiệp KCN Sóng Thần)"); mã lạ thì chính mã. */
  readonly stopLabel: (stopId: string) => string
}

const num = (value: string | number | undefined): number => (typeof value === 'number' ? value : Number(value ?? 0))
const str = (value: string | number | undefined): string => (value === undefined ? '' : String(value))

export function ruleText(result: PickupRuleResult, { t, format, stopLabel }: RuleTextContext): string {
  const p = result.params
  const moment = (iso: string | number | undefined) => t('pickups.rules.moment', { time: format.time(str(iso)), date: format.dayMonth(str(iso)) })
  switch (result.code) {
    case 'PICKUP_ON_ROUTE':
    case 'PICKUP_OFF_ROUTE':
      return t(`pickups.rules.codes.${result.code}`, { distanceKm: format.decimal(num(p.distanceKm)), maxKm: format.integer(num(p.maxKm)) })
    case 'PICKUP_BEHIND_VEHICLE':
    case 'PICKUP_DELIVERY_NOT_AFTER_CURRENT':
    case 'PICKUP_AXLE_UNAVAILABLE':
    case 'PICKUP_COG_OK':
    case 'PICKUP_STACK_OK':
    case 'PICKUP_NO_DEADLINE':
    case 'PICKUP_NOT_BLOCKING':
    case 'PICKUP_NO_REMAINING_STOP':
      return t(`pickups.rules.codes.${result.code}`)
    case 'PICKUP_DELIVERY_IN_RANGE':
      return p.protectedStopId === undefined
        ? t('pickups.rules.codes.PICKUP_DELIVERY_IN_RANGE')
        : t('pickups.rules.codes.PICKUP_DELIVERY_IN_RANGE_PROTECTED', { stop: stopLabel(str(p.protectedStopId)) })
    case 'PICKUP_DELIVERY_BEYOND_PROTECTED':
      return t('pickups.rules.codes.PICKUP_DELIVERY_BEYOND_PROTECTED', { stop: stopLabel(str(p.protectedStopId)) })
    case 'PICKUP_PAYLOAD_OK':
      return t('pickups.rules.codes.PICKUP_PAYLOAD_OK', { totalKg: format.weight(num(p.totalKg)), maxPayloadKg: format.weight(num(p.maxPayloadKg)) })
    case 'PICKUP_PAYLOAD_EXCEEDED':
      return t('pickups.rules.codes.PICKUP_PAYLOAD_EXCEEDED', {
        totalKg: format.weight(num(p.totalKg)), maxPayloadKg: format.weight(num(p.maxPayloadKg)), overKg: format.weight(num(p.overKg)),
      })
    case 'PICKUP_FREED_SPACE_OK':
    case 'PICKUP_FREED_SPACE_INSUFFICIENT':
      return t(`pickups.rules.codes.${result.code}`, {
        pickupVolume: format.volumeM3(num(p.pickupCm3)), freedVolume: format.volumeM3(num(p.freedCm3)),
        total: format.integer(num(p.totalCount)), unplaced: format.integer(num(p.unplacedCount)),
      })
    case 'PICKUP_AXLE_OK':
      return t('pickups.rules.codes.PICKUP_AXLE_OK', { frontLoadKg: format.weight(num(p.frontLoadKg)), rearLoadKg: format.weight(num(p.rearLoadKg)) })
    case 'PICKUP_AXLE_OVERLOAD':
      return t('pickups.rules.codes.PICKUP_AXLE_OVERLOAD', {
        frontLoadKg: format.weight(num(p.frontLoadKg)), rearLoadKg: format.weight(num(p.rearLoadKg)), overKg: format.weight(num(p.overKg)),
      })
    case 'PICKUP_COG_NOT_WORSE':
    case 'PICKUP_COG_OFF_CENTER': {
      const reasons = str(p.reasons).split(',').flatMap((reason) => (reason === 'COG_LATERAL' || reason === 'COG_LONGITUDINAL' || reason === 'COG_HIGH' ? [t(`pickups.rules.cogReasons.${reason}`)] : []))
      return t(`pickups.rules.codes.${result.code}`, { reasons: format.list(reasons) })
    }
    case 'PICKUP_FRAGILE_STACKED':
      return t('pickups.rules.codes.PICKUP_FRAGILE_STACKED', { count: format.integer(num(p.count)) })
    case 'PICKUP_CLASS_OK':
      return t('pickups.rules.codes.PICKUP_CLASS_OK', { lockedClass: handlingLabel(p.lockedClass, t) })
    case 'PICKUP_CLASS_OVERRIDDEN':
      return t('pickups.rules.codes.PICKUP_CLASS_OVERRIDDEN', { classes: format.list(str(p.classes).split(',').filter((value) => value !== '').map((value) => handlingLabel(value, t))) })
    case 'PICKUP_CLASS_CONFLICT':
      return t('pickups.rules.codes.PICKUP_CLASS_CONFLICT', { conflictCount: format.integer(num(p.conflictCount)), lockedClass: handlingLabel(p.lockedClass, t) })
    case 'PICKUP_DEADLINE_OK':
    case 'PICKUP_DEADLINE_MISSED':
      return t(`pickups.rules.codes.${result.code}`, { eta: moment(p.eta), deadline: moment(p.deadline) })
    case 'PICKUP_BLOCKS_CARGO':
      return t('pickups.rules.codes.PICKUP_BLOCKS_CARGO', { blockedCount: format.integer(num(p.blockedCount)) })
  }
}

/** Nhãn loại hàng của mã kho; mã lạ giữ nguyên. */
function handlingLabel(value: string | number | undefined, t: TFunction): string {
  const code = str(value)
  return code === 'STANDARD' || code === 'FRAGILE' || code === 'REFRIGERATED' || code === 'HAZARDOUS' || code === 'HIGH_VALUE' ? t(`common.handlingClasses.${code}`) : code
}
