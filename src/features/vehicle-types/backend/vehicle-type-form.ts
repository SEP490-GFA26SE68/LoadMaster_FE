import { z } from 'zod'
import { roundCm, roundKg } from '@/domain/geometry'
import { DEFAULT_MAX_COG_OFFSET_RATIO, MAX_COG_OFFSET_RATIO_CEILING } from '@/domain/models'
import type { MessageKey } from '@/lib/i18n'
import { BODY_STYLE_AUTO, BODY_STYLE_CHOICES } from '../vehicle-type-form'
import type {
  VehicleType,
  VehicleTypeInput,
} from './vehicle-types-api'
/**
 * Form loại xe (LM-104, FE-5b-01). Message của schema là key từ điển: đổi ngôn ngữ thì lỗi đổi theo. Kích thước cm, tải trọng và giới
 * hạn trục kg (D-03), làm tròn tại biên khi lưu. Ô số đọc bằng `valueAsNumber`: ô trống là `NaN` — giới hạn trục để trống nghĩa là
 * loại xe chưa khai. Độ lệch trọng tâm nhập bằng phần trăm, kho giữ tỷ lệ (`maxCogOffsetRatio`). Lệch ngang (`maxCogOffsetRatioY`) và tải
 * trọng sàn (kg/m²) tuỳ chọn: trống là chưa khai, không bao giờ tự điền. Kiểu thân xe dùng cùng lựa chọn với form kho mẫu
 * (`BODY_STYLE_CHOICES`): "Tự chọn theo kích thước" là `AUTO`, lưu thành loại xe không có `bodyStyle`.
 */
export const NAME_MAX = 80
export const POSITIVE = 'vehicleTypes.form.errors.positive' satisfies MessageKey
export const COG_RANGE = 'vehicleTypes.form.errors.cogRange' satisfies MessageKey
export const CANNOT_CLEAR = 'physicalData.errors.cannotClear' satisfies MessageKey
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
/** Tọa độ trục: cho phép âm, 0 hoặc dương; ô trống là chưa khai báo. */
const optionalFinite = z
  .union([z.number().finite(), z.nan()])
  .transform((value) =>
    Number.isNaN(value) ? undefined : value,
  )

/** Tải trọng trục khi xe rỗng: không âm; ô trống là chưa khai báo. */
const optionalNonNegative = z
  .union([z.number().finite().nonnegative(), z.nan()])
  .transform((value) =>
    Number.isNaN(value) ? undefined : value,
  )

const optionalDoorDimension = optionalPositive

