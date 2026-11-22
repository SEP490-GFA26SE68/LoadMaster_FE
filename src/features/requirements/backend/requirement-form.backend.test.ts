import { expect, test } from 'vitest'
import { initialValues, toInput, validateRequirement } from './requirement-form'
const valid = () => ({
  ...initialValues(), customerId: '12', expectedPackageCount: '3', destinationName: ' Kho A ',
  address: ' 12 Đường A ', deadlineDate: '2099-12-31', deadlineTime: '17:00',
})
const now = new Date('2026-11-11T00:00:00Z')
test('valid server form needs customer/count, not existing packages', () => {
  expect(validateRequirement(valid(), now)).toEqual({})
  expect(toInput(valid())).toMatchObject({ customerId: '12', expectedPackageCount: 3, address: '12 Đường A', packageIds: [] })
})
test.each(['', '0', '-1', '1.5', '9007199254740992'])('reject invalid expected count %s', count => {
  expect(validateRequirement({ ...valid(), expectedPackageCount: count }, now).expectedPackageCount).toBe('invalidCount')
})
test('reject missing customer, past deadline and partial coordinates', () => {
  const errors = validateRequirement({ ...valid(), customerId: '', deadlineDate: '2020-01-01', coordinates: { lat: '10', lng: '' } }, now)
  expect(errors).toMatchObject({ customerId: 'required', deadlineDate: 'deadlinePast', coordinates: 'coordinatesInvalid' })
})
