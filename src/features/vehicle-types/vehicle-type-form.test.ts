import { expect, test } from 'vitest'
import type { VehicleType } from '@/lib/mock-db'
import {
  EMPTY_VEHICLE_TYPE,
  percentToRatio,
  ratioToPercent,
  toVehicleTypeForm,
  toVehicleTypeInput,
  vehicleTypeFormSchema,
  type VehicleTypeFormInput,
} from './vehicle-type-form'

const VALID: VehicleTypeFormInput = {
  ...EMPTY_VEHICLE_TYPE,
  name: '  Xe tải 9,5 tấn thùng 7,2 m ',
  cargoLengthCm: 720,
  cargoWidthCm: 235,
  cargoHeightCm: 240,
  payloadKg: 9500,
}

/** `ô:key từ điển` của từng lỗi — lỗi nằm đúng ô của nó. */
function errors(input: VehicleTypeFormInput) {
  const result = vehicleTypeFormSchema.safeParse(input)
  return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join('.')}:${issue.message}`)
}

test('an empty form reports each required field at its own input and nothing for the optional axle limits', () => {
  expect(errors(EMPTY_VEHICLE_TYPE)).toStrictEqual([
    'name:vehicleTypes.form.errors.nameRequired',
    'cargoLengthCm:vehicleTypes.form.errors.positive',
    'cargoWidthCm:vehicleTypes.form.errors.positive',
    'cargoHeightCm:vehicleTypes.form.errors.positive',
    'payloadKg:vehicleTypes.form.errors.positive',
  ])
})

test('a new type starts at a 15% offset; blank axle limits stay out of the store input', () => {
  expect(EMPTY_VEHICLE_TYPE.maxCogOffsetPercent).toBe(15)
  expect(toVehicleTypeInput(vehicleTypeFormSchema.parse(VALID))).toStrictEqual({
    name: 'Xe tải 9,5 tấn thùng 7,2 m', cargoLengthCm: 720, cargoWidthCm: 235, cargoHeightCm: 240, payloadKg: 9500, maxCogOffsetRatio: 0.15,
  })
})

test('axle limits are rounded to 0.01 kg and the offset percent becomes a ratio', () => {
  const values = vehicleTypeFormSchema.parse({ ...VALID, frontAxleLimitKg: 3600.456, rearAxleLimitKg: 9200, maxCogOffsetPercent: 12.5 })
  expect(toVehicleTypeInput(values)).toMatchObject({ frontAxleLimitKg: 3600.46, rearAxleLimitKg: 9200, maxCogOffsetRatio: 0.125 })
})

test('an axle limit, when entered, must be above 0; the offset must be above 0 and at most 50%', () => {
  expect(errors({ ...VALID, frontAxleLimitKg: 0, rearAxleLimitKg: -5 })).toStrictEqual([
    'frontAxleLimitKg:vehicleTypes.form.errors.positive',
    'rearAxleLimitKg:vehicleTypes.form.errors.positive',
  ])
  expect(errors({ ...VALID, maxCogOffsetPercent: 0 })).toStrictEqual(['maxCogOffsetPercent:vehicleTypes.form.errors.cogRange'])
  expect(errors({ ...VALID, maxCogOffsetPercent: 50.5 })).toStrictEqual(['maxCogOffsetPercent:vehicleTypes.form.errors.cogRange'])
  expect(errors({ ...VALID, maxCogOffsetPercent: Number.NaN })).toStrictEqual(['maxCogOffsetPercent:vehicleTypes.form.errors.cogRange'])
  expect(errors({ ...VALID, maxCogOffsetPercent: 50 })).toStrictEqual([])
})

test('a stored type fills the form: missing axle limits are blank inputs, the ratio shows as a clean percent', () => {
  const type: VehicleType = {
    id: 'VT-002', companyId: 'LOG-001', name: 'Xe tải 9,5 tấn thùng 7,2 m', cargoLengthCm: 720, cargoWidthCm: 235, cargoHeightCm: 240, payloadKg: 9500,
    rearAxleLimitKg: 9200, maxCogOffsetRatio: 0.15, createdAt: '2026-08-05T02:00:00.000Z',
  }
  expect(toVehicleTypeForm(type)).toStrictEqual({
    name: 'Xe tải 9,5 tấn thùng 7,2 m', cargoLengthCm: 720, cargoWidthCm: 235, cargoHeightCm: 240, payloadKg: 9500,
    frontAxleLimitKg: Number.NaN, rearAxleLimitKg: 9200, maxCogOffsetPercent: 15,
  })
})

test('percent and ratio convert without floating-point residue', () => {
  // 0.15 * 100 = 15.000000000000002 và 0.07 * 100 = 7.000000000000001 nếu nhân thẳng
  expect([0.15, 0.07, 0.125, 0.5].map(ratioToPercent)).toStrictEqual([15, 7, 12.5, 50])
  expect([15, 7, 12.5, 50].map(percentToRatio)).toStrictEqual([0.15, 0.07, 0.125, 0.5])
})
