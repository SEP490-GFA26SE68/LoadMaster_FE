import { z } from 'zod'
import type { MessageKey } from '@/lib/i18n'

/**
 * Form "Thử với hàng của bạn" (`#thu-ngay`): luật thuần, không React. Ô nhập giữ chữ (khách gõ "45,5" hay "45.5"); schema chỉ kiểm, đổi
 * sang số là việc của `toTryInput` sau khi qua schema. Message của schema là key từ điển, nên lỗi đổi theo ngôn ngữ.
 */

/** Khoảng nhận được của một ô (cm, kg hoặc số kiện). `integer`: chỉ số nguyên, không dấu ngăn nào. */
export type FieldLimits = { readonly min: number; readonly max: number; readonly integer?: boolean }

/** Lòng thùng xe: từ xe tải nhỏ tới sơ mi rơ moóc. */
export const TRUCK_LIMITS = {
  lengthCm: { min: 100, max: 1400 },
  widthCm: { min: 100, max: 260 },
  heightCm: { min: 100, max: 300 },
  payloadKg: { min: 100, max: 30_000 },
} as const satisfies Record<string, FieldLimits>

/** Một loại kiện. */
export const CARTON_LIMITS = {
  lengthCm: { min: 5, max: 300 },
  widthCm: { min: 5, max: 300 },
  heightCm: { min: 5, max: 300 },
  weightKg: { min: 0.1, max: 1000 },
  quantity: { min: 1, max: 1000, integer: true },
} as const satisfies Record<string, FieldLimits>

/**
 * Trần tổng số kiện một lần thử: đúng cổng hiệu năng của bộ tối ưu mô phỏng (1.000 kiện, cả ba phương án dưới 1 giây —
 * `services/optimization/mock-optimization.bench.ts`). Đổi cổng thì đổi số này cùng lúc.
 */
export const MAX_TOTAL_QUANTITY = 1000
/** Số loại kiện tối đa, cũng là số điểm giao chọn được: mỗi loại một điểm thì đủ bốn điểm. */
export const MAX_CARTON_KINDS = 4
export const STOP_CHOICES = ['1', '2', '3', '4'] as const
export type StopChoice = (typeof STOP_CHOICES)[number]

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

/** Số nguyên có nhóm nghìn bằng một loại dấu ("1.500" · "1,500" · "12.000.000"); nhóm đầu không bắt đầu bằng 0 ("0,500" không phải 500). */
const GROUPED = /^[1-9]\d{0,2}([.,])\d{3}(?:\1\d{3})*$/
/** Số không nhóm nghìn, dấu thập phân "," hoặc "." với tối đa hai chữ số sau dấu ("45,5" · "45.5"). */
const PLAIN = /^\d+(?:[.,]\d{1,2})?$/

/**
 * Số khách gõ, bỏ khoảng trắng. Ba chữ số sau dấu luôn là nhóm nghìn ("3.500" và "3,500" đều là 3500), vì phần thập phân chỉ nhận tối đa
 * hai chữ số — nên số đọc ra không phụ thuộc ngôn ngữ đang chọn. Chữ khác, số âm, và "0,500" (ba chữ số sau dấu mà không phải nhóm
 * nghìn): `null`.
 */
export function parseTryNumber(raw: string): number | null {
  const text = raw.replace(/\s/g, '')
  if (GROUPED.test(text)) return Number(text.replace(/[.,]/g, ''))
  return PLAIN.test(text) ? Number(text.replace(',', '.')) : null
}

/** Ô gõ một số nguyên (có hoặc không nhóm nghìn), không phần thập phân. */
function isWholeText(raw: string): boolean {
  const text = raw.replace(/\s/g, '')
  return /^\d+$/.test(text) || GROUPED.test(text)
}

/** Lỗi của một ô (key từ điển), hoặc `null` khi ô đọc được và nằm trong khoảng. */
function fieldError(raw: string, { min, max, integer = false }: FieldLimits): string | null {
  if (raw.trim() === '') return TRY_ERRORS.required
  const value = parseTryNumber(raw)
  if (value === null) return TRY_ERRORS.number
  if (integer && !isWholeText(raw)) return TRY_ERRORS.integer
  if (value < min || value > max) return TRY_ERRORS.range
  return null
}

