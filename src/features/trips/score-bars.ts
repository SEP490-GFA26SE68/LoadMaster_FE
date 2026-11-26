import type { PlanScore, ScoreComponentCode } from '@/features/optimization/load-plans-backend-api'

/**
 * Biểu đồ điểm của một phương án máy chủ (So sánh theo lần chạy), dựng từ chính `plan.score`: hai khoản cộng (U_vol, U_n: 100 × w × U, cùng
 * công thức với "Tính thế nào?") và các khoản trừ Sₖ **đã tính** (|phần trừ| máy chủ trả). Khoản "Không tính" không có thanh — danh sách
 * "Tính thế nào?" nói chúng. Độ dài thanh so với khoản lớn nhất. Thuần.
 */
export type ScoreBarKey = 'volume' | 'count' | ScoreComponentCode

export type ScoreBar = {
  readonly key: ScoreBarKey
  readonly sign: 'plus' | 'minus'
  /** Điểm của khoản, không âm. */
  readonly points: number
  /** 0–1 so với khoản lớn nhất của phương án. */
  readonly share: number
}

export type ScoreBarsModel = {
  readonly bars: readonly ScoreBar[]
  /** Khoản trừ lấy nhiều điểm nhất (lớn hơn 0); hoà thì khoản đứng trước theo thứ tự S1…S8. `null` khi không khoản trừ nào lấy điểm. */
  readonly largestPenalty: ScoreBar | null
}

export function scoreBars(score: PlanScore): ScoreBarsModel {
  const raw: { key: ScoreBarKey; sign: ScoreBar['sign']; points: number }[] = [
    ...(score.volume ? [{ key: 'volume' as const, sign: 'plus' as const, points: Math.max(0, 100 * score.volume.weight * score.volume.ratio) }] : []),
    ...(score.count ? [{ key: 'count' as const, sign: 'plus' as const, points: Math.max(0, 100 * score.count.weight * score.count.ratio) }] : []),
    ...score.components.flatMap((component) =>
      component.computed ? [{ key: component.code, sign: 'minus' as const, points: Math.abs(component.contribution) }] : []),
  ]
  const max = Math.max(0, ...raw.map((bar) => bar.points))
  const bars = raw.map((bar) => ({ ...bar, share: max > 0 ? bar.points / max : 0 }))
  const largestPenalty = bars.reduce<ScoreBar | null>(
    (best, bar) => (bar.sign === 'minus' && bar.points > 0 && (best === null || bar.points > best.points) ? bar : best),
    null,
  )
  return { bars, largestPenalty }
}
