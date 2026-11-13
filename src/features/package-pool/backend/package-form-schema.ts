import type { DefaultValues } from 'react-hook-form'
import { z } from 'zod'
import { HANDLING_CLASSES } from '@/domain/models'
import type { TFunction } from '@/lib/i18n'
import type { CargoPackage, CargoPackageInput } from './packages-api'

/**
 * Schema, giá trị mặc định và dữ liệu gửi đi của form thêm / sửa kiện (máy chủ, `PackageFormDialog`). Tách khỏi hộp thoại để file giao
 * diện chỉ còn phần vẽ; mọi câu lỗi lấy từ từ điển qua `t`.
 */

export const NO_PACKAGE_TYPE = '__none__'

export const ORIENTATION_OPTIONS = [
  { value: 0, dimensions: 'L × W × H' },
  { value: 1, dimensions: 'L × H × W' },
  { value: 2, dimensions: 'W × L × H' },
  { value: 3, dimensions: 'W × H × L' },
  { value: 4, dimensions: 'H × L × W' },
  { value: 5, dimensions: 'H × W × L' },
] as const

const optionalNumber = z.number().finite().optional()

function hasAtMostTwoDecimals(value: number | undefined): boolean {
  if (value === undefined) return true
  const [, fraction = ''] = String(value).split('.')
  return fraction.length <= 2
}

export const createPackageSchema = (t: TFunction) =>
  z
    .object({
      packageCode: z.string().trim().min(1, t('sourcing.form.packageCodeRequired')).max(100, t('sourcing.form.packageCodeMaxLength')),
      packageName: z.string().max(150),
      quantity: z.number().int().min(1).max(1000),
      packageTypeId: z.string(),
      deliveryRequirementId: z.string(),

      lengthCm: z.number().positive().optional().refine(hasAtMostTwoDecimals, t('sourcing.server.form.decimalScale')),
      widthCm: z.number().positive().optional().refine(hasAtMostTwoDecimals, t('sourcing.server.form.decimalScale')),
      heightCm: z.number().positive().optional().refine(hasAtMostTwoDecimals, t('sourcing.server.form.decimalScale')),
      weightKg: z.number().positive().refine(hasAtMostTwoDecimals, t('sourcing.server.form.decimalScale')),

      handlingClass: z.enum(HANDLING_CLASSES),
      destination: z.string().trim().min(1, t('sourcing.form.destinationRequired')).max(255, t('sourcing.form.destinationMaxLength')),
      note: z.string(),

      orientation: z.string().max(100),
      uprightOnly: z.boolean(),
      fragilityLevel: optionalNumber.refine((value) => value === undefined || (Number.isInteger(value) && value >= 0)),
      stackable: z.boolean(),

      maxTopLoadKg: optionalNumber.refine((value) => value === undefined || value >= 0),
      maxLayers: optionalNumber.refine((value) => value === undefined || (Number.isInteger(value) && value >= 1)),
      minSupportRatio: optionalNumber.refine((value) => value === undefined || (value >= 0 && value <= 1)),
      priority: optionalNumber.refine((value) => value === undefined || Number.isInteger(value)),
      mustLoad: z.boolean(),
      packingGroup: z.string().max(100),
    })
    .superRefine((values, ctx) => {
      if (values.packageTypeId !== NO_PACKAGE_TYPE) return
      for (const field of ['lengthCm', 'widthCm', 'heightCm'] as const) {
        if (values[field] === undefined) {
          ctx.addIssue({ code: 'custom', path: [field], message: t('sourcing.form.dimensionsRequired') })
        }
      }
    })

export type PackageFormValues = z.infer<ReturnType<typeof createPackageSchema>>

export type PackageNumberField =
  | 'quantity'
  | 'lengthCm'
  | 'widthCm'
  | 'heightCm'
  | 'weightKg'
  | 'fragilityLevel'
  | 'maxTopLoadKg'
  | 'maxLayers'
  | 'minSupportRatio'
  | 'priority'

