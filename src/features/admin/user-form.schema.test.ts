import { expect, test } from 'vitest'
import { userFormSchema, type UserFormInput } from './user-form.schema'

/**
 * Form người dùng (LM-092): schema trả key từ điển làm message. FE-0-08: form theo phạm vi của người quản trị — quản trị công ty chỉ có
 * vai trò công ty và kho bắt buộc; quản trị hệ thống chỉ có vai trò nền tảng và không có kho.
 */
const VALID: UserFormInput = { fullName: 'Vương Thị Bích Ngọc', email: 'ngoc.vuong@loadmaster.vn', phone: '0926971238', role: 'dispatcher', depot: 'Kho Long Bình' }

/** Lỗi của schema dạng `ô: key`. */
function errorsOf(scope: 'platform' | 'company', input: UserFormInput) {
  const result = userFormSchema(scope).safeParse(input)
  return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
}

test('a valid account is normalised: text trimmed, phone stored in its display form', () => {
  expect(userFormSchema('company').parse({ ...VALID, fullName: '  Vương Thị Bích Ngọc ', depot: ' Kho Long Bình ' })).toStrictEqual({
    fullName: 'Vương Thị Bích Ngọc', email: 'ngoc.vuong@loadmaster.vn', phone: '0926 971 238', role: 'dispatcher', depot: 'Kho Long Bình',
  })
})

test('the company form takes the five company roles, and each needs a depot; a blank one is reported at the depot field', () => {
  for (const role of ['companyAdmin', 'manager', 'dispatcher', 'warehouse', 'driver'] as const) {
    expect(errorsOf('company', { ...VALID, role }), role).toStrictEqual([])
    expect(errorsOf('company', { ...VALID, role, depot: '   ' }), role).toStrictEqual(['depot: admin.users.errors.depotRequired'])
  }
})

test('the platform form takes the three platform roles and no depot, so a blank one is accepted', () => {
  for (const role of ['systemAdmin', 'systemManager', 'systemSupporter'] as const) {
    expect(errorsOf('platform', { ...VALID, role, depot: '' }), role).toStrictEqual([])
  }
})

test('a role outside the scope of the form is refused at the role field', () => {
  for (const role of ['systemAdmin', 'systemManager', 'systemSupporter'] as const) {
    expect(errorsOf('company', { ...VALID, role }), role).toStrictEqual(['role: admin.users.errors.roleRequired'])
  }
  for (const role of ['companyAdmin', 'manager', 'dispatcher', 'warehouse', 'driver'] as const) {
    expect(errorsOf('platform', { ...VALID, role }), role).toStrictEqual(['role: admin.users.errors.roleRequired'])
  }
})

test('every broken field is reported together, the depot included', () => {
  expect(errorsOf('company', { fullName: '', email: 'khong-phai-email', phone: '12345', role: 'driver', depot: '' })).toStrictEqual([
    'fullName: admin.users.errors.fullNameRequired',
    'email: admin.users.errors.emailInvalid',
    'phone: admin.users.errors.phoneInvalid',
    'depot: admin.users.errors.depotRequired',
  ])
})
