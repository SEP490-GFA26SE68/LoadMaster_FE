import { expect, test } from 'vitest'
import {
  answeredWithoutModel,
  escalationRate,
  lastDays,
  needsReview,
  rangeDays,
  rangeIssue,
  ratioOf,
  type RouteCounts,
} from './assistant-stats'

const counts = (partial: Partial<RouteCounts>): RouteCounts => ({ SMALL_TALK: 0, PREPARED: 0, ESCALATED: 0, MODEL: 0, CACHED: 0, ...partial })

test('a ratio over nothing is no ratio, never a division by zero', () => {
  expect(ratioOf(3, 0)).toBeNull()
  expect(ratioOf(0, 0)).toBeNull()
  expect(ratioOf(1, 4)).toBe(0.25)
})

test('answered without the model: small talk, prepared answers and cached answers — not the model, not escalations', () => {
  expect(answeredWithoutModel(counts({ SMALL_TALK: 2, PREPARED: 10, ESCALATED: 3, MODEL: 5, CACHED: 1 }))).toBe(13)
})

test('escalation rate is escalations over prepared answers', () => {
  expect(escalationRate(counts({ PREPARED: 8, ESCALATED: 2 }))).toBe(0.25)
  expect(escalationRate(counts({ ESCALATED: 2 }))).toBeNull()
})

test('a topic needs review from 30 % escalations with at least 5 prepared answers', () => {
  expect(needsReview(counts({ PREPARED: 10, ESCALATED: 3 }))).toBe(true)
  expect(needsReview(counts({ PREPARED: 10, ESCALATED: 2 }))).toBe(false)
  // 2 / 4 = 50 % nhưng mới 4 lượt soạn sẵn: chưa đủ để kết luận
  expect(needsReview(counts({ PREPARED: 4, ESCALATED: 2 }))).toBe(false)
  expect(needsReview(counts({ PREPARED: 5, ESCALATED: 2 }))).toBe(true)
  expect(needsReview(counts({ MODEL: 40 }))).toBe(false)
})

test('ranges count both ends; the last n days end today', () => {
  expect(rangeDays('2026-10-26', '2026-11-24')).toBe(30)
  expect(rangeDays('2026-11-24', '2026-11-24')).toBe(1)
  expect(lastDays('2026-11-24', 30)).toStrictEqual({ from: '2026-10-26', to: '2026-11-24' })
  expect(lastDays('2026-11-24', 90)).toStrictEqual({ from: '2026-08-27', to: '2026-11-24' })
})

test('the server takes at most 90 days, in order, of real dates', () => {
  expect(rangeIssue('2026-08-27', '2026-11-24')).toBeNull()
  expect(rangeIssue('2026-08-26', '2026-11-24')).toBe('tooLong')
  expect(rangeIssue('2026-11-25', '2026-11-24')).toBe('order')
  expect(rangeIssue('2026-02-30', '2026-03-02')).toBe('invalid')
  expect(rangeIssue('', '2026-11-24')).toBe('invalid')
})
