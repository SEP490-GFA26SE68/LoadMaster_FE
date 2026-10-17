import { expect, test } from 'vitest'
import { isApiError } from './api-client'
import { isoFromBackend } from './backend-time'

test('an Instant keeps its moment; digits after the milliseconds are cut, not rounded', () => {
  expect(isoFromBackend('2026-10-16T21:29:43.054948900Z')).toBe('2026-10-16T21:29:43.054Z')
  expect(isoFromBackend('2026-10-17T05:34:18.523Z')).toBe('2026-10-17T05:34:18.523Z')
  expect(isoFromBackend('2026-10-17T05:34:18Z')).toBe('2026-10-17T05:34:18.000Z')
})

test('a LocalDateTime without offset is server time, Vietnam (+07:00), whatever the time zone of this machine', () => {
  expect(isoFromBackend('2026-10-16T18:05:00')).toBe('2026-10-16T11:05:00.000Z')
  expect(isoFromBackend('2026-10-17T04:29:43.1234567')).toBe('2026-10-16T21:29:43.123Z')
  expect(isoFromBackend('2026-10-17T04:29')).toBe('2026-10-16T21:29:00.000Z')
  expect(isoFromBackend('2026-10-17T04:29:00+08:00')).toBe('2026-10-16T20:29:00.000Z')
})

test('anything else is a server error, not a wrong date on screen', () => {
  for (const value of ['', '17/10/2026', '2026-10-17', '2026-13-45T99:99:00']) {
    let error: unknown = null
    try {
      isoFromBackend(value)
    } catch (caught) {
      error = caught
    }
    expect(isApiError(error) && error.code).toBe('SERVER_ERROR')
  }
})
