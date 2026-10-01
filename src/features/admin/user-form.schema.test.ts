import { expect, test } from 'vitest'
import { userFormSchema, type UserFormInput } from './user-form.schema'

/** Form người dùng (LM-092): schema trả key từ điển làm message. FE-0-03: kho bắt buộc theo vai trò. */
const VALID: UserFormInput = { fullName: 'Vương Thị Bích Ngọc', email: 'ngoc.vuong@loadmaster.vn', phone: '0926971238', role: 'dispatcher', depot: 'Kho Long Bình' }

/** Lỗi của schema dạng `ô: key`. */
function errorsOf(input: UserFormInput) {
  const result = userFormSchema.safeParse(input)
  return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
}

test('a valid account is normalised: text trimmed, phone stored in its display form', () => {
  expect(userFormSchema.parse({ ...VALID, fullName: '  Vương Thị Bích Ngọc ', depot: ' Kho Long Bình ' })).toStrictEqual({
    fullName: 'Vương Thị Bích Ngọc', email: 'ngoc.vuong@loadmaster.vn', phone: '0926 971 238', role: 'dispatcher', depot: 'Kho Long Bình',
  })
})

test('a company role needs a depot; a blank one is reported at the depot field', () => {
  for (const role of ['companyAdmin', 'manager', 'dispatcher', 'warehouse', 'driver'] as const) {
    expect(errorsOf({ ...VALID, role, depot: '   ' }), role).toStrictEqual(['depot: admin.users.errors.depotRequired'])
  }
})

test('a platform role has no depot, so a blank one is accepted', () => {
  for (const role of ['systemAdmin', 'systemManager', 'systemSupporter'] as const) {
    expect(errorsOf({ ...VALID, role, depot: '' }), role).toStrictEqual([])
  }
})

test('every broken field is reported together, the depot included', () => {
  expect(errorsOf({ fullName: '', email: 'khong-phai-email', phone: '12345', role: 'driver', depot: '' })).toStrictEqual([
    'fullName: admin.users.errors.fullNameRequired',
    'email: admin.users.errors.emailInvalid',
    'phone: admin.users.errors.phoneInvalid',
    'depot: admin.users.errors.depotRequired',
  ])
})
