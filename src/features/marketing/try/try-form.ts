import { z } from 'zod'
import { SPEC_CARTON_A, SPEC_TRUCK_6M } from '@/domain/fixtures/spec-samples'
import type { VehicleConfig } from '@/domain/models'
import type { MessageKey } from '@/lib/i18n'
import { seedVehicles } from '@/lib/mock-db/seed-vehicles'

/**
 * Form "Thử với xe của bạn" (`#thu-xe`): luật thuần, không React. Ô nhập giữ chữ (khách gõ "45,5" hay "45.5"); schema chỉ kiểm, đổi sang số
 * là việc của `toTryInput` sau khi qua schema. Message của schema là key từ điển, nên lỗi đổi theo ngôn ngữ.
 */

/** Khoảng nhận được của một ô (cm, kg hoặc số kiện). `integer`: chỉ số nguyên. */
export type FieldLimits = { readonly min: number; readonly max: number; readonly integer?: boolean }

/** Lòng thùng xe của bản thử. */
export const TRUCK_LIMITS = {
  lengthCm: { min: 100, max: 1400 },
  widthCm: { min: 100, max: 260 },
  heightCm: { min: 100, max: 300 },
  payloadKg: { min: 100, max: 30_000 },
} as const satisfies Record<string, FieldLimits>

/** Một loại kiện của bản thử. */
export const CARTON_LIMITS = {
  lengthCm: { min: 5, max: 300 },
  widthCm: { min: 5, max: 300 },
  heightCm: { min: 5, max: 300 },
  weightKg: { min: 0.1, max: 1000 },
  quantity: { min: 1, max: 400, integer: true },
} as const satisfies Record<string, FieldLimits>

/** Trần tổng số kiện một lần thử: đủ nhỏ để bộ tối ưu mô phỏng xong trong tích tắc trên máy yếu. */
export const MAX_TOTAL_QUANTITY = 400
export const MAX_CARTON_KINDS = 2

export type TruckField = keyof typeof TRUCK_LIMITS
export type CartonField = keyof typeof CARTON_LIMITS
export const TRUCK_FIELDS = Object.keys(TRUCK_LIMITS) as TruckField[]
export const CARTON_FIELDS = Object.keys(CARTON_LIMITS) as CartonField[]

export const TRY_ERRORS = {
  required: 'landingTry.errors.required',
  number: 'landingTry.errors.number',
  integer: 'landingTry.errors.integer',
  range: 'landingTry.errors.range',
  totalQuantity: 'landingTry.errors.totalQuantity',
} as const satisfies Record<string, MessageKey>

const NUMBER = /^\d+(?:[.,]\d+)?$/

/** Số khách gõ, dấu thập phân là "," hoặc "." ("45,5" · "45.5"), bỏ khoảng trắng. Chữ khác, số âm, nhóm nghìn: `null`. */
export function parseTryNumber(raw: string): number | null {
  const text = raw.replace(/\s/g, '')
  return NUMBER.test(text) ? Number(text.replace(',', '.')) : null
}

function numberField({ min, max, integer = false }: FieldLimits) {
  return z.string().superRefine((raw, ctx) => {
    const value = parseTryNumber(raw)
    if (raw.trim() === '') ctx.addIssue({ code: 'custom', message: TRY_ERRORS.required })
    else if (value === null) ctx.addIssue({ code: 'custom', message: TRY_ERRORS.number })
    else if (integer && !Number.isInteger(value)) ctx.addIssue({ code: 'custom', message: TRY_ERRORS.integer })
    else if (value < min || value > max) ctx.addIssue({ code: 'custom', message: TRY_ERRORS.range })
  })
}

const truckSchema = z.object({
  lengthCm: numberField(TRUCK_LIMITS.lengthCm),
  widthCm: numberField(TRUCK_LIMITS.widthCm),
  heightCm: numberField(TRUCK_LIMITS.heightCm),
  payloadKg: numberField(TRUCK_LIMITS.payloadKg),
})

const cartonSchema = z.object({
  lengthCm: numberField(CARTON_LIMITS.lengthCm),
  widthCm: numberField(CARTON_LIMITS.widthCm),
  heightCm: numberField(CARTON_LIMITS.heightCm),
  weightKg: numberField(CARTON_LIMITS.weightKg),
  quantity: numberField(CARTON_LIMITS.quantity),
})

export const tryFormSchema = z
  .object({ truck: truckSchema, cartons: z.array(cartonSchema).min(1).max(MAX_CARTON_KINDS) })
  .superRefine(({ cartons }, ctx) => {
    if (totalQuantity(cartons) > MAX_TOTAL_QUANTITY) {
      ctx.addIssue({ code: 'custom', path: ['cartons', cartons.length - 1, 'quantity'], message: TRY_ERRORS.totalQuantity })
    }
  })

export type TryFormValues = z.infer<typeof tryFormSchema>
export type TryTruckValues = TryFormValues['truck']
export type TryCartonValues = TryFormValues['cartons'][number]

/** Số đã qua schema: cm, kg, số kiện. */
export type TryTruck = { readonly lengthCm: number; readonly widthCm: number; readonly heightCm: number; readonly payloadKg: number }
export type TryCarton = {
  readonly lengthCm: number
  readonly widthCm: number
  readonly heightCm: number
  readonly weightKg: number
  readonly quantity: number
}
export type TryInput = { readonly truck: TryTruck; readonly cartons: readonly TryCarton[] }

/** Tổng số kiện đọc được của các loại kiện; ô chưa đọc được tính 0. */
export function totalQuantity(cartons: readonly Pick<TryCartonValues, 'quantity'>[]): number {
  return cartons.reduce((sum, { quantity }) => sum + (parseTryNumber(quantity) ?? 0), 0)
}

