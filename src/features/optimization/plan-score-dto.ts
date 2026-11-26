import { roundCm } from '@/domain/geometry'

/**
 * Điểm J của phương án (`planScore`) và lý do đặt + số đo của từng chỗ xếp — dịch vụ tối ưu tính sau cờ `PLAN_SCORE_J` của máy chủ; cờ tắt
 * hay máy chủ cũ thì các trường vắng và màn không vẽ gì. DTO chỉ `load-plan-dto.ts` import. Màn dịch theo **mã**, không dùng `name` /
 * `profileName` của máy chủ: mã khoản hay mã lý do lạ bị bỏ, mã hồ sơ lạ giữ nguyên để màn hiện nguyên mã. Hàm thuần.
 */

/** BigDecimal của Jackson: số, hoặc chuỗi khi máy chủ ghi BigDecimal bằng chuỗi. */
type Decimal = number | string

export type ScoreComponentDto = {
  readonly code?: string | null
  readonly name?: string | null
  readonly value?: Decimal | null
  readonly weight?: Decimal | null
  readonly contribution?: Decimal | null
  readonly computed?: boolean | null
}

/** `planScore` của `LoadPlanDetailResponse`. */
export type PlanScoreDto = {
  readonly profile?: string | null
  readonly profileName?: string | null
  readonly assumedWeights?: boolean | null
  readonly j?: Decimal | null
  readonly uVol?: Decimal | null
  readonly uN?: Decimal | null
  readonly wVol?: Decimal | null
  readonly wN?: Decimal | null
  readonly components?: readonly ScoreComponentDto[] | null
}

/** Trường lý do đặt và số đo của `PlacementDetailResponse`. */
export type PlacementWhyDto = {
  readonly reasonCodes?: readonly string[] | null
  readonly stackPressureKgM2?: Decimal | null
  readonly topLoadCapacityKgM2?: Decimal | null
  readonly supportRatio?: Decimal | null
  readonly distanceToDoorCm?: Decimal | null
}

/** Hồ sơ ưu tiên có tên trong từ điển. */
export const SCORE_PROFILES = ['default', 'A', 'B', 'C'] as const
export type ScoreProfile = (typeof SCORE_PROFILES)[number]

/** Khoản trừ của J, theo thứ tự màn liệt kê. */
export const SCORE_COMPONENT_CODES = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'] as const
export type ScoreComponentCode = (typeof SCORE_COMPONENT_CODES)[number]

/** Một khoản cộng của J: tỉ lệ (0..1) và trọng số. */
export type ScoreTerm = { readonly ratio: number; readonly weight: number }

/** Một khoản trừ: `value` là Sₖ (0..1), `contribution` là phần trừ vào J (điểm, thường âm). Khoản không tính thì không có số. */
export type ScoreComponent =
  | { readonly code: ScoreComponentCode; readonly computed: true; readonly value: number; readonly weight: number; readonly contribution: number }
  | { readonly code: ScoreComponentCode; readonly computed: false }

export type PlanScore = {
  /** Mã hồ sơ đã chấm phương án (`default`, `A`, `B`, `C`; mã lạ giữ nguyên); `null` khi máy chủ không nói. */
  readonly profile: string | null
  /** Trọng số là số tạm, chưa chốt. */
  readonly assumedWeights: boolean
  readonly j: number
  /** U_vol × w_vol; `null` khi máy chủ thiếu một trong hai số. */
  readonly volume: ScoreTerm | null
  /** U_n × w_n; `null` khi máy chủ thiếu một trong hai số. */
  readonly count: ScoreTerm | null
  readonly components: readonly ScoreComponent[]
}

export const PLACEMENT_REASON_KINDS = ['PINNED', 'MUST_LOAD', 'OUT_OF_ZONE_NO_SPACE', 'BOTTOM_HIGH_CAPACITY', 'HEAVY_LOW'] as const
export type PlacementReason =
  | { readonly kind: (typeof PLACEMENT_REASON_KINDS)[number] }
  /** `ZONE_STOP_<n>`: kiện nằm trong vùng của điểm giao số n. */
  | { readonly kind: 'ZONE_STOP'; readonly stop: number }

