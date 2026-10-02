import { expect, test } from 'vitest'
import type { User } from '@/types/user'
import { accountGuards, toggleLockBlock, type AccountGuards } from './account-guards'

/**
 * Thao tác bị chặn trước khi gửi kho, kèm lý do (LM-092, FE-0-08): tự khoá/xoá/đổi vai trò mình; người quản trị đang hoạt động cuối
 * cùng của nền tảng hoặc của một công ty; quản trị hệ thống không sửa, không xoá nhân sự công ty. Tài khoản lấy từ seed (`seed-users.ts`).
 */
type Account = Pick<User, 'id' | 'role' | 'status' | 'companyId'>

const account = (id: string, role: User['role'], companyId?: string, status: User['status'] = 'active'): Account =>
  ({ id, role, status, ...(companyId === undefined ? {} : { companyId }) })

const SYSTEM_ADMIN = account('US-0005', 'systemAdmin')
const SUPPORTER = account('US-NT-02', 'systemSupporter')
const LB_ADMIN = account('US-LB-01', 'companyAdmin', 'LOG-001')
const LB_DRIVER = account('US-0004', 'driver', 'LOG-001')
const PN_ADMIN = account('US-PN-01', 'companyAdmin', 'LOG-002')
const EVERYONE = [SYSTEM_ADMIN, SUPPORTER, LB_ADMIN, LB_DRIVER, PN_ADMIN]
const LONG_BINH = [LB_ADMIN, LB_DRIVER]

const NONE: AccountGuards = { edit: null, lock: null, remove: null, role: null }
const all = (block: NonNullable<AccountGuards['lock']>): AccountGuards => ({ edit: block, lock: block, remove: block, role: block })

test('chính mình: sửa thông tin được; không khoá, không xoá, không đổi vai trò', () => {
  expect(accountGuards(LB_ADMIN, LB_ADMIN, LONG_BINH)).toStrictEqual({ edit: null, lock: 'self', remove: 'self', role: 'self' })
  expect(accountGuards(SYSTEM_ADMIN, SYSTEM_ADMIN, EVERYONE)).toStrictEqual({ edit: null, lock: 'self', remove: 'self', role: 'self' })
})

test('quản trị công ty: mọi thao tác trên người của công ty mình', () => {
  expect(accountGuards(LB_DRIVER, LB_ADMIN, LONG_BINH)).toStrictEqual(NONE)
})

test('quản trị hệ thống với nhân sự công ty: không sửa, không xoá, không đổi vai trò; khoá và đặt lại mật khẩu được', () => {
  expect(accountGuards(LB_DRIVER, SYSTEM_ADMIN, EVERYONE)).toStrictEqual({ edit: 'companyManaged', lock: null, remove: 'companyManaged', role: 'companyManaged' })
})

test('quản trị hệ thống với tài khoản nền tảng: sửa, khoá, xoá, đổi vai trò', () => {
  expect(accountGuards(SUPPORTER, SYSTEM_ADMIN, EVERYONE)).toStrictEqual(NONE)
})

test('quản trị công ty đang hoạt động cuối cùng của một công ty: không khoá, không xoá, không hạ vai trò', () => {
  // Quản trị hệ thống xem: quản trị công ty của Phương Nam còn đó không thay được quản trị công ty của Long Bình
  expect(accountGuards(LB_ADMIN, SYSTEM_ADMIN, EVERYONE)).toStrictEqual({
    edit: 'companyManaged', lock: 'lastCompanyAdmin', remove: 'companyManaged', role: 'companyManaged',
  })
  // Quản trị công ty thứ hai của Long Bình xem người thứ nhất: còn hai người thì không chặn; người kia đã khoá thì chặn
  const second = account('US-0016', 'companyAdmin', 'LOG-001')
  expect(accountGuards(LB_ADMIN, second, [...LONG_BINH, second])).toStrictEqual(NONE)
  const lockedSecond = { ...second, status: 'suspended' as const }
  // Hàm thuần, chỉ xét dữ liệu: người xem ở đây là một tài khoản khác của công ty
  expect(accountGuards(LB_ADMIN, LB_DRIVER, [...LONG_BINH, lockedSecond])).toStrictEqual({
    edit: null, lock: 'lastCompanyAdmin', remove: 'lastCompanyAdmin', role: 'lastCompanyAdmin',
  })
  // Quản trị công ty đã khoá không phải "đang hoạt động cuối cùng"
  expect(accountGuards(lockedSecond, LB_ADMIN, [...LONG_BINH, lockedSecond])).toStrictEqual(NONE)
})

test('quản trị hệ thống đang hoạt động cuối cùng của nền tảng: không khoá, không xoá, không hạ vai trò', () => {
  const other = account('US-0016', 'systemAdmin')
  const lockedOther = account('US-0016', 'systemAdmin', undefined, 'suspended')
  // Quản trị hệ thống kia đã khoá; hai quản trị công ty đang hoạt động không thay được quản trị hệ thống
  expect(accountGuards(SYSTEM_ADMIN, lockedOther, [...EVERYONE, lockedOther])).toStrictEqual({
    edit: null, lock: 'lastSystemAdmin', remove: 'lastSystemAdmin', role: 'lastSystemAdmin',
  })
  expect(accountGuards(SYSTEM_ADMIN, other, [...EVERYONE, other])).toStrictEqual(NONE)
})

test('mở khoá chỉ bị chặn với chính mình; khoá theo cả luật người quản trị cuối cùng', () => {
  expect(toggleLockBlock({ status: 'active' }, all('lastCompanyAdmin'))).toBe('lastCompanyAdmin')
  expect(toggleLockBlock({ status: 'suspended' }, all('lastSystemAdmin'))).toBeNull()
  expect(toggleLockBlock({ status: 'suspended' }, all('self'))).toBe('self')
})
