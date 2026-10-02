import { ORIENTATION_CODES, roundCm, roundKg, UPRIGHT_ORIENTATIONS, type OrientationCode } from '@/domain/geometry'
import type { FragilityLevel, HandlingClass } from '@/domain/models'
import type { ImportField } from './package-import-columns'

/** Giá trị đã đọc của một ô, theo kiểu của cột. */
export type ImportValue = string | number | boolean | OrientationCode[] | FragilityLevel | HandlingClass
export type ImportValues = Partial<Record<ImportField, ImportValue>>

/**
 * Cột tuỳ chọn vắng hoặc ô trống: như kiện mới của form (LM-045) — sáu hướng (chỉ hai hướng đứng khi giữ thẳng đứng), không dễ vỡ,
 * cho xếp chồng, tải trên 0 kg, đỡ đáy 0,8, ưu tiên 0, loại hàng `STANDARD` (FE-3b-07, D-68). Kích thước về bội 0,1 cm, khối lượng
 * 0,01 kg tại biên nhập liệu (D-03).
 */
export function withImportDefaults(values: ImportValues): Record<string, unknown> {
  const number = (field: ImportField): number | undefined => {
    const value = values[field]
    return typeof value === 'number' ? value : undefined
  }
  const text = (field: ImportField): string | undefined => {
    const value = values[field]
    return typeof value === 'string' ? value : undefined
  }
  const flag = (field: ImportField, fallback: boolean): boolean => {
    const value = values[field]
    return typeof value === 'boolean' ? value : fallback
  }
  const cm = (field: ImportField) => {
    const value = number(field)
    return value === undefined ? undefined : roundCm(value)
  }
  const keepUpright = flag('keepUpright', false)
  const weightKg = number('weightKg')
  const maxStackCount = number('maxStackCount')
  const groupId = text('groupId')
  const notes = text('notes')
  return {
    id: text('id'),
    name: text('name'),
    lengthCm: cm('lengthCm'),
    widthCm: cm('widthCm'),
    heightCm: cm('heightCm'),
    weightKg: weightKg === undefined ? undefined : roundKg(weightKg),
    quantity: number('quantity'),
    allowedOrientations: Array.isArray(values.allowedOrientations)
      ? values.allowedOrientations
      : [...(keepUpright ? UPRIGHT_ORIENTATIONS : ORIENTATION_CODES)],
    keepUpright,
    fragilityLevel: values.fragilityLevel ?? 'NONE',
    stackable: flag('stackable', true),
    maxTopLoadKg: roundKg(number('maxTopLoadKg') ?? 0),
    ...(maxStackCount === undefined ? {} : { maxStackCount }),
    minSupportRatio: number('minSupportRatio') ?? 0.8,
    deliveryStop: number('deliveryStop'),
    priority: number('priority') ?? 0,
    mustLoad: flag('mustLoad', false),
    ...(groupId ? { groupId } : {}),
    ...(notes ? { notes } : {}),
    handlingClass: values.handlingClass ?? 'STANDARD',
  }
}
