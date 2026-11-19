import { expect, test } from 'vitest'
import {
  addedCarton,
  MAX_TOTAL_QUANTITY,
  parseTryNumber,
  sameInput,
  toTryInput,
  totalQuantity,
  TRY_DEFAULTS,
  TRY_ERRORS,
  tryFormSchema,
  type TryFormValues,
} from './try-form'

/** Bản sao của form mặc định, sửa một chỗ. */
function values(change: (draft: TryFormValues) => void): TryFormValues {
  const draft = structuredClone(TRY_DEFAULTS) as TryFormValues
  change(draft)
  return draft
}

/** Message (key từ điển) của lỗi ở đúng đường dẫn, hoặc `undefined`. */
function errorAt(form: TryFormValues, path: string): string | undefined {
  const parsed = tryFormSchema.safeParse(form)
  if (parsed.success) return undefined
  return parsed.error.issues.find((issue) => issue.path.join('.') === path)?.message
}

test('the defaults are a 3.5-tonne box truck with two carton types for two stops, ready to run', () => {
  expect(toTryInput(TRY_DEFAULTS)).toEqual({
    truck: { lengthCm: 520, widthCm: 200, heightCm: 200, payloadKg: 3500 },
    cartons: [
      { lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 15, quantity: 80, stop: 1 },
      { lengthCm: 80, widthCm: 60, heightCm: 50, weightKg: 30, quantity: 20, stop: 2 },
    ],
  })
})

test('numbers take either decimal mark with up to two decimals, and three digits after a mark are always thousands', () => {
  expect(parseTryNumber('45,5')).toBe(45.5)
  expect(parseTryNumber('45.25')).toBe(45.25)
  expect(parseTryNumber(' 120 ')).toBe(120)
  expect(parseTryNumber('3.500')).toBe(3500)
  expect(parseTryNumber('3,500')).toBe(3500)
  expect(parseTryNumber('1 000')).toBe(1000)
  expect(parseTryNumber('12.000.000')).toBe(12_000_000)
  for (const raw of ['', 'abc', '-3', '1.5.0', '1.50,5', '3,5000', '12,000.000']) expect(parseTryNumber(raw)).toBeNull()
  // Nhóm nghìn không bắt đầu bằng 0: "0,500" kg không được đọc thành 500 kg
  for (const raw of ['0,500', '0.750', '00.500', '0.500.000']) expect(parseTryNumber(raw)).toBeNull()
})

test('every field says what is wrong with it: empty, not a number, not whole, out of range', () => {
  expect(errorAt(values((v) => { v.truck.lengthCm = ' ' }), 'truck.lengthCm')).toBe(TRY_ERRORS.required)
  expect(errorAt(values((v) => { v.truck.widthCm = '2 m' }), 'truck.widthCm')).toBe(TRY_ERRORS.number)
  expect(errorAt(values((v) => { v.truck.widthCm = '400' }), 'truck.widthCm')).toBe(TRY_ERRORS.range)
  expect(errorAt(values((v) => { v.truck.payloadKg = '99' }), 'truck.payloadKg')).toBe(TRY_ERRORS.range)
  expect(errorAt(values((v) => { (v.cartons[0] as TryFormValues['cartons'][number]).quantity = '12,5' }), 'cartons.0.quantity')).toBe(TRY_ERRORS.integer)
  expect(errorAt(values((v) => { (v.cartons[0] as TryFormValues['cartons'][number]).weightKg = '0,05' }), 'cartons.0.weightKg')).toBe(TRY_ERRORS.range)
  // Hai đầu khoảng vẫn nhận
  expect(tryFormSchema.safeParse(values((v) => { v.truck.widthCm = '260'; v.truck.lengthCm = '1.400' })).success).toBe(true)
})

test('the trial loads at most 1,000 cartons in total; the error sits on the quantity of the last carton type', () => {
  const atCap = values((v) => {
    v.cartons = [{ ...addedCarton(0), quantity: '600' }, { ...addedCarton(1), quantity: '400' }]
  })
  expect(totalQuantity(atCap.cartons)).toBe(MAX_TOTAL_QUANTITY)
  expect(tryFormSchema.safeParse(atCap).success).toBe(true)

  const over = values((v) => {
    v.cartons = [{ ...addedCarton(0), quantity: '600' }, { ...addedCarton(1), quantity: '401' }]
  })
  expect(errorAt(over, 'cartons.1.quantity')).toBe(TRY_ERRORS.totalQuantity)
  expect(toTryInput(over)).toBeNull()
})

test('an added carton type goes to the next stop, up to stop 4', () => {
  expect([0, 1, 2, 3].map((index) => addedCarton(index).stop)).toEqual(['1', '2', '3', '4'])
})

test('a result is still current when the form reads the same numbers, however they were typed', () => {
  const typedOtherwise = values((v) => {
    v.truck.lengthCm = '520,0'
    v.truck.payloadKg = '3.500'
  })
  expect(sameInput(toTryInput(TRY_DEFAULTS), toTryInput(typedOtherwise))).toBe(true)
  expect(sameInput(toTryInput(TRY_DEFAULTS), toTryInput(values((v) => { v.truck.lengthCm = '600' })))).toBe(false)
  expect(sameInput(toTryInput(TRY_DEFAULTS), null)).toBe(false)
})
