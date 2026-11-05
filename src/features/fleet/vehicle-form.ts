import { z } from 'zod'
import { gt, lt, roundCm, roundKg } from '@/domain/geometry'
import type { VehicleConfig, VehicleObstacle } from '@/domain/models'
import type { TFunction } from '@/lib/i18n'

/**
 * Form cấu hình xe (Spec 9.2, LM-041). Hai lớp kiểm tra tách bạch:
 *
 * - **schema ở đây** chỉ lo từng ô: bắt buộc nhập, đúng kiểu số, tên không rỗng, các quy tắc một trường
 *   mà `validateVehicle` không xét (`clearanceCm`, tải trên của vật cản, tải trục). Câu lấy từ từ điển nên
 *   schema phải dựng theo `t` của ngôn ngữ đang chọn.
 * - **`validateVehicle` của `@/domain/constraints`** lo các quy tắc Spec nhiều trường (kích thước > 0, cửa ≤ lòng
 *   thùng, vật cản trong thùng, vật cản chồng nhau); câu qua `formatIssue` (D-28). Xem `vehicle-form-resolver.ts`.
 *
 * Không dùng thẳng `vehicleConfigSchema` làm resolver: message của nó là **mã** model (D-28) chứ không phải câu,
 * và zod 4 không cho `.omit('id')` trên schema đã có refinement. Xe mới mang `id` rỗng; `vehicles-api.ts` hiểu đó
 * là lệnh tạo mới.
 */

export const OBSTACLE_TYPES = ['WHEEL_ARCH', 'COOLING_UNIT', 'PARTITION', 'RESERVED_ZONE'] as const

/** Xe mới bắt đầu từ thùng 6 m phổ biến để người dùng sửa số, không phải từ ô trống. */
const NEW_VEHICLE = {
  innerLengthCm: 600,
  innerWidthCm: 240,
  innerHeightCm: 250,
  maxPayloadKg: 5000,
  doorWidthCm: 220,
  doorHeightCm: 230,
  clearanceCm: 0,
} as const

export function createVehicleFormSchema(t: TFunction) {
  const number = () => z.number({ error: t('fleet.form.numberRequired') })
  const nonNegativeKg = () => number().refine((value) => !lt(value, 0), t('fleet.axles.nonNegative'))

  const obstacle = z
    .object({
      id: z.string(),
      type: z.enum(OBSTACLE_TYPES),
      xCm: number(),
      yCm: number(),
      zCm: number(),
      lengthCm: number(),
      widthCm: number(),
      heightCm: number(),
      loadBearing: z.boolean(),
      /** `null` = ô để trống. */
      maxTopLoadKg: number().nullable(),
    })
    .superRefine((row, ctx) => {
      const load = row.maxTopLoadKg
      if (load === null) return
      if (lt(load, 0)) {
        ctx.addIssue({ code: 'custom', message: t('fleet.obstacles.maxTopLoadNonNegative'), path: ['maxTopLoadKg'] })
        return
      }
      // Cùng quy tắc với `vehicleConfigSchema`: vật cản không chịu tải khai tải trên là dữ liệu mâu thuẫn
      if (!row.loadBearing && gt(load, 0)) {
        ctx.addIssue({ code: 'custom', message: t('fleet.obstacles.maxTopLoadNotBearing'), path: ['maxTopLoadKg'] })
      }
    })

  const axle = z.object({
    id: z.string(),
    name: z.string().trim().min(1, t('fleet.axles.nameRequired')),
    positionXCm: number(),
    emptyLoadKg: nonNegativeKg(),
    maxLoadKg: nonNegativeKg(),
  })

  return z.object({
    id: z.string(),
    name: z.string().trim().min(1, t('fleet.form.nameRequired')),
    innerLengthCm: number(),
    innerWidthCm: number(),
    innerHeightCm: number(),
    maxPayloadKg: number(),
    doorWidthCm: number(),
    doorHeightCm: number(),
    clearanceCm: number().refine((value) => !lt(value, 0), t('fleet.form.clearanceNonNegative')),
    obstacles: z.array(obstacle),
    axles: z.array(axle),
  })
}

export type VehicleFormSchema = ReturnType<typeof createVehicleFormSchema>
export type VehicleFormValues = z.infer<VehicleFormSchema>
export type ObstacleFormValues = VehicleFormValues['obstacles'][number]
export type AxleFormValues = VehicleFormValues['axles'][number]

