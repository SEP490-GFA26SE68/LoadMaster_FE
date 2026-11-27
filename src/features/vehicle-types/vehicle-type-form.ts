import { z } from 'zod'
import { roundCm, roundKg } from '@/domain/geometry'
import { DEFAULT_MAX_COG_OFFSET_RATIO, MAX_COG_OFFSET_RATIO_CEILING } from '@/domain/models'
import type { MessageKey } from '@/lib/i18n'
import type { VehicleType, VehicleTypeInput } from '@/lib/mock-db'
import { VEHICLE_BODY_STYLES } from '@/types/vehicle-body-style'

/**
 * Form loại xe (LM-104, FE-5b-01). Message của schema là key từ điển: đổi ngôn ngữ thì lỗi đổi theo. Kích thước cm, tải trọng và giới
 * hạn trục kg (D-03), làm tròn tại biên khi lưu. Ô số đọc bằng `valueAsNumber`: ô trống là `NaN` — giới hạn trục để trống nghĩa là
 * loại xe chưa khai. Độ lệch trọng tâm nhập bằng phần trăm, kho giữ tỷ lệ (`maxCogOffsetRatio`). Kiểu thân xe chỉ đổi hình xe ở
 * khung 3D: Radix Select không nhận giá trị rỗng nên "Tự chọn theo kích thước" là `AUTO`, lưu thành loại xe không có `bodyStyle`.
 */
export const NAME_MAX = 80
export const POSITIVE = 'vehicleTypes.form.errors.positive' satisfies MessageKey
export const COG_RANGE = 'vehicleTypes.form.errors.cogRange' satisfies MessageKey
/** Mục "Tự chọn theo kích thước" của ô kiểu thân xe. */
export const BODY_STYLE_AUTO = 'AUTO'
/** Lựa chọn của ô kiểu thân xe theo thứ tự hiện: tự chọn rồi các kiểu khung 3D vẽ được (D-20). */
export const BODY_STYLE_CHOICES = [BODY_STYLE_AUTO, ...VEHICLE_BODY_STYLES] as const

/** Trần của ô phần trăm: trọng tâm không thể lệch quá nửa thùng. */
export const MAX_COG_OFFSET_PERCENT = MAX_COG_OFFSET_RATIO_CEILING * 100

const positive = z.number({ error: POSITIVE }).gt(0, { error: POSITIVE })

/** Ô trống (`NaN`) là chưa khai; có số thì phải lớn hơn 0. */
const optionalPositive = z
  .union([z.number(), z.nan()])
  .superRefine((value, ctx) => {
    if (!Number.isNaN(value) && !(value > 0)) ctx.addIssue({ code: 'custom', message: POSITIVE })
  })
  .transform((value) => (Number.isNaN(value) ? undefined : value))

export const vehicleTypeFormSchema = z.object({
  name: z.string().trim().min(1, 'vehicleTypes.form.errors.nameRequired').max(NAME_MAX, 'vehicleTypes.form.errors.nameTooLong'),
  cargoLengthCm: positive,
  cargoWidthCm: positive,
  cargoHeightCm: positive,
  payloadKg: positive,
  frontAxleLimitKg: optionalPositive,
  rearAxleLimitKg: optionalPositive,
  maxCogOffsetPercent: z.number({ error: COG_RANGE }).gt(0, { error: COG_RANGE }).max(MAX_COG_OFFSET_PERCENT, { error: COG_RANGE }),
  bodyStyle: z.enum(BODY_STYLE_CHOICES),
})

export type VehicleTypeFormInput = z.input<typeof vehicleTypeFormSchema>
export type VehicleTypeFormValues = z.output<typeof vehicleTypeFormSchema>

/** Tỷ lệ → phần trăm cho ô nhập, hai chữ số lẻ: `0.15 * 100` trôi thành 15,000000000000002. */
export function ratioToPercent(ratio: number): number {
  return Math.round(ratio * 10_000) / 100
}

/** Phần trăm → tỷ lệ kho giữ, bốn chữ số lẻ. */
export function percentToRatio(percent: number): number {
  return Math.round(percent * 100) / 10_000
}

export const EMPTY_VEHICLE_TYPE: VehicleTypeFormInput = {
  name: '',
  cargoLengthCm: Number.NaN,
  cargoWidthCm: Number.NaN,
  cargoHeightCm: Number.NaN,
  payloadKg: Number.NaN,
  frontAxleLimitKg: Number.NaN,
  rearAxleLimitKg: Number.NaN,
  maxCogOffsetPercent: ratioToPercent(DEFAULT_MAX_COG_OFFSET_RATIO),
  bodyStyle: BODY_STYLE_AUTO,
}

export function toVehicleTypeForm(type: Omit<VehicleType, 'companyId' | 'createdAt'>): VehicleTypeFormInput {
  return {
    name: type.name,
    cargoLengthCm: type.cargoLengthCm,
    cargoWidthCm: type.cargoWidthCm,
    cargoHeightCm: type.cargoHeightCm,
    payloadKg: type.payloadKg,
    frontAxleLimitKg: type.frontAxleLimitKg ?? Number.NaN,
    rearAxleLimitKg: type.rearAxleLimitKg ?? Number.NaN,
    maxCogOffsetPercent: ratioToPercent(type.maxCogOffsetRatio),
    bodyStyle: type.bodyStyle ?? BODY_STYLE_AUTO,
  }
}

/** Giá trị đã qua schema → đầu vào của kho; giới hạn trục để trống hay kiểu thân tự chọn thì không có trường đó. */
export function toVehicleTypeInput(values: VehicleTypeFormValues): VehicleTypeInput {
  return {
    name: values.name,
    cargoLengthCm: roundCm(values.cargoLengthCm),
    cargoWidthCm: roundCm(values.cargoWidthCm),
    cargoHeightCm: roundCm(values.cargoHeightCm),
    payloadKg: roundKg(values.payloadKg),
    ...(values.frontAxleLimitKg === undefined ? {} : { frontAxleLimitKg: roundKg(values.frontAxleLimitKg) }),
    ...(values.rearAxleLimitKg === undefined ? {} : { rearAxleLimitKg: roundKg(values.rearAxleLimitKg) }),
    maxCogOffsetRatio: percentToRatio(values.maxCogOffsetPercent),
    ...(values.bodyStyle === BODY_STYLE_AUTO ? {} : { bodyStyle: values.bodyStyle }),
  }
}
