import { z } from 'zod'

import type { MessageKey } from '@/lib/i18n'

import type { PackageType, PackageTypeInput } from './package-types-api'

/**
 * Schema và giá trị của form loại kiện (máy chủ, `PackageTypeFormDialog`). Ô số đọc bằng `valueAsNumber`: ô σ trống là `NaN` — chưa
 * khai, gửi `null`, không bao giờ tự điền giá trị mặc định. Lỗi của ô σ là key từ điển; các ô cũ giữ câu của zod như trước.
 */

export const NON_NEGATIVE = 'physicalData.errors.nonNegative' satisfies MessageKey
export const DECIMAL_SCALE = 'physicalData.errors.decimalScale' satisfies MessageKey
export const CANNOT_CLEAR = 'physicalData.errors.cannotClear' satisfies MessageKey

/** Tối đa hai chữ số lẻ, như cột `NUMERIC(…, 2)` của máy chủ. */
export function hasAtMostTwoDecimals(value: number): boolean {
  const scaled = value * 100
  return Math.abs(scaled - Math.round(scaled)) < 1e-6
}

/**
 * Máy chủ bỏ qua `null` khi sửa, nên một giá trị đã lưu không xoá được: để trống ô đó rồi lưu thì giá trị cũ vẫn còn. Form chặn việc
 * này kèm lý do thay vì báo đã lưu.
 */
export function clearsSavedValue(saved: number | null | undefined, next: number | null | undefined): boolean {
  return saved !== null && saved !== undefined && (next === null || next === undefined)
}

/** Ô σ, kg/m²: trống (`NaN`) là chưa khai (`null`); có số thì từ 0, tối đa hai chữ số lẻ. */
export const optionalTopLoadCapacity = z
  .union([z.number(), z.nan()])
  .superRefine((value, ctx) => {
    if (Number.isNaN(value)) return
    if (!Number.isFinite(value) || value < 0) ctx.addIssue({ code: 'custom', message: NON_NEGATIVE })
    else if (!hasAtMostTwoDecimals(value)) ctx.addIssue({ code: 'custom', message: DECIMAL_SCALE })
  })
  .transform((value) => (Number.isNaN(value) ? null : value))

export const packageTypeFormSchema = z.object({
  typeCode: z.string(),
  name: z.string().trim().min(1),

  lengthCm: z.number().int().positive(),
  widthCm: z.number().int().positive(),
  heightCm: z.number().int().positive(),

  weightKg: z.number().positive(),
  maxStackWeightKg: z.number().min(0),
  topLoadCapacityKgM2: optionalTopLoadCapacity,

  isFragile: z.boolean(),
  rotationAllowed: z.boolean(),
  allowRotateX: z.boolean(),
  allowRotateY: z.boolean(),
  allowRotateZ: z.boolean(),
})

export type PackageTypeFormInput = z.input<typeof packageTypeFormSchema>
export type PackageTypeFormValues = z.output<typeof packageTypeFormSchema>

const DEFAULT_VALUES: PackageTypeFormInput = {
  typeCode: '',
  name: '',
  lengthCm: 1,
  widthCm: 1,
  heightCm: 1,
  weightKg: 1,
  maxStackWeightKg: 0,
  topLoadCapacityKgM2: Number.NaN,
  isFragile: false,
  rotationAllowed: true,
  allowRotateX: true,
  allowRotateY: true,
  allowRotateZ: true,
}

export function toPackageTypeForm(type?: PackageType): PackageTypeFormInput {
  if (!type) return DEFAULT_VALUES
  return {
    typeCode: type.typeCode ?? '',
    name: type.name,
    lengthCm: type.lengthCm,
    widthCm: type.widthCm,
    heightCm: type.heightCm,
    weightKg: type.weightKg,
    maxStackWeightKg: type.maxStackWeightKg,
    topLoadCapacityKgM2: type.topLoadCapacityKgM2 ?? Number.NaN,
    isFragile: type.isFragile,
    rotationAllowed: type.rotationAllowed,
    allowRotateX: type.allowRotateX,
    allowRotateY: type.allowRotateY,
    allowRotateZ: type.allowRotateZ,
  }
}

export function toPackageTypeInput(values: PackageTypeFormValues): PackageTypeInput {
  return {
    ...values,
    typeCode: values.typeCode.trim() || null,
    name: values.name.trim(),
  }
}
