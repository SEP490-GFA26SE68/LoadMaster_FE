import { expect, test } from 'vitest'
import { CONTACT_LIMITS, createMockDb } from '@/lib/mock-db'
import {
  CONTACT_FORM_FIELDS,
  CONTACT_MIN_FILL_MS,
  contactDefaults,
  contactFormSchema,
  contactGuard,
  NO_PLAN,
  toNewContact,
  type ContactFormValues,
} from './contact-form'

/**
 * Luật của form liên hệ công khai: cùng giới hạn độ dài và luật email với kho (`contacts.test.ts` kiểm phía kho), và giá trị chọn sẵn từ
 * URL của Bảng giá; ô đồng ý bắt buộc, ô bẫy và thời gian điền tối thiểu chặn trình gửi tự động.
 */
const VALID: ContactFormValues = {
  fullName: 'Lê Thu Hà',
  email: 'ha.le@vantaimientay.vn',
  phoneNumber: '',
  companyName: '',
  requestType: 'INQUIRY',
  planId: NO_PLAN,
  message: '',
  consent: true,
  website: '',
}

/** Mã lỗi đầu tiên của ô `field` khi ô đó nhận `value`; `undefined` là ô hợp lệ. */
function errorOf(field: keyof ContactFormValues, value: string): string | undefined {
  const result = contactFormSchema.safeParse({ ...VALID, [field]: value })
  return result.success ? undefined : result.error.issues.find((issue) => issue.path[0] === field)?.message
}

/** Ô có giới hạn độ dài và số ký tự tối đa đã thống nhất với kho. */
const MAX_LENGTH = { fullName: 150, email: 150, phoneNumber: 30, companyName: 200, message: 2000 } as const

const LIMITS: readonly [keyof typeof MAX_LENGTH, number, (length: number) => string, string][] = [
  ['fullName', CONTACT_LIMITS.fullName, (length) => 'a'.repeat(length), 'fullNameTooLong'],
  ['email', CONTACT_LIMITS.email, (length) => `${'k'.repeat(length - 5)}@a.vn`, 'emailTooLong'],
  ['phoneNumber', CONTACT_LIMITS.phoneNumber, (length) => '9'.repeat(length), 'phoneTooLong'],
  ['companyName', CONTACT_LIMITS.companyName, (length) => 'c'.repeat(length), 'companyTooLong'],
  ['message', CONTACT_LIMITS.message, (length) => 'm'.repeat(length), 'messageTooLong'],
]

test.each(LIMITS)('%s takes up to %i characters, whitespace around them not counted', (field, max, text, code) => {
  expect(max).toBe(MAX_LENGTH[field])
  expect(text(max)).toHaveLength(max)
  expect(errorOf(field, `  ${text(max)}  `)).toBeUndefined()
  expect(errorOf(field, text(max + 1))).toBe(`landing.contact.form.errors.${code}`)
})

test('name and email are required, spaces alone do not count', () => {
  expect(errorOf('fullName', '   ')).toBe('landing.contact.form.errors.fullNameRequired')
  expect(errorOf('email', '   ')).toBe('landing.contact.form.errors.emailRequired')
})

test('an email carrying mailto parameters is refused, as the store refuses it', () => {
  expect(errorOf('email', 'a@b.vn?cc=x%40y.vn&subject=hi')).toBe('landing.contact.form.errors.emailInvalid')
  expect(errorOf('email', 'ha.le@vantaimientay')).toBe('landing.contact.form.errors.emailInvalid')
})

test('the plan and request type come from the URL only when they are known and on sale', async () => {
  const plans = await createMockDb().listSubscriptionPlans()
  const pick = (search: string, from = plans) => {
    const { planId, requestType } = contactDefaults(new URLSearchParams(search), from)
    return [planId, requestType]
  }

  expect(pick('goi=PLAN-002&loai=xem-demo')).toStrictEqual(['PLAN-002', 'DEMO_REQUEST'])
  // Gói lạ, loại lạ, hay không có gì: chưa chọn gói, loại "Hỏi thông tin"
  expect(pick('goi=PLAN-999&loai=khong-co')).toStrictEqual([NO_PLAN, 'INQUIRY'])
  expect(pick('')).toStrictEqual([NO_PLAN, 'INQUIRY'])
  // Gói đã ngừng bán không chọn sẵn được
  const retired = plans.map((plan) => (plan.id === 'PLAN-001' ? { ...plan, active: false } : plan))
  expect(pick('goi=PLAN-001&loai=bao-gia', retired)).toStrictEqual([NO_PLAN, 'PRICING'])
})

test('the consent box must be ticked, and the store never receives it nor the trap field', () => {
  const unticked = contactFormSchema.safeParse({ ...VALID, consent: false })
  expect(unticked.success).toBe(false)
  expect(unticked.error?.issues.map((issue) => [issue.path[0], issue.message])).toStrictEqual([['consent', 'landingContact.errors.consentRequired']])

  const sent = toNewContact(contactFormSchema.parse({ ...VALID, website: 'https://spam.example' }))
  expect(sent).toStrictEqual({ fullName: 'Lê Thu Hà', email: 'ha.le@vantaimientay.vn', requestType: 'INQUIRY' })
  expect(contactDefaults(new URLSearchParams(''), [])).toMatchObject({ consent: false, website: '' })
})

test('a filled trap field or a send sooner than the minimum fill time is blocked before the store', () => {
  const shownAt = 1_000_000
  expect(CONTACT_MIN_FILL_MS).toBe(3000)
  expect(contactGuard({ trap: '', shownAt, now: shownAt + 2999 })).toBe('TOO_FAST')
  expect(contactGuard({ trap: '', shownAt, now: shownAt + 3000 })).toBeNull()
  expect(contactGuard({ trap: '   ', shownAt, now: shownAt + 60_000 })).toBeNull()
  // Ô bẫy thắng: có chữ là chặn dù đã đủ thời gian
  expect(contactGuard({ trap: 'x', shownAt, now: shownAt + 60_000 })).toBe('TRAP_FILLED')
})

test('the field list the privacy page shows is every field the store receives, with the right required flags', () => {
  const sentFields = Object.keys(contactFormSchema.shape).filter((name) => name !== 'consent' && name !== 'website')
  expect(CONTACT_FORM_FIELDS.map((field) => field.name)).toStrictEqual(sentFields)
  for (const field of CONTACT_FORM_FIELDS) {
    const empty = field.name === 'requestType' ? undefined : ''
    expect(contactFormSchema.shape[field.name].safeParse(empty).success, field.name).toBe(!field.required)
  }
})