const DEFAULT_VALUES: PackageFormValues = {
  deliveryRequirementId: '',
  packageCode: '',
  packageName: '',
  quantity: 1,
  packageTypeId: NO_PACKAGE_TYPE,
  lengthCm: undefined,
  widthCm: undefined,
  heightCm: undefined,
  weightKg: 1,
  handlingClass: 'STANDARD',
  destination: '',
  note: '',
  orientation: '',
  uprightOnly: false,
  fragilityLevel: undefined,
  stackable: false,
  maxTopLoadKg: undefined,
  maxLayers: undefined,
  minSupportRatio: undefined,
  priority: undefined,
  mustLoad: false,
  packingGroup: '',
}

/**
 * Giá trị đầu của form: kiện đang sửa, hoặc mặc định của kiện mới. Kiện đang sửa không có `deliveryRequirementId` (ô đó chỉ có ở form thêm
 * kiện) — giữ đúng như trước khi tách file.
 */
export function packageFormDefaults(editPackage: CargoPackage | undefined): DefaultValues<PackageFormValues> {
  if (!editPackage) return DEFAULT_VALUES
  return {
    packageCode: editPackage.packageCode ?? '',
    packageName: editPackage.packageName ?? '',
    quantity: 1,
    packageTypeId: editPackage.packageTypeId ?? NO_PACKAGE_TYPE,
    lengthCm: editPackage.lengthCm,
    widthCm: editPackage.widthCm,
    heightCm: editPackage.heightCm,
    weightKg: editPackage.weightKg,
    handlingClass: editPackage.handlingClass,
    destination: editPackage.destination ?? '',
    note: editPackage.note ?? '',
    orientation: editPackage.orientation ?? '',
    uprightOnly: editPackage.uprightOnly ?? false,
    fragilityLevel: editPackage.fragilityLevel ?? undefined,
    stackable: editPackage.stackable ?? false,
    maxTopLoadKg: editPackage.maxTopLoadKg ?? undefined,
    maxLayers: editPackage.maxLayers ?? undefined,
    minSupportRatio: editPackage.minSupportRatio ?? undefined,
    priority: editPackage.priority ?? undefined,
    mustLoad: editPackage.mustLoad ?? false,
    packingGroup: editPackage.packingGroup ?? '',
  }
}

/** Dữ liệu gửi máy chủ: có loại kiện thì không gửi kích thước (máy chủ lấy của loại kiện); sửa kiện không gửi yêu cầu giao và số lượng. */
export function packageInputOf(values: PackageFormValues, { isEditing, hasPackageType }: { isEditing: boolean; hasPackageType: boolean }): CargoPackageInput {
  return {
    packageCode: values.packageCode.trim(),
    packageName: values.packageName.trim(),
    quantity: isEditing ? 1 : values.quantity,
    packageTypeId: values.packageTypeId === NO_PACKAGE_TYPE ? undefined : values.packageTypeId,
    ...(!isEditing ? { deliveryRequirementId: values.deliveryRequirementId } : {}),
    lengthCm: hasPackageType ? undefined : values.lengthCm,
    widthCm: hasPackageType ? undefined : values.widthCm,
    heightCm: hasPackageType ? undefined : values.heightCm,
    weightKg: values.weightKg,
    handlingClass: values.handlingClass,
    destination: values.destination.trim(),
    note: values.note,
    orientation: values.orientation.trim() || undefined,
    uprightOnly: values.uprightOnly,
    fragilityLevel: values.fragilityLevel,
    stackable: values.stackable,
    maxTopLoadKg: values.maxTopLoadKg,
    maxLayers: values.maxLayers,
    minSupportRatio: values.minSupportRatio,
    priority: values.priority,
    mustLoad: values.mustLoad,
    packingGroup: values.packingGroup.trim(),
  }
}

/** Các hướng đặt đang chọn, đọc từ chuỗi "0,2" của form; giá trị lạ bị bỏ. */
export function orientationValuesOf(value: string): number[] {
  return value ? value.split(',').map(Number).filter((item) => Number.isInteger(item) && item >= 0 && item <= 5) : []
}
