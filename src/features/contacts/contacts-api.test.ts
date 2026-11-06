import { expect, test } from 'vitest'
import { getMockDb } from '@/lib/mock-db'
import { listContactHandlers, listContactPlanNames } from './contacts-api'

/** Lớp dữ liệu của màn Liên hệ của khách trên kho dùng chung của file, phiên Hỗ trợ khách hàng seed; test chạy theo thứ tự. */

test('people who can take a request are the active accounts of the two handling roles, by name; a locked account is left out', async () => {
  const db = getMockDb()
  db.restoreSession('US-NT-02')
  expect(await listContactHandlers()).toStrictEqual([
    { id: 'US-NT-02', name: 'Tạ Thị Ngọc Ánh', role: 'systemSupporter' },
    { id: 'US-0005', name: 'Võ Minh Khoa', role: 'systemAdmin' },
  ])

  db.restoreSession('US-0005')
  await db.setUserStatus('US-NT-02', 'suspended')
  expect((await listContactHandlers()).map((handler) => handler.id)).toStrictEqual(['US-0005'])
})

test('plan names include plans no longer on sale: a guest may have chosen one before it was withdrawn', async () => {
  const db = getMockDb()
  // Hỗ trợ khách hàng bị khoá ở test trên: quản trị hệ thống mở khoá, rồi quản lý nền tảng ngừng bán gói Basic
  db.restoreSession('US-0005')
  await db.setUserStatus('US-NT-02', 'active')
  db.restoreSession('US-NT-01')
  await db.setSubscriptionPlanActive('PLAN-001', false)
  db.restoreSession('US-NT-02')
  expect(await listContactPlanNames()).toStrictEqual(new Map([['PLAN-001', 'Basic'], ['PLAN-002', 'Pro'], ['PLAN-003', 'Ultimate']]))
})