function inLimits(raw: string, { min, max, integer = false }: FieldLimits): number | null {
  const value = parseTryNumber(raw)
  if (value === null || value < min || value > max || (integer && !Number.isInteger(value))) return null
  return value
}

function readAll<Field extends string>(values: Record<Field, string>, limits: Record<Field, FieldLimits>): Record<Field, number> | null {
  const out: Partial<Record<Field, number>> = {}
  for (const field of Object.keys(limits) as Field[]) {
    const value = inLimits(values[field], limits[field])
    if (value === null) return null
    out[field] = value
  }
  return out as Record<Field, number>
}

/** Số của lòng thùng, hoặc `null` khi còn ô chưa hợp lệ (hình xem trước giữ số mẫu cho ô đó). */
export function readTruck(values: TryTruckValues): TryTruck | null {
  return readAll(values, TRUCK_LIMITS)
}

/**
 * Số để vẽ lòng thùng trong lúc khách đang gõ: ô chưa đọc được dùng số của xe mẫu đầu tiên, số ngoài khoảng kéo về mép khoảng — hình
 * không nhảy về trống mỗi lần xoá một chữ số.
 */
export function previewTruck(values: TryTruckValues): TryTruck {
  const read = (field: TruckField) => {
    const value = parseTryNumber(values[field])
    const { min, max } = TRUCK_LIMITS[field]
    return value === null ? SPEC_PRESET.truck[field] : Math.min(max, Math.max(min, value))
  }
  return { lengthCm: read('lengthCm'), widthCm: read('widthCm'), heightCm: read('heightCm'), payloadKg: read('payloadKg') }
}

/** Số của cả form theo đúng luật của schema (kể cả trần tổng số kiện), hoặc `null`. */
export function toTryInput(values: TryFormValues): TryInput | null {
  if (!tryFormSchema.safeParse(values).success) return null
  const truck = readTruck(values.truck)
  const cartons = values.cartons.map((carton) => readAll(carton, CARTON_LIMITS))
  if (truck === null || cartons.some((carton) => carton === null)) return null
  return { truck, cartons: cartons.filter((carton) => carton !== null) }
}

/** Hai bộ số giống hệt nhau — kết quả đang hiện còn đúng với form không. */
export function sameInput(a: TryInput | null, b: TryInput | null): boolean {
  return a !== null && b !== null && JSON.stringify(a) === JSON.stringify(b)
}

function truckOf(vehicle: VehicleConfig): TryTruck {
  return { lengthCm: vehicle.innerLengthCm, widthCm: vehicle.innerWidthCm, heightCm: vehicle.innerHeightCm, payloadKg: vehicle.maxPayloadKg }
}

const innerVolume = (vehicle: VehicleConfig) => vehicle.innerLengthCm * vehicle.innerWidthCm * vehicle.innerHeightCm
const FLEET = seedVehicles().toSorted((a, b) => innerVolume(a) - innerVolume(b))

export type TruckPresetId = 'spec' | 'smallest' | 'largest'
export type TruckPreset = { readonly id: TruckPresetId; readonly truck: TryTruck }

/**
 * Xe mẫu: "Truck 6m" của Spec mục 12, xe có lòng thùng nhỏ nhất và lớn nhất của đội xe seed — số lấy thẳng từ dữ liệu của ứng dụng,
 * không gõ lại. Chỉ lấy lòng thùng và tải trọng; cửa và vật cản bản thử không dùng.
 */
const SPEC_PRESET: TruckPreset = { id: 'spec', truck: truckOf(SPEC_TRUCK_6M) }

export const TRUCK_PRESETS: readonly TruckPreset[] = [
  SPEC_PRESET,
  { id: 'smallest', truck: truckOf(FLEET[0] ?? SPEC_TRUCK_6M) },
  { id: 'largest', truck: truckOf(FLEET.at(-1) ?? SPEC_TRUCK_6M) },
]

/** Kiện mẫu: "Carton A" của Spec mục 12 (kích thước, khối lượng, số kiện). */
export const CARTON_PRESET = {
  name: SPEC_CARTON_A.name,
  carton: {
    lengthCm: SPEC_CARTON_A.lengthCm,
    widthCm: SPEC_CARTON_A.widthCm,
    heightCm: SPEC_CARTON_A.heightCm,
    weightKg: SPEC_CARTON_A.weightKg,
    quantity: SPEC_CARTON_A.quantity,
  } satisfies TryCarton,
} as const

/** Số → chữ của ô nhập (dấu thập phân "." — ô nhận cả hai dấu). */
export function truckValues(truck: TryTruck): TryTruckValues {
  return { lengthCm: String(truck.lengthCm), widthCm: String(truck.widthCm), heightCm: String(truck.heightCm), payloadKg: String(truck.payloadKg) }
}

export function cartonValues(carton: TryCarton): TryCartonValues {
  return {
    lengthCm: String(carton.lengthCm),
    widthCm: String(carton.widthCm),
    heightCm: String(carton.heightCm),
    weightKg: String(carton.weightKg),
    quantity: String(carton.quantity),
  }
}

export const EMPTY_CARTON: TryCartonValues = { lengthCm: '', widthCm: '', heightCm: '', weightKg: '', quantity: '' }

/** Form mở ra với xe "Truck 6m" và kiện "Carton A" của Spec. */
export const TRY_DEFAULTS: TryFormValues = {
  truck: truckValues(SPEC_PRESET.truck),
  cartons: [cartonValues(CARTON_PRESET.carton)],
}
