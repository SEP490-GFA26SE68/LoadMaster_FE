import type { QualityTier } from './usePerformanceFlags'

/** `settling`: mẫu rơi vào quãng ngay sau khi cảnh đổi (mở, đổi phương án / xe, đổi tier) — dựng lại hình và biên dịch shader, không phải tốc độ thường. */
export type QualityObservation = { frameTimeMs: number | null; idle: boolean; settling?: boolean }

/**
 * State thuần của chính sách chất lượng. `restSince`: lúc mẫu nghỉ đầu tiên của quãng nghỉ đang có (`null` khi cảnh đang chạy).
 * `trial`: tier vừa được nâng thử sau một quãng nghỉ dài, kèm số mẫu chạy không chậm kể từ đó; `failedTrials`: số lần nâng thử lên
 * từng tier đã bị hạ lại trong phiên này.
 */
export type QualityPolicy = {
  tier: QualityTier
  slow: number
  fast: number
  lastChangeAt: number
  restSince: number | null
  trial: { tier: QualityTier; samples: number } | null
  failedTrials: Partial<Record<QualityTier, number>>
}

export const QUALITY_COOLDOWN_MS = 12_000
/** Nghỉ liên tục chừng này (và đã qua `QUALITY_COOLDOWN_MS` kể từ lần đổi tier) thì thử nâng một bậc. */
export const QUALITY_REST_RETRY_MS = 4_000
/** Mỗi bậc chỉ được thử hỏng chừng này lần trong một phiên: máy thật sự yếu không dao động giữa hai tier mãi. */
export const QUALITY_MAX_FAILED_TRIALS = 2
/** Sau chừng này mẫu chạy không chậm, lần nâng thử coi như đứng được; lần hạ sau đó là hạ thường, không tính là thử hỏng. */
export const QUALITY_TRIAL_CONFIRM_SAMPLES = 8

const SLOW_MS = 28
const FAST_MS = 18
const SLOW_RUN = 3
const FAST_RUN = 8
const UP: Record<QualityTier, QualityTier | null> = { low: 'balanced', balanced: 'high', high: null }
const DOWN: Record<QualityTier, QualityTier> = { high: 'balanced', balanced: 'low', low: 'low' }

export const createQualityPolicy = (tier: QualityTier): QualityPolicy => ({
  tier, slow: 0, fast: 0, lastChangeAt: -Infinity, restSince: null, trial: null, failedTrials: {},
})

/** Nâng thử sau quãng nghỉ dài: chỉ khi đã qua cooldown, còn bậc trên, bậc đó chưa hỏng quá số lần cho phép và lần thử trước đã được chuyển động xác nhận (nghỉ lâu không leo liền hai bậc). */
function restTrial(state: QualityPolicy, restSince: number, now: number): QualityPolicy | null {
  const up = UP[state.tier]
  if (!up || state.trial || now - restSince < QUALITY_REST_RETRY_MS || now - state.lastChangeAt < QUALITY_COOLDOWN_MS) return null
  if ((state.failedTrials[up] ?? 0) >= QUALITY_MAX_FAILED_TRIALS) return null
  return { ...state, tier: up, slow: 0, fast: 0, lastChangeAt: now, restSince: now, trial: { tier: up, samples: 0 } }
}

/**
 * Ignore demand-loop idle/sparse frames and the settle window after a scene change. Separate thresholds + consecutive samples + cooldown.
 * Mẫu nghỉ (kể cả nhịp nghỉ lặp lại khi cảnh đứng yên) cho phép nâng thử một bậc sau quãng nghỉ dài (`restTrial`); lần thử đó gặp
 * `SLOW_RUN` mẫu chậm thì hạ lại ngay, không chờ cooldown, và tính một lần thử hỏng.
 */
export function observeQuality(state: QualityPolicy, sample: QualityObservation, now: number): QualityPolicy {
  if (sample.idle) {
    const restSince = state.restSince ?? now
    return restTrial(state, restSince, now) ?? { ...state, slow: 0, fast: 0, restSince }
  }
  if (sample.settling || sample.frameTimeMs === null) return { ...state, slow: 0, fast: 0, restSince: null }
  const slow = sample.frameTimeMs > SLOW_MS ? state.slow + 1 : 0
  const fast = sample.frameTimeMs < FAST_MS ? state.fast + 1 : 0
  const trialFailed = state.trial?.tier === state.tier && slow >= SLOW_RUN
  if (trialFailed || now - state.lastChangeAt >= QUALITY_COOLDOWN_MS) {
    const tier = slow >= SLOW_RUN ? DOWN[state.tier] : fast >= FAST_RUN ? UP[state.tier] ?? state.tier : state.tier
    if (tier !== state.tier) {
      const failedTrials = trialFailed
        ? { ...state.failedTrials, [state.tier]: (state.failedTrials[state.tier] ?? 0) + 1 }
        : state.failedTrials
      return { ...state, tier, slow: 0, fast: 0, lastChangeAt: now, restSince: null, trial: null, failedTrials }
    }
  }
  const confirmed = state.trial && slow === 0 && state.trial.samples + 1 >= QUALITY_TRIAL_CONFIRM_SAMPLES
  const trial = !state.trial || confirmed ? null : slow === 0 ? { ...state.trial, samples: state.trial.samples + 1 } : state.trial
  return { ...state, slow, fast, restSince: null, trial }
}
