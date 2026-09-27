import { expect, test } from 'vitest'
import { EMPTY_PACKAGE_TYPE, packageTypeFormSchema, toPackageTypeInput, uprightOrientations, type PackageTypeFormInput } from './package-type-form'

const VALID: PackageTypeFormInput = {
  ...EMPTY_PACKAGE_TYPE,
  name: '  Thùng nước mắm 12 chai ',
  lengthCm: 40,
  widthCm: 30,
  heightCm: 28,
  weightKg: 15,
  allowedOrientations: ['WLH', 'LWH'],
  maxTopLoadKg: 45,
}

function codes(input: PackageTypeFormInput) {
  const result = packageTypeFormSchema.safeParse(input)
  return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join('.')}:${issue.message}`)
}

test('an empty form reports codes of the Spec package schema, not sentences', () => {
  expect(codes(EMPTY_PACKAGE_TYPE)).toStrictEqual([
    'name:packageType.name.required',
    'lengthCm:common.number.invalid',
    'widthCm:common.number.invalid',
    'heightCm:common.number.invalid',
    'weightKg:common.number.invalid',
  ])
})

test('a blank layer count means no limit; the store input keeps Spec orientation order', () => {
  const values = packageTypeFormSchema.parse(VALID)
  expect(toPackageTypeInput(values)).toStrictEqual({
    name: 'Thùng nước mắm 12 chai', lengthCm: 40, widthCm: 30, heightCm: 28, weightKg: 15, allowedOrientations: ['LWH', 'WLH'],
    keepUpright: true, fragilityLevel: 'NONE', stackable: true, maxTopLoadKg: 45,
  })
  expect(toPackageTypeInput(packageTypeFormSchema.parse({ ...VALID, maxStackCount: 4 })).maxStackCount).toBe(4)
})

test('stacking rules follow D-25: no top load without stacking, layer count is a whole number from 1', () => {
  expect(codes({ ...VALID, stackable: false })).toStrictEqual(['maxTopLoadKg:package.maxTopLoadKg.notStackable'])
  expect(codes({ ...VALID, maxStackCount: 0 })).toStrictEqual(['maxStackCount:package.maxStackCount.min'])
  expect(codes({ ...VALID, maxStackCount: 2.5 })).toStrictEqual(['maxStackCount:package.maxStackCount.integer'])
  expect(codes({ ...VALID, allowedOrientations: [] })).toStrictEqual(['allowedOrientations:package.allowedOrientations.empty'])
})

test('keeping a package upright leaves only the two upright orientations', () => {
  expect(uprightOrientations(['LWH', 'LHW', 'WLH', 'HWL'])).toStrictEqual(['LWH', 'WLH'])
})
