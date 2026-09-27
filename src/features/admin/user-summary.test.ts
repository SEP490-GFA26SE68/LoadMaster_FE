import { expect, test } from 'vitest'
import { createMockDb } from '@/lib/mock-db'
import { userSummary } from './user-summary'

test('đếm tài khoản của seed: 15 tài khoản, 14 đang hoạt động, 1 đã khoá (Bùi Thị Lan)', async () => {
  const users = await createMockDb().listUsers()
  expect(userSummary(users)).toStrictEqual({ total: 15, active: 14, suspended: 1 })
})

test('danh sách rỗng đếm ra toàn số 0', () => {
  expect(userSummary([])).toStrictEqual({ total: 0, active: 0, suspended: 0 })
})