/** Xe đang sửa, hoặc xe mới khi `vehicle` vắng (`id` rỗng). */
export function toFormValues(vehicle?: VehicleConfig): VehicleFormValues {
  if (!vehicle) return { id: '', name: '', ...NEW_VEHICLE, obstacles: [], axles: [] }
  return {
    id: vehicle.id,
    name: vehicle.name,
    innerLengthCm: vehicle.innerLengthCm,
    innerWidthCm: vehicle.innerWidthCm,
    innerHeightCm: vehicle.innerHeightCm,
    maxPayloadKg: vehicle.maxPayloadKg,
    doorWidthCm: vehicle.doorWidthCm,
    doorHeightCm: vehicle.doorHeightCm,
    clearanceCm: vehicle.clearanceCm,
    // Form chỉ khai bốn loại vật cản; loại `OTHER` (mã của máy chủ) đọc như vùng dành riêng, như `fleet-dto.ts`
    obstacles: vehicle.obstacles.map((row) => ({ ...row, type: row.type === 'OTHER' ? 'RESERVED_ZONE' : row.type, maxTopLoadKg: row.maxTopLoadKg ?? null })),
    axles: vehicle.axles?.map((row) => ({ ...row })) ?? [],
  }
}

/**
 * Biên vào domain (AGENTS mục 6): mọi cm qua `roundCm`, mọi kg qua `roundKg`, đúng một lần ở đây.
 * `base` là xe đang sửa: các trường Spec 9.2 không có trên form (`floorMaxLoadKg`,
 * `floorPressureLimitKgPerCm2`) được giữ nguyên thay vì bị xoá khi lưu.
 */
export function toVehicleConfig(values: VehicleFormValues, base?: VehicleConfig): VehicleConfig {
  return {
    id: values.id,
    name: values.name.trim(),
    innerLengthCm: roundCm(values.innerLengthCm),
    innerWidthCm: roundCm(values.innerWidthCm),
    innerHeightCm: roundCm(values.innerHeightCm),
    maxPayloadKg: roundKg(values.maxPayloadKg),
    doorWidthCm: roundCm(values.doorWidthCm),
    doorHeightCm: roundCm(values.doorHeightCm),
    doorPosition: 'REAR',
    clearanceCm: roundCm(values.clearanceCm),
    ...(base?.floorMaxLoadKg === undefined ? {} : { floorMaxLoadKg: base.floorMaxLoadKg }),
    ...(base?.floorPressureLimitKgPerCm2 === undefined
      ? {}
      : { floorPressureLimitKgPerCm2: base.floorPressureLimitKgPerCm2 }),
    obstacles: values.obstacles.map(toObstacle),
    ...(values.axles.length === 0
      ? {}
      : {
          axles: values.axles.map((row) => ({
            id: row.id,
            name: row.name.trim(),
            positionXCm: roundCm(row.positionXCm),
            emptyLoadKg: roundKg(row.emptyLoadKg),
            maxLoadKg: roundKg(row.maxLoadKg),
          })),
        }),
  }
}

function toObstacle(row: ObstacleFormValues): VehicleObstacle {
  return {
    id: row.id,
    type: row.type,
    xCm: roundCm(row.xCm),
    yCm: roundCm(row.yCm),
    zCm: roundCm(row.zCm),
    lengthCm: roundCm(row.lengthCm),
    widthCm: roundCm(row.widthCm),
    heightCm: roundCm(row.heightCm),
    loadBearing: row.loadBearing,
    ...(row.maxTopLoadKg === null ? {} : { maxTopLoadKg: roundKg(row.maxTopLoadKg) }),
  }
}

/** Mã dòng mới, không trùng mã đang có: `OBS-001`, `AXLE-1`. */
export function nextRowId(prefix: string, rows: readonly { id: string }[], pad = 0): string {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`)
  const numbers = rows.map((row) => Number(pattern.exec(row.id)?.[1] ?? 0))
  return `${prefix}-${String(Math.max(0, ...numbers) + 1).padStart(pad, '0')}`
}

export function newObstacle(rows: readonly ObstacleFormValues[]): ObstacleFormValues {
  return {
    id: nextRowId('OBS', rows, 3),
    type: 'WHEEL_ARCH',
    xCm: 0,
    yCm: 0,
    zCm: 0,
    lengthCm: 100,
    widthCm: 25,
    heightCm: 30,
    loadBearing: false,
    maxTopLoadKg: null,
  }
}

export function newAxle(rows: readonly AxleFormValues[]): AxleFormValues {
  return { id: nextRowId('AXLE', rows), name: '', positionXCm: 0, emptyLoadKg: 0, maxLoadKg: 0 }
}
