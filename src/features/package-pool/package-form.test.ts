import { expect, test } from 'vitest'
import { createTranslator } from '@/lib/i18n'
import { EMPTY_PACKAGE, isPackageFormError, NO_PACKAGE_TYPE, PACKAGE_FORM_ERRORS, packageFormSchema, toPackageInput } from './package-form'

const VALID = { ...EMPTY_PACKAGE, lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 18, destination: ' KCN Hoà Khánh, Đà Nẵng ' }

const codes = (values: unknown) => {
  const parsed = packageFormSchema.safeParse(values)
  return parsed.success ? [] : parsed.error.issues.map((issue) => [issue.path.join('.'), issue.message])
}

test('a valid form becomes the store input: blank code and "no package type" are left out, text is trimmed', () => {
  const parsed = packageFormSchema.parse(VALID)
  expect(toPackageInput(parsed)).toStrictEqual({ lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 18, handlingClass: 'STANDARD', destination: 'KCN Hoà Khánh, Đà Nẵng' })
  const full = packageFormSchema.parse({ ...VALID, packageCode: ' HK-DNG-2609-06 ', handlingClass: 'FRAGILE', packageTypeId: 'PT-006' })
  expect(toPackageInput(full)).toMatchObject({ packageCode: 'HK-DNG-2609-06', handlingClass: 'FRAGILE', packageTypeId: 'PT-006' })
  expect(EMPTY_PACKAGE.packageTypeId).toBe(NO_PACKAGE_TYPE)
})

test('the empty form reports every missing field as a code: three sizes, weight, destination', () => {
  expect(codes(EMPTY_PACKAGE)).toStrictEqual([
    ['lengthCm', 'numberInvalid'], ['widthCm', 'numberInvalid'], ['heightCm', 'numberInvalid'], ['weightKg', 'numberInvalid'], ['destination', 'destinationRequired'],
  ])
})

test('sizes and weight must be above zero; code and destination have a length limit', () => {
  expect(codes({ ...VALID, lengthCm: 0, heightCm: -2, weightKg: 0 })).toStrictEqual([
    ['lengthCm', 'dimensionPositive'], ['heightCm', 'dimensionPositive'], ['weightKg', 'weightPositive'],
  ])
  expect(codes({ ...VALID, packageCode: 'X'.repeat(61), destination: 'Đ'.repeat(201) })).toStrictEqual([['packageCode', 'codeTooLong'], ['destination', 'destinationTooLong']])
  expect(codes({ ...VALID, destination: '   ' })).toStrictEqual([['destination', 'destinationRequired']])
})

test('every error code has a sentence in both languages', () => {
  for (const locale of ['vi', 'en'] as const) {
    const t = createTranslator(locale)
    for (const code of PACKAGE_FORM_ERRORS) expect(t(`sourcing.form.errors.${code}`), `${locale} ${code}`).not.toContain('sourcing.')
  }
  expect(isPackageFormError('weightPositive')).toBe(true)
  expect(isPackageFormError('Invalid option')).toBe(false)
})
