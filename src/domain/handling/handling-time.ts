import { gt, lt } from '@/domain/geometry'
import type { PackagePlacement } from '@/domain/models'

/**
 * Giả định thao tác bốc dỡ (Spec vật lý mục 10.2). Mọi số là **giả định chưa xác nhận** (Spec mục 13, câu 3): màn nào dùng
 * chúng phải ghi là ước tính và nói ra giả định. Đơn vị SI: m/s, m/s², s.
 */
export type HandlingAssumptions = {
  /** Vận tốc bê / kéo tối đa theo phương ngang, v */
  readonly maxSpeedMps: number
  /** Gia tốc và giảm tốc khi bê, a */
  readonly accelerationMps2: number
  /** Thời gian thao tác mỗi kiện (cầm, đặt, quét QR), t_h */
  readonly handlingSeconds: number
  /** Gia tốc trọng trường, g */
  readonly gravityMps2: number
}

/** Bốc tay — mặc định đề xuất của Spec mục 10.2; thay bằng số đo của công ty khi có. Một chỗ duy nhất cho các số này. */
export const MANUAL_HANDLING: HandlingAssumptions = {
  maxSpeedMps: 0.8,
  accelerationMps2: 0.6,
  handlingSeconds: 4,
  gravityMps2: 9.81,
}

/** Rơi tự do từ độ cao h (m) tới khi chạm mặt đỡ: t = √(2h/g). h ≤ 0 → 0. */
export function freeFallSeconds(heightM: number, gravityMps2 = MANUAL_HANDLING.gravityMps2): number {
  return gt(heightM, 0) ? Math.sqrt((2 * heightM) / gravityMps2) : 0
}

/** Quãng đã rơi sau t giây kể từ lúc buông (vận tốc đầu 0): ½·g·t². */
export function freeFallDropM(seconds: number, gravityMps2 = MANUAL_HANDLING.gravityMps2): number {
  return seconds > 0 ? 0.5 * gravityMps2 * seconds * seconds : 0
}

/**
 * Bê / kéo theo phương ngang quãng d (m), hồ sơ vận tốc hình thang (Spec mục 10.1):
 * d ≥ v²/a → t = d/v + v/a (tăng tốc, chạy đều, giảm tốc); d < v²/a → t = 2·√(d/a) (chưa kịp tới v). d ≤ 0 → 0.
 */
export function carrySeconds(
  distanceM: number,
  assumptions: Pick<HandlingAssumptions, 'maxSpeedMps' | 'accelerationMps2'> = MANUAL_HANDLING,
): number {
  if (!gt(distanceM, 0)) return 0
  const { maxSpeedMps: v, accelerationMps2: a } = assumptions
  return lt(distanceM, (v * v) / a) ? 2 * Math.sqrt(distanceM / a) : distanceM / v + v / a
}

/**
 * Quãng bê dᵢ của một kiện, cm: theo trục X, từ **tâm kiện** tới **mặt phẳng cửa sau** (X = chiều dài lòng thùng) —
 * d = max(0, L − (x + dài / 2)). Không tính đường đi ngang, lên xuống hay quãng từ cửa tới chỗ để hàng ở kho / điểm giao:
 * chỉ đoạn trong thùng, đoạn mà phương án xếp quyết định.
 */
export function carryDistanceCm(placement: Pick<PackagePlacement, 'xCm' | 'placedLengthCm'>, bodyLengthCm: number): number {
  return Math.max(0, bodyLengthCm - (placement.xCm + placement.placedLengthCm / 2))
}

/** Một lượt bê một kiện: t_h + t_ngang(d), d tính bằng cm như mọi kích thước của domain. */
export function packageHandlingSeconds(distanceCm: number, assumptions: HandlingAssumptions = MANUAL_HANDLING): number {
  return assumptions.handlingSeconds + carrySeconds(distanceCm / 100, assumptions)
}