/** Vì sao chỗ xếp nằm ở đây. Chỉ có khi máy chủ trả ít nhất một lý do hay một số đo. */
export type PlacementWhy = {
  readonly reasons: readonly PlacementReason[]
  /** Áp lực hàng đè lên mặt trên (kg/m²) và sức chịu σ: `null` = kiện không nhận tải trên mặt; vắng = máy chủ không trả σ. */
  readonly stack?: { readonly pressureKgM2: number; readonly capacityKgM2?: number | null }
  /** Phần đáy được đỡ, 0..1 (1 khi nằm sàn). */
  readonly supportRatio?: number
  readonly distanceToDoorCm?: number
}

function finite(value: Decimal | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const isComponentCode = (code: string): code is ScoreComponentCode => (SCORE_COMPONENT_CODES as readonly string[]).includes(code)
const isReasonKind = (code: string): code is (typeof PLACEMENT_REASON_KINDS)[number] => (PLACEMENT_REASON_KINDS as readonly string[]).includes(code)

function termOf(ratio: Decimal | null | undefined, weight: Decimal | null | undefined): ScoreTerm | null {
  const [r, w] = [finite(ratio), finite(weight)]
  return r === null || w === null ? null : { ratio: r, weight: w }
}

/** Bỏ mã lạ, mã trùng và khoản "đã tính" mà thiếu số; xếp theo `SCORE_COMPONENT_CODES`. */
function componentsOf(dtos: readonly ScoreComponentDto[] | null | undefined): ScoreComponent[] {
  const byCode = new Map<ScoreComponentCode, ScoreComponent>()
  for (const dto of dtos ?? []) {
    const code = dto.code?.trim() ?? ''
    if (!isComponentCode(code) || byCode.has(code)) continue
    if (dto.computed === false) {
      byCode.set(code, { code, computed: false })
      continue
    }
    const [value, weight, contribution] = [finite(dto.value), finite(dto.weight), finite(dto.contribution)]
    if (value !== null && weight !== null && contribution !== null) byCode.set(code, { code, computed: true, value, weight, contribution })
  }
  return SCORE_COMPONENT_CODES.flatMap((code) => byCode.get(code) ?? [])
}

/** DTO → điểm J; không có J đọc được thì `null` — màn không vẽ dòng điểm. `candidateProfile` thay hồ sơ khi `planScore` không nói. */
export function planScoreOf(dto: PlanScoreDto | null | undefined, candidateProfile?: string | null): PlanScore | null {
  const j = finite(dto?.j)
  if (!dto || j === null) return null
  return {
    profile: dto.profile?.trim() || candidateProfile?.trim() || null,
    assumedWeights: dto.assumedWeights === true,
    j,
    volume: termOf(dto.uVol, dto.wVol),
    count: termOf(dto.uN, dto.wN),
    components: componentsOf(dto.components),
  }
}

function reasonsOf(codes: readonly string[] | null | undefined): PlacementReason[] {
  const seen = new Set<string>()
  const reasons: PlacementReason[] = []
  for (const raw of codes ?? []) {
    const code = raw.trim()
    if (seen.has(code)) continue
    seen.add(code)
    const zone = /^ZONE_STOP_(\d+)$/.exec(code)
    const stop = zone ? Number(zone[1]) : 0
    if (stop >= 1) reasons.push({ kind: 'ZONE_STOP', stop })
    else if (isReasonKind(code)) reasons.push({ kind: code })
  }
  return reasons
}

/** DTO → lý do đặt; `undefined` khi máy chủ không trả lý do hay số đo nào (cờ tắt, máy chủ cũ). */
export function placementWhyOf(dto: PlacementWhyDto): PlacementWhy | undefined {
  const reasons = reasonsOf(dto.reasonCodes)
  const pressure = finite(dto.stackPressureKgM2)
  const capacity = dto.topLoadCapacityKgM2 === null ? null : (finite(dto.topLoadCapacityKgM2) ?? undefined)
  const support = finite(dto.supportRatio)
  const door = finite(dto.distanceToDoorCm)
  const supportRatio = support !== null && support >= 0 && support <= 1 ? support : null
  const distanceToDoorCm = door !== null && door >= 0 ? roundCm(door) : null
  if (reasons.length === 0 && pressure === null && supportRatio === null && distanceToDoorCm === null) return undefined
  return {
    reasons,
    ...(pressure === null ? {} : { stack: { pressureKgM2: pressure, ...(capacity === undefined ? {} : { capacityKgM2: capacity }) } }),
    ...(supportRatio === null ? {} : { supportRatio }),
    ...(distanceToDoorCm === null ? {} : { distanceToDoorCm }),
  }
}
