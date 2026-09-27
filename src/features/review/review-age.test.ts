import { expect, test } from 'vitest'
import { waitingAge } from './review-age'

const NOW = new Date('2026-09-14T03:00:00.000Z') // 10:00 giờ Việt Nam

test('under a minute, and a clock that runs ahead, read as just submitted', () => {
  expect(waitingAge('2026-09-14T02:59:30.000Z', NOW)).toStrictEqual({ unit: 'justNow' })
  expect(waitingAge('2026-09-14T03:05:00.000Z', NOW)).toStrictEqual({ unit: 'justNow' })
})

test('minutes, hours and days round down; seed times carry the +07:00 offset', () => {
  expect(waitingAge('2026-09-14T09:35:00+07:00', NOW)).toStrictEqual({ unit: 'minutes', count: 25 })
  expect(waitingAge('2026-09-14T08:30:00+07:00', NOW)).toStrictEqual({ unit: 'hours', count: 1 })
  expect(waitingAge('2026-09-12T09:00:00+07:00', NOW)).toStrictEqual({ unit: 'days', count: 2 })
})
