import type { QualityTier } from './usePerformanceFlags'

/** `settling`: mẫu rơi vào quãng ngay sau khi cảnh đổi (mở, đổi phương án / xe, đổi tier) — dựng lại hình và biên dịch shader, không phải tốc độ thường. */
export type QualityObservation = { frameTimeMs: number | null; idle: boolean; settling?: boolean }
export type QualityPolicy = { tier: QualityTier; slow: number; fast: number; lastChangeAt: number }
export const QUALITY_COOLDOWN_MS = 12_000
export const createQualityPolicy = (tier: QualityTier): QualityPolicy => ({ tier, slow: 0, fast: 0, lastChangeAt: -Infinity })

/** Ignore demand-loop idle/sparse frames and the settle window after a scene change. Separate thresholds + consecutive samples + cooldown. */
export function observeQuality(state: QualityPolicy, sample: QualityObservation, now: number): QualityPolicy {
  if (sample.idle || sample.settling || sample.frameTimeMs === null) return { ...state, slow: 0, fast: 0 }
  const slow = sample.frameTimeMs > 28 ? state.slow + 1 : 0
  const fast = sample.frameTimeMs < 18 ? state.fast + 1 : 0
  if (now - state.lastChangeAt >= QUALITY_COOLDOWN_MS) {
    const tier = slow >= 3 ? state.tier === 'high' ? 'balanced' : 'low'
      : fast >= 8 ? state.tier === 'low' ? 'balanced' : 'high' : state.tier
    if (tier !== state.tier) return { tier, slow: 0, fast: 0, lastChangeAt: now }
  }
  return { ...state, slow, fast }
}