function numberField(limits: FieldLimits) {
  return z.string().superRefine((raw, ctx) => {
    const message = fieldError(raw, limits)
    if (message !== null) ctx.addIssue({ code: 'custom', message })
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
  stop: z.enum(STOP_CHOICES),
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

/** Số đã qua schema: cm, kg, số kiện, điểm giao. */
export type TryTruck = { readonly lengthCm: number; readonly widthCm: number; readonly heightCm: number; readonly payloadKg: number }
export type TryCarton = {
  readonly lengthCm: number
  readonly widthCm: number
  readonly heightCm: number
  readonly weightKg: number
  readonly quantity: number
  readonly stop: number
}
export type TryInput = { readonly truck: TryTruck; readonly cartons: readonly TryCarton[] }

/** Tổng số kiện đọc được của các loại kiện; ô chưa đọc được tính 0. */
export function totalQuantity(cartons: readonly Pick<TryCartonValues, 'quantity'>[]): number {
  return cartons.reduce((sum, { quantity }) => sum + (parseTryNumber(quantity) ?? 0), 0)
}

/** Số của cả form theo đúng luật của schema (kể cả trần tổng số kiện), hoặc `null`. */
export function toTryInput(values: TryFormValues): TryInput | null {
  if (!tryFormSchema.safeParse(values).success) return null
  const read = (raw: string) => parseTryNumber(raw) as number
  const { truck } = values
  return {
    truck: { lengthCm: read(truck.lengthCm), widthCm: read(truck.widthCm), heightCm: read(truck.heightCm), payloadKg: read(truck.payloadKg) },
    cartons: values.cartons.map((carton) => ({
      lengthCm: read(carton.lengthCm),
      widthCm: read(carton.widthCm),
      heightCm: read(carton.heightCm),
      weightKg: read(carton.weightKg),
      quantity: read(carton.quantity),
      stop: Number(carton.stop),
    })),
  }
}

/** Hai bộ số giống hệt nhau — kết quả đang hiện còn đúng với form không ("45,0" và "45" là một). */
export function sameInput(a: TryInput | null, b: TryInput | null): boolean {
  return a !== null && b !== null && JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Form mở ra với một xe tải 3,5 tấn thùng kín (lòng thùng 520 × 200 × 200 cm — cỡ xe Hino XZU720 trong đội xe mẫu Long Bình của ứng dụng) và ba
 * loại thùng carton cho ba điểm giao — 48 thùng 60 × 40 × 40 cm (15 kg), 60 thùng 50 × 40 × 30 cm (8 kg), 16 thùng 80 × 60 × 50 cm
 * (30 kg): 124 kiện, 1.680 kg, 12,048 m³ trên 20,8 m³ của thùng. Bấm chạy được ngay, và lần chạy đầu đã có hàng của ba điểm giao để so ba
 * phương án (màu điểm giao, số kiện dỡ-xếp lại).
 */
export const TRY_DEFAULTS: TryFormValues = {
  truck: { lengthCm: '520', widthCm: '200', heightCm: '200', payloadKg: '3500' },
  cartons: [
    { lengthCm: '60', widthCm: '40', heightCm: '40', weightKg: '15', quantity: '48', stop: '1' },
    { lengthCm: '50', widthCm: '40', heightCm: '30', weightKg: '8', quantity: '60', stop: '2' },
    { lengthCm: '80', widthCm: '60', heightCm: '50', weightKg: '30', quantity: '16', stop: '3' },
  ],
}

/** Loại kiện thêm vào thứ `index` (0–3): thùng nhỏ hơn, giao điểm kế tiếp, để ba phương án có hàng của nhiều điểm giao mà so. */
export function addedCarton(index: number): TryCartonValues {
  const stop = STOP_CHOICES[Math.min(index, STOP_CHOICES.length - 1)] ?? '1'
  return { lengthCm: '40', widthCm: '30', heightCm: '30', weightKg: '8', quantity: '60', stop }
}
