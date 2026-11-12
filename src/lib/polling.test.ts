import { expect, test } from 'vitest'
import { MAX_POLL_FAILURES, MAX_POLL_INTERVAL_MS, pollInterval, type PolledQuery } from './polling'

/** Query giả: mỗi bước ghi một lần đọc thành công hoặc thất bại, giống cách TanStack Query cập nhật ba trường đó. */
function fakeQuery() {
  let clock = 0
  const state = { dataUpdatedAt: 0, errorUpdatedAt: 0, errorUpdateCount: 0 }
  const query: PolledQuery = { state }
  return {
    query,
    succeed: () => { state.dataUpdatedAt = ++clock },
    fail: () => { state.errorUpdatedAt = ++clock; state.errorUpdateCount += 1 },
  }
}

test('keeps the normal beat while the server answers, and turns off when the screen asks for no beat', () => {
  const { query, succeed } = fakeQuery()
  succeed()
  expect(pollInterval(query, 30_000)).toBe(30_000)
  expect(pollInterval(query, false)).toBe(false)
  expect(pollInterval(query, null)).toBe(false)
})

test('doubles the wait on each consecutive failure, then stops after MAX_POLL_FAILURES', () => {
  const { query, succeed, fail } = fakeQuery()
  succeed()
  fail()
  expect(pollInterval(query, 30_000)).toBe(60_000)
  fail()
  expect(pollInterval(query, 30_000)).toBe(120_000)
  fail()
  fail()
  expect(pollInterval(query, 30_000)).toBe(MAX_POLL_INTERVAL_MS)
  fail()
  expect(MAX_POLL_FAILURES).toBe(5)
  expect(pollInterval(query, 30_000)).toBe(false)
})

test('one successful read resets the count: failures before it do not add up', () => {
  const { query, succeed, fail } = fakeQuery()
  for (let i = 0; i < MAX_POLL_FAILURES - 1; i += 1) fail()
  succeed()
  expect(pollInterval(query, 1_000)).toBe(1_000)
  fail()
  expect(pollInterval(query, 1_000)).toBe(2_000)
})

test('a query that never succeeded counts every failure', () => {
  const { query, fail } = fakeQuery()
  for (let i = 0; i < MAX_POLL_FAILURES; i += 1) fail()
  expect(pollInterval(query, 60_000)).toBe(false)
})
