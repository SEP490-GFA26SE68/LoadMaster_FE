import type { CargoPackage, HandlingClass, VehicleConfig } from '@/domain/models'

/**
 * Phân tách hàng (FE-4b-06, D-74): **một chuyến một loại hàng**. Loại của kiện đầu tiên khoá chuyến — chuyến rỗng thì chưa khoá gì,
 * nên khoá tự tính lại khi chuyến hết kiện. Mọi dòng kiện khác loại đang khoá là xung đột; điều phối viên vượt được khi ghi lý do
 * (kho lưu `overrideReason`). Hàm thuần, trả mã + tham số (D-28); UI dịch.
 *
 * Luật theo issue BE S4b-02, S5b-06; tài liệu luồng của BE chỉ nêu cặp dễ vỡ / hàng thường (Q-24). Cảnh báo hàng lạnh khi xe không
 * có thiết bị làm lạnh là **đề xuất, chờ nhóm xác nhận** (PRD v2 mục 17.2).
 */

/** Lý do vượt luật: bắt buộc, dài tối đa chừng này ký tự. */
export const OVERRIDE_REASON_MAX_LENGTH = 500

/** Dòng kiện không ghi loại hàng là hàng thường (FE-3b-07). */
const DEFAULT_HANDLING_CLASS: HandlingClass = 'STANDARD'

export const SEGREGATION_WARNING_CODES = ['HAZARDOUS_VEHICLE_REQUIRED', 'REFRIGERATION_MISSING'] as const
export type SegregationWarningCode = (typeof SEGREGATION_WARNING_CODES)[number]

type Line = Pick<CargoPackage, 'id' | 'quantity' | 'handlingClass'>

export type SegregationGroup = {
  handlingClass: HandlingClass
  /** Mã dòng kiện của nhóm, theo thứ tự dòng. */
  packageIds: string[]
  /** Số kiện (tổng `quantity`). */
  count: number
}

/** Một dòng kiện khác loại đang khoá. */
export type SegregationConflict = { packageId: string; handlingClass: HandlingClass; count: number }

/** Cảnh báo về xe, không chặn: `count` là số kiện của loại hàng gây cảnh báo. */
export type SegregationWarning = { code: SegregationWarningCode; severity: 'warning'; params: { count: number } }

export type Segregation = {
  /** Loại hàng của kiện đầu tiên; `null` khi chuyến chưa có kiện. */
  lockedClass: HandlingClass | null
  /** Nhóm theo loại hàng, theo thứ tự loại xuất hiện — nhóm đầu là loại đang khoá. */
  groups: SegregationGroup[]
  conflicts: SegregationConflict[]
  vehicleWarnings: SegregationWarning[]
}

const classOf = (line: Line): HandlingClass => line.handlingClass ?? DEFAULT_HANDLING_CLASS

/** `vehicle` vắng khi chuyến chưa chọn xe hoặc xe không còn: coi như xe không có thiết bị làm lạnh. */
export function segregation(tripPackages: readonly Line[], vehicle: { obstacles: readonly Pick<VehicleConfig['obstacles'][number], 'type'>[] } | undefined): Segregation {
  const [first] = tripPackages
  if (!first) return { lockedClass: null, groups: [], conflicts: [], vehicleWarnings: [] }
  const lockedClass = classOf(first)
  const groups = new Map<HandlingClass, SegregationGroup>()
  for (const line of tripPackages) {
    const handlingClass = classOf(line)
    const group = groups.get(handlingClass) ?? { handlingClass, packageIds: [], count: 0 }
    group.packageIds.push(line.id)
    group.count += line.quantity
    groups.set(handlingClass, group)
  }
  const conflicts = tripPackages
    .filter((line) => classOf(line) !== lockedClass)
    .map((line) => ({ packageId: line.id, handlingClass: classOf(line), count: line.quantity }))

  const vehicleWarnings: SegregationWarning[] = []
  const hazardous = groups.get('HAZARDOUS')?.count ?? 0
  if (hazardous > 0) vehicleWarnings.push({ code: 'HAZARDOUS_VEHICLE_REQUIRED', severity: 'warning', params: { count: hazardous } })
  const refrigerated = groups.get('REFRIGERATED')?.count ?? 0
  const cooled = vehicle?.obstacles.some((obstacle) => obstacle.type === 'COOLING_UNIT') ?? false
  if (refrigerated > 0 && !cooled) vehicleWarnings.push({ code: 'REFRIGERATION_MISSING', severity: 'warning', params: { count: refrigerated } })

  return { lockedClass, groups: [...groups.values()], conflicts, vehicleWarnings }
}

/**
 * Xung đột **mới** sau một lần đổi dòng kiện: dòng đang xung đột ở `after` mà trước đó không xung đột với cùng loại hàng (dòng vừa
 * thêm, dòng vừa đổi loại, hoặc dòng cũ thành xung đột vì khoá đổi). Kho chỉ đòi lý do vượt khi có xung đột mới.
 */
export function addedConflicts(before: readonly Line[], after: readonly Line[]): SegregationConflict[] {
  const known = new Set(segregation(before, undefined).conflicts.map((conflict) => `${conflict.packageId}|${conflict.handlingClass}`))
  return segregation(after, undefined).conflicts.filter((conflict) => !known.has(`${conflict.packageId}|${conflict.handlingClass}`))
}
