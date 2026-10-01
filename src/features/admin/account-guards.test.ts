import { expect, test } from 'vitest'
import type { User } from '@/types/user'
import { accountGuards, toggleLockBlock } from './account-guards'

/**
 * Thao tác bị chặn trước khi gửi kho, kèm lý do (LM-092): tự khoá/xoá/đổi vai trò mình, quản trị viên hoạt động cuối cùng. Từ FE-0-01
 * "quản trị viên" của luật này là quản trị hệ thống (`systemAdmin`).
 */
type Account = Pick<User, 'id' | 'role' | 'status'>

const admin = (id: string, status: User['status'] = 'active'): Account => ({ id, role: 'systemAdmin', status })
const driver: Account = { id: 'US-0004', role: 'driver', status: 'active' }

test('chính mình: không khoá, không xoá, không đổi vai trò', () => {
  expect(accountGuards(driver, 'US-0004', [driver])).toStrictEqual({ lock: 'self', remove: 'self', role: 'self' })
})

test('quản trị viên đang hoạt động cuối cùng không bị khoá, xoá hay hạ vai trò', () => {
  const only = admin('US-0005')
  const locked = admin('US-0020', 'suspended')
  // Người xem là quản trị viên khác đã bị khoá phiên (hàm thuần: chỉ xét dữ liệu)
  expect(accountGuards(only, 'US-0001', [only, locked, driver])).toStrictEqual({ lock: 'lastAdmin', remove: 'lastAdmin', role: 'lastAdmin' })
})

test('còn quản trị viên hoạt động khác, hoặc tài khoản thường: không chặn', () => {
  const first = admin('US-0005')
  const second = admin('US-0013')
  expect(accountGuards(second, 'US-0005', [first, second])).toStrictEqual({ lock: null, remove: null, role: null })
  expect(accountGuards(driver, 'US-0005', [first, driver])).toStrictEqual({ lock: null, remove: null, role: null })
  // Quản trị viên đã khoá không phải "đang hoạt động cuối cùng"
  expect(accountGuards(admin('US-0020', 'suspended'), 'US-0005', [first, admin('US-0020', 'suspended')]))
    .toStrictEqual({ lock: null, remove: null, role: null })
})

test('quản trị công ty duy nhất chưa bị chặn: luật quản trị viên cuối chỉ tính quản trị hệ thống (FE-0-08 thêm phạm vi công ty)', () => {
  const systemAdmin = admin('US-0005')
  const companyAdmin: Account = { id: 'US-LB-01', role: 'companyAdmin', status: 'active' }
  expect(accountGuards(companyAdmin, 'US-0005', [systemAdmin, companyAdmin])).toStrictEqual({ lock: null, remove: null, role: null })
  // Một quản trị công ty đang hoạt động không thay được quản trị hệ thống cuối cùng
  expect(accountGuards(systemAdmin, 'US-LB-01', [systemAdmin, companyAdmin])).toStrictEqual({ lock: 'lastAdmin', remove: 'lastAdmin', role: 'lastAdmin' })
})

test('mở khoá chỉ bị chặn với chính mình; khoá theo cả luật quản trị viên cuối', () => {
  const lastAdmin = { lock: 'lastAdmin', remove: 'lastAdmin', role: 'lastAdmin' } as const
  const self = { lock: 'self', remove: 'self', role: 'self' } as const
  expect(toggleLockBlock({ status: 'active' }, lastAdmin)).toBe('lastAdmin')
  expect(toggleLockBlock({ status: 'suspended' }, lastAdmin)).toBeNull()
  expect(toggleLockBlock({ status: 'suspended' }, self)).toBe('self')
})
