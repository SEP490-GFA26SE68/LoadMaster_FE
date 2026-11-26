/**
 * Ước tính sức chịu nén mặt trên σ (kg/m²) của thùng carton bằng công thức McKee rút gọn (1963):
 *
 *   BCT ≈ 5,87 · ECT · √(t · P)        σ ≈ BCT / (k · g · A_top)
 *
 * ECT độ bền nén cạnh của tấm [N/m], t độ dày tấm [m], P chu vi đáy thùng [m], k hệ số an toàn, A_top diện tích mặt trên [m²].
 * Chỉ đúng cho thùng carton một lớp sóng, kiểu RSC, rỗng, điều kiện phòng thí nghiệm — màn hiện giới hạn này cạnh kết quả.
 * Hàm thuần: nhận kích thước thùng và độ dày bằng cm như mọi chỗ khác của app, đổi sang mét bên trong.
 */

/** Hằng số thực nghiệm của McKee. */
export const MCKEE_CONSTANT = 5.87
/** Gia tốc trọng trường dùng để đổi lực (N) sang khối lượng (kg). */
export const GRAVITY = 9.81

export type McKeeInput = {
  /** Độ bền nén cạnh của tấm carton, N/m. */
  readonly ectNPerM: number
  /** Độ dày tấm carton, cm. */
  readonly thicknessCm: number
  /** Dài, rộng đáy thùng, cm. */
  readonly lengthCm: number
  readonly widthCm: number
  /** Hệ số an toàn k. */
  readonly safetyFactor: number
}

export type McKeeEstimate = {
  readonly perimeterM: number
  readonly topAreaM2: number
  readonly boxCompressionN: number
  /** σ, kg/m², làm tròn 0,01 — đúng độ chính xác máy chủ lưu. */
  readonly topLoadCapacityKgM2: number
}

const positive = (value: number) => Number.isFinite(value) && value > 0

/** `null` khi một số đầu vào thiếu hoặc không dương. */
export function estimateTopLoadCapacity(input: McKeeInput): McKeeEstimate | null {
  const { ectNPerM, thicknessCm, lengthCm, widthCm, safetyFactor } = input
  if (![ectNPerM, thicknessCm, lengthCm, widthCm, safetyFactor].every(positive)) return null
  const perimeterM = (2 * (lengthCm + widthCm)) / 100
  const topAreaM2 = (lengthCm * widthCm) / 10_000
  const thicknessM = thicknessCm / 100
  const boxCompressionN = MCKEE_CONSTANT * ectNPerM * Math.sqrt(thicknessM * perimeterM)
  const sigma = boxCompressionN / (safetyFactor * GRAVITY * topAreaM2)
  return {
    perimeterM,
    topAreaM2,
    boxCompressionN,
    topLoadCapacityKgM2: Math.round(sigma * 100) / 100,
  }
}
