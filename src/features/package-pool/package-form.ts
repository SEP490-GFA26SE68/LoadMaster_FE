import { z } from 'zod'
import { HANDLING_CLASSES } from '@/domain/models'
import type { PackageInput } from '@/lib/mock-db'

/**
 * Form "Thêm kiện" của kho kiện (FE-3b-03): cùng trường với file nhập — mã của bên gửi (không bắt buộc), kích thước cm, khối lượng kg,
 * loại hàng, điểm đến, loại kiện (không bắt buộc). Message của schema là **mã**; hộp thoại dịch qua `sourcing.form.errors`. Ô số đọc
 * bằng `valueAsNumber`: ô trống là `NaN`. Kho kiểm lại khi lưu (`PACKAGE_INVALID`).
 */
export const PACKAGE_FORM_ERRORS = ['numberInvalid', 'dimensionPositive', 'weightPositive', 'destinationRequired', 'codeTooLong', 'destinationTooLong'] as const
export type PackageFormError = (typeof PACKAGE_FORM_ERRORS)[number]

/** Giá trị ô chọn "Không gắn loại kiện" — Radix Select không nhận giá trị rỗng. */
export const NO_PACKAGE_TYPE = 'none'

const number = () => z.number({ error: 'numberInvalid' satisfies PackageFormError })
const dimension = () => number().gt(0, 'dimensionPositive' satisfies PackageFormError)

export const packageFormSchema = z.object({
  packageCode: z.string().trim().max(60, 'codeTooLong' satisfies PackageFormError),
  lengthCm: dimension(),
  widthCm: dimension(),
  heightCm: dimension(),
  weightKg: number().gt(0, 'weightPositive' satisfies PackageFormError),
  handlingClass: z.enum(HANDLING_CLASSES),
  destination: z.string().trim().min(1, 'destinationRequired' satisfies PackageFormError).max(200, 'destinationTooLong' satisfies PackageFormError),
  packageTypeId: z.string(),
})

export type PackageFormValues = z.output<typeof packageFormSchema>

export const EMPTY_PACKAGE: PackageFormValues = {
  packageCode: '', lengthCm: Number.NaN, widthCm: Number.NaN, heightCm: Number.NaN, weightKg: Number.NaN, handlingClass: 'STANDARD', destination: '',
  packageTypeId: NO_PACKAGE_TYPE,
}

export function isPackageFormError(message: string | undefined): message is PackageFormError {
  return PACKAGE_FORM_ERRORS.includes(message as PackageFormError)
}

/** Giá trị form đã kiểm → đầu vào của kho: mã trống thì để kho đặt, "không gắn loại kiện" thì bỏ trường. */
export function toPackageInput(values: PackageFormValues): PackageInput {
  const { packageCode, packageTypeId, ...fields } = values
  return {
    ...fields,
    ...(packageCode === '' ? {} : { packageCode }),
    ...(packageTypeId === NO_PACKAGE_TYPE || packageTypeId === '' ? {} : { packageTypeId }),
  }
}
