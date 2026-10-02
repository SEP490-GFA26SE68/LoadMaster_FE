import { z } from 'zod'
import { gt, isUpright, ORIENTATION_CODES } from '@/domain/geometry'
import type { OrientationCode } from '@/domain/models'
import { packageFieldError } from '@/features/trips/package-form-errors'
import type { TFunction } from '@/lib/i18n'
import type { PackageType, PackageTypeInput } from '@/lib/mock-db'

/**
 * Form loại kiện (LM-104). Message của schema là **mã** của `cargoPackageSchema` (`package.dimension.positive`…) để dùng lại câu của
 * form kiện (`packageFieldError`); kho kiểm lại bằng chính schema kiện Spec khi lưu (`PACKAGE_TYPE_INVALID`). Ô số đọc bằng
 * `valueAsNumber`: ô trống là `NaN` — số tầng trống nghĩa là không giới hạn.
 */
const NAME_REQUIRED = 'packageType.name.required'
const NUMBER = 'common.number.invalid'

const number = () => z.number({ error: NUMBER })
const orientation = z.enum(ORIENTATION_CODES)

export const packageTypeFormSchema = z
  .object({
    name: z.string().trim().min(1, NAME_REQUIRED),
    lengthCm: number().gt(0, 'package.dimension.positive'),
    widthCm: number().gt(0, 'package.dimension.positive'),
    heightCm: number().gt(0, 'package.dimension.positive'),
    weightKg: number().min(0, 'package.weightKg.nonNegative'),
    allowedOrientations: z.array(orientation).min(1, 'package.allowedOrientations.empty'),
    keepUpright: z.boolean(),
    fragilityLevel: z.enum(['NONE', 'LOW', 'MEDIUM', 'HIGH']),
    stackable: z.boolean(),
    maxTopLoadKg: number().min(0, 'package.maxTopLoadKg.nonNegative'),
    // Ô trống (`NaN`) là không giới hạn; có số thì phải nguyên từ 1
    maxStackCount: z
      .union([z.number(), z.nan()])
      .superRefine((value, ctx) => {
        if (Number.isNaN(value)) return
        if (!Number.isInteger(value)) ctx.addIssue({ code: 'custom', message: 'package.maxStackCount.integer' })
        else if (value < 1) ctx.addIssue({ code: 'custom', message: 'package.maxStackCount.min' })
      })
      .transform((value) => (Number.isNaN(value) ? undefined : value)),
  })
  .superRefine((values, ctx) => {
    // D-25 như form kiện: không xếp chồng thì không chịu tải phía trên
    if (!values.stackable && gt(values.maxTopLoadKg, 0)) {
      ctx.addIssue({ code: 'custom', message: 'package.maxTopLoadKg.notStackable', path: ['maxTopLoadKg'] })
    }
  })

export type PackageTypeFormInput = z.input<typeof packageTypeFormSchema>
export type PackageTypeFormValues = z.output<typeof packageTypeFormSchema>

export const EMPTY_PACKAGE_TYPE: PackageTypeFormInput = {
  name: '',
  lengthCm: Number.NaN,
  widthCm: Number.NaN,
  heightCm: Number.NaN,
  weightKg: Number.NaN,
  allowedOrientations: ['LWH', 'WLH'],
  keepUpright: true,
  fragilityLevel: 'NONE',
  stackable: true,
  maxTopLoadKg: 0,
  maxStackCount: Number.NaN,
}

export function toPackageTypeForm(type: PackageType): PackageTypeFormInput {
  return {
    name: type.name,
    lengthCm: type.lengthCm,
    widthCm: type.widthCm,
    heightCm: type.heightCm,
    weightKg: type.weightKg,
    allowedOrientations: [...type.allowedOrientations],
    keepUpright: type.keepUpright,
    fragilityLevel: type.fragilityLevel,
    stackable: type.stackable,
    maxTopLoadKg: type.maxTopLoadKg,
    maxStackCount: type.maxStackCount ?? Number.NaN,
  }
}

/** Giá trị đã qua schema → đầu vào của kho. Hướng đặt giữ thứ tự chuẩn của Spec để hiển thị ổn định. */
export function toPackageTypeInput(values: PackageTypeFormValues): PackageTypeInput {
  const allowed = ORIENTATION_CODES.filter((code) => values.allowedOrientations.includes(code))
  return {
    name: values.name,
    lengthCm: values.lengthCm,
    widthCm: values.widthCm,
    heightCm: values.heightCm,
    weightKg: values.weightKg,
    allowedOrientations: allowed,
    keepUpright: values.keepUpright,
    fragilityLevel: values.fragilityLevel,
    stackable: values.stackable,
    maxTopLoadKg: values.stackable ? values.maxTopLoadKg : 0,
    ...(values.maxStackCount === undefined || !values.stackable ? {} : { maxStackCount: values.maxStackCount }),
  }
}

/** Bật giữ thẳng đứng thì bỏ các hướng nằm nghiêng (D-25, như form kiện). */
export function uprightOrientations(codes: readonly OrientationCode[]): OrientationCode[] {
  return codes.filter(isUpright)
}

/** Câu cho message lỗi của một ô. */
export function packageTypeFieldError(message: string | undefined, t: TFunction): string | undefined {
  if (message === NAME_REQUIRED) return t('sourcing.packageTypes.form.nameRequired')
  return packageFieldError(message, t)
}