/** Ô phần trăm tuỳ chọn: trống là chưa khai; có số thì lớn hơn 0 và không quá trần. */
const optionalCogPercent = z
  .union([z.number(), z.nan()])
  .superRefine((value, ctx) => {
    if (!Number.isNaN(value) && !(value > 0 && value <= MAX_COG_OFFSET_PERCENT)) ctx.addIssue({ code: 'custom', message: COG_RANGE })
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

  doorWidthCm: optionalDoorDimension,
  doorHeightCm: optionalDoorDimension,

  payloadKg: positive,

  frontAxleLimitKg: optionalPositive,
  rearAxleLimitKg: optionalPositive,
  frontAxleX: optionalFinite,
  rearAxleX: optionalFinite,

  emptyFrontAxleLoadKg: optionalNonNegative,
  emptyRearAxleLoadKg: optionalNonNegative,

  maxCogOffsetPercent: z
    .number({ error: COG_RANGE })
    .gt(0, { error: COG_RANGE })
    .max(
      MAX_COG_OFFSET_PERCENT,
      { error: COG_RANGE },
    ),
  maxCogOffsetPercentY: optionalCogPercent,
  floorLoadCapacityKgM2: optionalPositive,

  hazardousCapable: z.boolean(),
  bodyStyle: z.enum(BODY_STYLE_CHOICES),

  obstacles: z.array(obstacleSchema),
})
  .superRefine((values, ctx) => {
    const { doorWidthCm, doorHeightCm } = values

    if (
      (doorWidthCm === undefined) !==
      (doorHeightCm === undefined)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: [
          doorWidthCm === undefined
            ? 'doorWidthCm'
            : 'doorHeightCm',
        ],
        message: 'vehicleTypes.form.errors.doorPairRequired',
      })
    }

    if (
      doorWidthCm !== undefined &&
      doorWidthCm > values.cargoWidthCm
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['doorWidthCm'],
        message: 'vehicleTypes.form.errors.doorWidthExceeded',
      })
    }

    if (
      doorHeightCm !== undefined &&
      doorHeightCm > values.cargoHeightCm
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['doorHeightCm'],
        message: 'vehicleTypes.form.errors.doorHeightExceeded',
      })
    }
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

  doorWidthCm: Number.NaN,
  doorHeightCm: Number.NaN,

  payloadKg: Number.NaN,

  frontAxleLimitKg: Number.NaN,
  rearAxleLimitKg: Number.NaN,
  frontAxleX: Number.NaN,
  rearAxleX: Number.NaN,

  emptyFrontAxleLoadKg: Number.NaN,
  emptyRearAxleLoadKg: Number.NaN,

  maxCogOffsetPercent:
    ratioToPercent(
      DEFAULT_MAX_COG_OFFSET_RATIO,
    ),
  maxCogOffsetPercentY: Number.NaN,
  floorLoadCapacityKgM2: Number.NaN,

  hazardousCapable: false,
  bodyStyle: BODY_STYLE_AUTO,

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

    doorWidthCm: type.doorWidthCm ?? Number.NaN,
    doorHeightCm: type.doorHeightCm ?? Number.NaN,

    payloadKg:
      type.payloadKg,

    frontAxleLimitKg:
      type.frontAxleLimitKg
      ?? Number.NaN,

    rearAxleLimitKg:
      type.rearAxleLimitKg
      ?? Number.NaN,
    frontAxleX: type.frontAxleX ?? Number.NaN,
    rearAxleX: type.rearAxleX ?? Number.NaN,

    emptyFrontAxleLoadKg:
      type.emptyFrontAxleLoadKg ?? Number.NaN,

    emptyRearAxleLoadKg:
      type.emptyRearAxleLoadKg ?? Number.NaN,

    maxCogOffsetPercent:
      ratioToPercent(
        type.maxCogOffsetRatio,
      ),
    maxCogOffsetPercentY: type.maxCogOffsetRatioY === null ? Number.NaN : ratioToPercent(type.maxCogOffsetRatioY),
    floorLoadCapacityKgM2: type.floorLoadCapacityKgM2 ?? Number.NaN,

    hazardousCapable:
      type.hazardousCapable,
    bodyStyle: type.bodyStyle ?? BODY_STYLE_AUTO,

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
    ...(values.doorWidthCm === undefined
      ? {}
      : {
        doorWidthCm: roundCm(values.doorWidthCm),
      }),

    ...(values.doorHeightCm === undefined
      ? {}
      : {
        doorHeightCm: roundCm(values.doorHeightCm),
      }),

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
    ...(values.frontAxleX === undefined
      ? {}
      : { frontAxleX: roundCm(values.frontAxleX) }),

    ...(values.rearAxleX === undefined
      ? {}
      : { rearAxleX: roundCm(values.rearAxleX) }),

    ...(values.emptyFrontAxleLoadKg === undefined
      ? {}
      : {
        emptyFrontAxleLoadKg:
          roundKg(values.emptyFrontAxleLoadKg),
      }),

    ...(values.emptyRearAxleLoadKg === undefined
      ? {}
      : {
        emptyRearAxleLoadKg:
          roundKg(values.emptyRearAxleLoadKg),
      }),

    maxCogOffsetRatio:
      percentToRatio(
        values.maxCogOffsetPercent,
      ),
    ...(values.maxCogOffsetPercentY === undefined
      ? {}
      : { maxCogOffsetRatioY: percentToRatio(values.maxCogOffsetPercentY) }),
    // kg/m², hai chữ số lẻ như cột của máy chủ.
    ...(values.floorLoadCapacityKgM2 === undefined
      ? {}
      : { floorLoadCapacityKgM2: roundKg(values.floorLoadCapacityKgM2) }),

    hazardousCapable:
      values.hazardousCapable,
    ...(values.bodyStyle === BODY_STYLE_AUTO ? {} : { bodyStyle: values.bodyStyle }),

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

/**
 * Máy chủ bỏ qua `null` khi sửa loại xe, nên lệch ngang và tải trọng sàn đã lưu không xoá được: để trống rồi lưu thì giá trị cũ vẫn
 * còn. Trả các ô đang bị xoá để form chặn kèm lý do thay vì báo đã lưu.
 */
export function clearedPhysicalLimits(
  type: VehicleType | null,
  values: VehicleTypeFormValues,
): ('maxCogOffsetPercentY' | 'floorLoadCapacityKgM2')[] {
  if (!type) return []
  const cleared: ('maxCogOffsetPercentY' | 'floorLoadCapacityKgM2')[] = []
  if (type.maxCogOffsetRatioY !== null && values.maxCogOffsetPercentY === undefined) cleared.push('maxCogOffsetPercentY')
  if (type.floorLoadCapacityKgM2 !== null && values.floorLoadCapacityKgM2 === undefined) cleared.push('floorLoadCapacityKgM2')
  return cleared
}
