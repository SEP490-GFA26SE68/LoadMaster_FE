import { z } from 'zod'
import { roundCm, roundKg } from '@/domain/geometry'
import { DEFAULT_MAX_COG_OFFSET_RATIO, MAX_COG_OFFSET_RATIO_CEILING } from '@/domain/models'
import type { MessageKey } from '@/lib/i18n'
import type {
  VehicleType,
  VehicleTypeInput,
} from './vehicle-types-api'
/**
 * Form loại xe (LM-104, FE-5b-01). Message của schema là key từ điển: đổi ngôn ngữ thì lỗi đổi theo. Kích thước cm, tải trọng và giới
 * hạn trục kg (D-03), làm tròn tại biên khi lưu. Ô số đọc bằng `valueAsNumber`: ô trống là `NaN` — giới hạn trục để trống nghĩa là
 * loại xe chưa khai. Độ lệch trọng tâm nhập bằng phần trăm, kho giữ tỷ lệ (`maxCogOffsetRatio`).
 */
export const NAME_MAX = 80
export const POSITIVE = 'vehicleTypes.form.errors.positive' satisfies MessageKey
export const COG_RANGE = 'vehicleTypes.form.errors.cogRange' satisfies MessageKey
/** Trần của ô phần trăm: trọng tâm không thể lệch quá nửa thùng. */
export const MAX_COG_OFFSET_PERCENT = MAX_COG_OFFSET_RATIO_CEILING * 100

const positive = z.number({ error: POSITIVE }).gt(0, { error: POSITIVE })

const obstacleSchema = z.object({
  name: z.string().trim().min(1),

  type: z.enum([
    'WHEEL_ARCH',
    'COOLING_UNIT',
    'PARTITION',
    'RESERVED_ZONE',
    'OTHER',
  ]),

  x: z.number().min(0),
  y: z.number().min(0),
  z: z.number().min(0),

  length: positive,
  width: positive,
  height: positive,

  loadBearing: z.boolean(),
})

/** Ô trống (`NaN`) là chưa khai; có số thì phải lớn hơn 0. */
const optionalPositive = z
  .union([z.number(), z.nan()])
  .superRefine((value, ctx) => {
    if (!Number.isNaN(value) && !(value > 0)) ctx.addIssue({ code: 'custom', message: POSITIVE })
  })
  .transform((value) => (Number.isNaN(value) ? undefined : value))

export const vehicleTypeFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(
      1,
      'vehicleTypes.form.errors.nameRequired',
    )
    .max(
      NAME_MAX,
      'vehicleTypes.form.errors.nameTooLong',
    ),

  cargoLengthCm: positive,
  cargoWidthCm: positive,
  cargoHeightCm: positive,

  payloadKg: positive,

  frontAxleLimitKg: optionalPositive,
  rearAxleLimitKg: optionalPositive,

  maxCogOffsetPercent: z
    .number({ error: COG_RANGE })
    .gt(0, { error: COG_RANGE })
    .max(
      MAX_COG_OFFSET_PERCENT,
      { error: COG_RANGE },
    ),

  hazardousCapable: z.boolean(),

  obstacles: z.array(obstacleSchema),
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

  maxCogOffsetPercent:
    ratioToPercent(
      DEFAULT_MAX_COG_OFFSET_RATIO,
    ),

  hazardousCapable: false,

  obstacles: [],
}

export function toVehicleTypeForm(
  type: VehicleType,
): VehicleTypeFormInput {
  return {
    name: type.name,

    cargoLengthCm:
      type.cargoLengthCm,

    cargoWidthCm:
      type.cargoWidthCm,

    cargoHeightCm:
      type.cargoHeightCm,

    payloadKg:
      type.payloadKg,

    frontAxleLimitKg:
      type.frontAxleLimitKg
      ?? Number.NaN,

    rearAxleLimitKg:
      type.rearAxleLimitKg
      ?? Number.NaN,

    maxCogOffsetPercent:
      ratioToPercent(
        type.maxCogOffsetRatio,
      ),

    hazardousCapable:
      type.hazardousCapable,

    obstacles:
      type.obstacles.map(
        (obstacle) => ({
          name: obstacle.name,
          type: obstacle.type,

          x: obstacle.x,
          y: obstacle.y,
          z: obstacle.z,

          length: obstacle.length,
          width: obstacle.width,
          height: obstacle.height,

          loadBearing:
            obstacle.loadBearing,
        }),
      ),
  }
}

/** Giá trị đã qua schema → đầu vào của kho; giới hạn trục để trống thì không có trường đó. */
export function toVehicleTypeInput(
  values: VehicleTypeFormValues,
): VehicleTypeInput {
  return {
    name: values.name,

    cargoLengthCm:
      roundCm(values.cargoLengthCm),

    cargoWidthCm:
      roundCm(values.cargoWidthCm),

    cargoHeightCm:
      roundCm(values.cargoHeightCm),

    payloadKg:
      roundKg(values.payloadKg),

    ...(values.frontAxleLimitKg === undefined
      ? {}
      : {
          frontAxleLimitKg:
            roundKg(
              values.frontAxleLimitKg,
            ),
        }),

    ...(values.rearAxleLimitKg === undefined
      ? {}
      : {
          rearAxleLimitKg:
            roundKg(
              values.rearAxleLimitKg,
            ),
        }),

    maxCogOffsetRatio:
      percentToRatio(
        values.maxCogOffsetPercent,
      ),

    hazardousCapable:
      values.hazardousCapable,

    obstacles:
      values.obstacles.map(
        (obstacle) => ({
          ...obstacle,

          x: roundCm(obstacle.x),
          y: roundCm(obstacle.y),
          z: roundCm(obstacle.z),

          length:
            roundCm(obstacle.length),

          width:
            roundCm(obstacle.width),

          height:
            roundCm(obstacle.height),
        }),
      ),
  }
}
