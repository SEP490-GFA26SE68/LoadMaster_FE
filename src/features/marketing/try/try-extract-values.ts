import type { Locale } from '@/lib/i18n'
import { CARTON_FIELDS, MAX_CARTON_KINDS, MAX_TOTAL_QUANTITY, STOP_CHOICES, TRUCK_FIELDS, type CartonField, type StopChoice, type TruckField, type TryFormValues } from './try-form'

/**
 * Ô "Mô tả hàng bằng lời" của bản thử: luật thuần, không React. Máy chủ đọc mô tả của khách ra số (`try-extract-api.ts`); ở đây số đó
 * thành giá trị của form (chữ, như khách gõ) và các mục còn thiếu thành danh sách — form không bao giờ nhận số máy chủ không trả.
 */

/**
 * Mô tả dài nhất máy chủ nhận. Máy chủ đếm theo code point; ô đếm theo đơn vị UTF-16 (như `maxLength` của trình duyệt), không bao giờ ít
 * hơn — nên mô tả đã vừa ô thì máy chủ nhận.
 */
export const TRY_DESCRIBE_MAX = 1000

/** Thùng xe máy chủ đọc được; `null` ở một trường là mô tả không nói, hoặc số nằm ngoài khoảng của form. */
export type ExtractTruck = { readonly [Field in TruckField]: number | null }
/** Một loại kiện máy chủ đọc được; `stop` là số điểm giao (1–4). */
export type ExtractCarton = { readonly [Field in CartonField | 'stop']: number | null }

export type TryExtract = {
  /** `null`: mô tả không nói gì về xe — thùng xe của form giữ nguyên. */
  readonly truck: ExtractTruck | null
  /** Rỗng: không nhận ra kiện nào — form giữ nguyên. */
  readonly cartons: readonly ExtractCarton[]
  /** Điều máy chủ đã tự giả định, chữ của máy chủ theo ngôn ngữ của lượt gọi. */
  readonly assumptions: readonly string[]
  /** Đường dẫn trường máy chủ báo thiếu (`truck.lengthCm`, `cartons[1].weightKg`, `cartons`, `cartonKinds`, `totalQuantity`). */
  readonly missing: readonly string[]
}

/** Một mục còn thiếu, theo thứ tự của form: thùng xe, từng loại kiện, rồi hai trần của bản thử. */
export type ExtractGap =
  | { readonly kind: 'truck'; readonly field: TruckField }
  | { readonly kind: 'carton'; readonly index: number; readonly field: CartonField | 'stop' }
  | { readonly kind: 'cartonKinds' }
  | { readonly kind: 'totalQuantity' }

/** Ô của form phải kiểm ngay sau khi điền, để lỗi hiện tại chỗ. */
export type GapPath = `truck.${TruckField}` | `cartons.${number}.${CartonField}`

const CARTON_KEYS = [...CARTON_FIELDS, 'stop'] as const
const TRUCK_PATH = /^truck\.(\w+)$/
const CARTON_PATH = /^cartons(?:\[(\d+)\]|\.(\d+))\.(\w+)$/

/** Điểm giao máy chủ chưa đọc được: tạm để điểm 1 (ô chọn không có giá trị trống) — danh sách thiếu nói rõ điều đó. */
const FALLBACK_STOP: StopChoice = '1'

/**
 * Một số thành chữ của ô, như khách gõ: không nhóm nghìn (như giá trị mặc định của form), dấu thập phân theo ngôn ngữ ("12,5" · "12.5"),
 * tối đa hai chữ số sau dấu — đúng luật của ô. `null` hay số không đọc được thành ô trống.
 */
export function fieldText(value: number | null, locale: Locale): string {
  if (value === null || !Number.isFinite(value)) return ''
  const text = String(Math.round(value * 100) / 100)
  return locale === 'vi' ? text.replace('.', ',') : text
}

function stopText(stop: number | null): StopChoice {
  return STOP_CHOICES.find((choice) => Number(choice) === stop) ?? FALLBACK_STOP
}

/**
 * Giá trị mới của form từ kết quả, hoặc `null` khi không nhận ra kiện nào (form giữ nguyên). Xe `null` thì giữ thùng xe đang có; danh
 * sách loại kiện thay bằng các loại của kết quả (tối đa bốn). Bộ tối ưu không chạy ở đây — khách tự bấm "Tính ba phương án".
 */
