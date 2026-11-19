import { ORIENTATION_CODES } from '@/domain/geometry'
import { STOP_COUNT } from '@/lib/stops'
import { LANDING_REQUEST, LANDING_STOP_COUNT } from '../landing-sample.mock'

/**
 * Phép đếm của dải "Vì sao xếp tay không xuể": số thứ tự đi qua n điểm giao (n!) và số cách chọn hướng đặt cho k kiện (6^k — sáu hướng
 * đặt của `@/domain/geometry`). Số nhỏ viết đủ; số lớn viết gọn "a × 10^b" tính bằng log10 nên không tràn số thực dù k tới hàng nghìn.
 */

/** Số đếm dưới ngưỡng này viết đủ từng chữ số (tối đa chín chữ số — vừa một dòng trên điện thoại). */
const EXACT_BELOW = 1_000_000_000

export type BigCount =
  /** Số đếm viết đủ. */
  | { readonly kind: 'exact'; readonly value: number; readonly digits: number }
  /** Số đếm gần đúng `mantissa × 10^exponent`, `mantissa` trong [1, 10) làm tròn một chữ số lẻ; `digits` là số chữ số của số thật. */
  | { readonly kind: 'power'; readonly mantissa: number; readonly exponent: number; readonly digits: number }

/** Số đếm là tích của các thừa số nguyên dương: cộng log10 để biết cỡ, chỉ nhân thật khi kết quả còn viết đủ được. */
function countOf(factors: readonly number[]): BigCount {
  const log = factors.reduce((sum, factor) => sum + Math.log10(factor), 0)
  if (log < Math.log10(EXACT_BELOW)) {
    const value = factors.reduce((product, factor) => product * factor, 1)
    return { kind: 'exact', value, digits: String(value).length }
  }
  const whole = Math.floor(log)
  const rounded = Math.round(10 ** (log - whole) * 10) / 10
  // 9,96 làm tròn thành 10,0: viết 1,0 × 10^(b+1); số chữ số của số thật không đổi.
  return rounded >= 10
    ? { kind: 'power', mantissa: 1, exponent: whole + 1, digits: whole + 1 }
    : { kind: 'power', mantissa: rounded, exponent: whole, digits: whole + 1 }
}

const isCount = (value: number): boolean => Number.isInteger(value) && value >= 1

/** Số thứ tự đi qua `stops` điểm giao: stops! */
export function orderCount(stops: number): BigCount {
  if (!isCount(stops)) throw new Error(`Số điểm giao phải là số nguyên dương: ${stops}`)
  return countOf(Array.from({ length: stops }, (_, index) => index + 1))
}

/** Số hướng đặt của một kiện theo domain (LWH … HWL). */
export const ORIENTATIONS_PER_PACKAGE = ORIENTATION_CODES.length

/** Số cách chọn hướng đặt cho `packages` kiện, mỗi kiện `base` hướng: base^packages. */
export function orientationCount(packages: number, base: number = ORIENTATIONS_PER_PACKAGE): BigCount {
  if (!isCount(packages)) throw new Error(`Số kiện phải là số nguyên dương: ${packages}`)
  if (!isCount(base)) throw new Error(`Số hướng đặt phải là số nguyên dương: ${base}`)
  return countOf(Array.from({ length: packages }, () => base))
}

/** Số điểm giao chọn được: 1 tới số màu định danh điểm giao của ứng dụng. */
export const WHY_STOPS = { min: 1, max: STOP_COUNT, initial: LANDING_STOP_COUNT } as const

const SAMPLE_PACKAGES = LANDING_REQUEST.packages.reduce((sum, line) => sum + line.quantity, 0)

/** Các mốc số kiện; mốc cuối là số kiện của chuyến mẫu trên trang, cũng là mốc đứng sẵn. */
export const WHY_PACKAGES = { marks: [10, 50, 100, SAMPLE_PACKAGES], initial: SAMPLE_PACKAGES } as const
