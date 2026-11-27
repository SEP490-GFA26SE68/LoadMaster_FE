import { expect, test } from 'vitest'
import {
  createQualityPolicy, observeQuality, QUALITY_COOLDOWN_MS, QUALITY_MAX_FAILED_TRIALS, QUALITY_REST_RETRY_MS, type QualityPolicy,
} from '@/features/viewer3d/quality-policy'
import { motionDprOf, nextDprPhase, REST_DPR_MAX, restDprOf, targetDprOf } from '@/features/viewer3d/scene/rest-dpr'

const IDLE = { frameTimeMs: null, idle: true } as const
const slow = (q: QualityPolicy, from: number, count = 3) => {
  for (let i = 0; i < count; i++) q = observeQuality(q, { frameTimeMs: 40, idle: false }, from + i * 500)
  return q
}
/** Nhịp nghỉ mỗi 500 ms từ `from` tới `to` (gồm cả hai đầu). */
const rest = (q: QualityPolicy, from: number, to: number) => {
  for (let t = from; t <= to; t += 500) q = observeQuality(q, IDLE, t)
  return q
}

test('a long rest after the cooldown retries one tier up', () => {
  let q = slow(createQualityPolicy('balanced'), 0)
  expect(q.tier).toBe('low')
  const changedAt = q.lastChangeAt
  // Nghỉ đủ lâu nhưng chưa qua cooldown: chưa thử
  q = rest(q, changedAt + 500, changedAt + QUALITY_COOLDOWN_MS - 500)
  expect(q.tier).toBe('low')
  q = observeQuality(q, IDLE, changedAt + QUALITY_COOLDOWN_MS)
  expect(q).toMatchObject({ tier: 'balanced', trial: { tier: 'balanced' } })
})

test('the rest must be continuous: a moving sample restarts the rest clock', () => {
  let q = slow(createQualityPolicy('balanced'), 0)
  const base = q.lastChangeAt + QUALITY_COOLDOWN_MS
  q = rest(q, base, base + QUALITY_REST_RETRY_MS - 1000)
  q = observeQuality(q, { frameTimeMs: 20, idle: false }, base + QUALITY_REST_RETRY_MS - 500)
  q = observeQuality(q, IDLE, base + QUALITY_REST_RETRY_MS)
  expect(q.tier, 'rest restarted, not 4 s yet').toBe('low')
  q = rest(q, base + QUALITY_REST_RETRY_MS + 500, base + 2 * QUALITY_REST_RETRY_MS)
  expect(q.tier).toBe('balanced')
})

test('a failed retry drops back at once and each tier gives up after two failed retries', () => {
  let q = slow(createQualityPolicy('balanced'), 0)
  let t = q.lastChangeAt
  for (let attempt = 1; attempt <= QUALITY_MAX_FAILED_TRIALS; attempt++) {
    t += QUALITY_COOLDOWN_MS
    q = rest(q, t - QUALITY_REST_RETRY_MS, t)
    expect(q.tier, `retry ${attempt}`).toBe('balanced')
    // Ba mẫu chậm ngay sau lần thử: hạ lại không chờ cooldown
    q = slow(q, t + 3000)
    expect(q.tier).toBe('low')
    expect(q.failedTrials.balanced).toBe(attempt)
    t = q.lastChangeAt
  }
  q = rest(q, t + 500, t + 10 * QUALITY_COOLDOWN_MS)
  expect(q.tier, 'no more retries on a slow machine').toBe('low')
})

test('a retry that survives is confirmed; a later slow run is a normal downgrade', () => {
  let q = slow(createQualityPolicy('balanced'), 0)
  const t = q.lastChangeAt + QUALITY_COOLDOWN_MS
  q = rest(q, t - QUALITY_REST_RETRY_MS, t)
  for (let i = 0; i < 8; i++) q = observeQuality(q, { frameTimeMs: 20, idle: false }, t + 3000 + i * 500)
  expect(q).toMatchObject({ tier: 'balanced', trial: null })
  q = slow(q, t + 3 * QUALITY_COOLDOWN_MS)
  expect(q.tier).toBe('low')
  expect(q.failedTrials.balanced ?? 0).toBe(0)
})

test('the retry climbs one tier at a time: the next one waits until motion has confirmed the last', () => {
  let q = slow(createQualityPolicy('balanced'), 0)
  // Nghỉ rất lâu vẫn chỉ lên một bậc: bậc vừa thử chưa có mẫu chuyển động nào chứng minh
  q = rest(q, q.lastChangeAt + 500, q.lastChangeAt + 3 * QUALITY_COOLDOWN_MS)
  expect(q).toMatchObject({ tier: 'balanced', trial: { tier: 'balanced' } })
  // Chuyển động không chậm đủ lâu thì bậc đó đứng được; quãng nghỉ dài kế tiếp mới thử bậc trên, rồi dừng ở high
  let at = q.lastChangeAt + 3 * QUALITY_COOLDOWN_MS + 500
  for (let i = 0; i < 8; i++, at += 500) q = observeQuality(q, { frameTimeMs: 22, idle: false }, at)
  expect(q).toMatchObject({ tier: 'balanced', trial: null })
  q = rest(q, at, at + QUALITY_COOLDOWN_MS)
  expect(q).toMatchObject({ tier: 'high', trial: { tier: 'high' } })
  q = rest(q, q.lastChangeAt + 500, q.lastChangeAt + 3 * QUALITY_COOLDOWN_MS)
  expect(q.tier).toBe('high')
})

test('rest DPR sharpens only the low tier, capped by the device and REST_DPR_MAX', () => {
  expect(motionDprOf([0.5, 0.5], 2)).toBe(0.5)
  expect(restDprOf([0.5, 0.5], 2)).toBe(REST_DPR_MAX)
  expect(restDprOf([0.5, 0.5], 1)).toBe(1)
  expect(restDprOf([0.5, 0.5], 0.75)).toBe(0.75)
  // Balanced / high đã vẽ ít nhất bằng mức nghỉ: không đổi
  expect(restDprOf([1, 1.5], 2)).toBe(motionDprOf([1, 1.5], 2))
  expect(restDprOf([1, 2], 2)).toBe(2)
  expect(restDprOf([1, 2], 1)).toBe(1)
})

test('only a continuous frame sequence leaves the sharp resting state', () => {
  expect(nextDprPhase('moving', { kind: 'idle' })).toBe('resting')
  // Khung nét vừa đổi DPR không xin khung kế: vẫn nghỉ, không vòng lặp
  expect(nextDprPhase('resting', { kind: 'frame', requestsNext: false })).toBe('resting')
  expect(nextDprPhase('resting', { kind: 'frame', requestsNext: true })).toBe('moving')
  expect(nextDprPhase('moving', { kind: 'frame', requestsNext: false })).toBe('moving')
  expect(targetDprOf('resting', [0.5, 0.5], 2)).toBe(1.5)
  expect(targetDprOf('moving', [0.5, 0.5], 2)).toBe(0.5)
})