export function extractValues(result: TryExtract, current: TryFormValues, locale: Locale): TryFormValues | null {
  if (result.cartons.length === 0) return null
  const { truck } = result
  return {
    truck: truck === null ? { ...current.truck } : {
      lengthCm: fieldText(truck.lengthCm, locale),
      widthCm: fieldText(truck.widthCm, locale),
      heightCm: fieldText(truck.heightCm, locale),
      payloadKg: fieldText(truck.payloadKg, locale),
    },
    cartons: result.cartons.slice(0, MAX_CARTON_KINDS).map((carton) => ({
      lengthCm: fieldText(carton.lengthCm, locale),
      widthCm: fieldText(carton.widthCm, locale),
      heightCm: fieldText(carton.heightCm, locale),
      weightKg: fieldText(carton.weightKg, locale),
      quantity: fieldText(carton.quantity, locale),
      stop: stopText(carton.stop),
    })),
  }
}

const isTruckField = (name: string): name is TruckField => (TRUCK_FIELDS as readonly string[]).includes(name)
const isCartonKey = (name: string): name is (typeof CARTON_KEYS)[number] => (CARTON_KEYS as readonly string[]).includes(name)
const gapKey = (gap: ExtractGap) => (gap.kind === 'truck' ? `truck.${gap.field}` : gap.kind === 'carton' ? `cartons.${gap.index}.${gap.field}` : gap.kind)

/** Một đường dẫn của máy chủ thành mục thiếu; đường lạ, loại kiện ngoài các loại đã điền, và `cartons` (không có kiện) bị bỏ. */
function gapOfPath(path: string, cartonCount: number): ExtractGap | null {
  if (path === 'cartonKinds' || path === 'totalQuantity') return { kind: path }
  const truck = TRUCK_PATH.exec(path)
  if (truck) return truck[1] !== undefined && isTruckField(truck[1]) ? { kind: 'truck', field: truck[1] } : null
  const carton = CARTON_PATH.exec(path)
  if (!carton) return null
  const index = Number(carton[1] ?? carton[2])
  const field = carton[3] ?? ''
  return index < cartonCount && isCartonKey(field) ? { kind: 'carton', index, field } : null
}

/**
 * Các mục còn thiếu sau khi điền, theo thứ tự của form, không trùng: mục máy chủ báo, cộng điều máy chủ quên báo mà form vẫn thấy — trường
 * để `null` (ô đó trống), hơn bốn loại kiện, tổng số kiện vượt trần. Không có kiện nào thì không có mục nào — form không đổi. Xe `null`
 * không thiếu gì: thùng xe giữ nguyên.
 */
export function extractGaps(result: TryExtract): ExtractGap[] {
  const cartons = result.cartons.slice(0, MAX_CARTON_KINDS)
  if (cartons.length === 0) return []
  const reported = new Set(result.missing.map((path) => gapOfPath(path, cartons.length)).flatMap((gap) => (gap ? [gapKey(gap)] : [])))
  const gaps: ExtractGap[] = []
  const add = (gap: ExtractGap, empty: boolean) => {
    if (empty || reported.has(gapKey(gap))) gaps.push(gap)
  }
  if (result.truck !== null) for (const field of TRUCK_FIELDS) add({ kind: 'truck', field }, result.truck[field] === null)
  cartons.forEach((carton, index) => {
    for (const field of CARTON_KEYS) add({ kind: 'carton', index, field }, carton[field] === null)
  })
  if (reported.has('cartonKinds') || result.cartons.length > MAX_CARTON_KINDS) gaps.push({ kind: 'cartonKinds' })
  const total = cartons.reduce((sum, { quantity }) => sum + (quantity ?? 0), 0)
  if (reported.has('totalQuantity') || total > MAX_TOTAL_QUANTITY) gaps.push({ kind: 'totalQuantity' })
  return gaps
}

/**
 * Ô phải kiểm ngay sau khi điền: ô số của các mục thiếu, và ô số kiện của loại cuối — chỗ lỗi "quá trần tổng số kiện" của form — khi tổng
 * vượt trần. Điểm giao đã có giá trị tạm, "chỉ giữ bốn loại" không gắn với ô nào: không kiểm.
 */
export function gapPaths(gaps: readonly ExtractGap[], cartonCount: number): GapPath[] {
  return gaps.flatMap((gap): GapPath[] => {
    if (gap.kind === 'truck') return [`truck.${gap.field}`]
    if (gap.kind === 'carton') return gap.field === 'stop' ? [] : [`cartons.${gap.index}.${gap.field}`]
    return gap.kind === 'totalQuantity' && cartonCount > 0 ? [`cartons.${cartonCount - 1}.quantity`] : []
  })
}
