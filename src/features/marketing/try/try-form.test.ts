import { expect, test } from 'vitest'
import { SPEC_CARTON_A, SPEC_TRUCK_6M } from '@/domain/fixtures/spec-samples'
import { seedVehicles } from '@/lib/mock-db/seed-vehicles'
import {
  CARTON_PRESET,
  cartonValues,
  MAX_TOTAL_QUANTITY,
  parseTryNumber,
  previewTruck,
  sameInput,
  toTryInput,
  TRUCK_PRESETS,
  TRY_DEFAULTS,
  TRY_ERRORS,
  tryFormSchema,
  type TryFormValues,
} from './try-form'

/** Lỗi của schema theo đường dẫn ô ("truck.lengthCm", "cartons.1.quantity"). */
function errorsOf(values: TryFormValues): Record<string, string> {
  const result = tryFormSchema.safeParse(values)
  return result.success ? {} : Object.fromEntries(result.error.issues.map((issue) => [issue.path.join('.'), issue.message]))
}

function withTruck(patch: Partial<TryFormValues['truck']>): TryFormValues {
  return { ...TRY_DEFAULTS, truck: { ...TRY_DEFAULTS.truck, ...patch } }
}

test('numbers take a comma or a dot as the decimal sign and nothing else', () => {
  expect(parseTryNumber('45,5')).toBe(45.5)
  expect(parseTryNumber(' 45.5 ')).toBe(45.5)
  expect(parseTryNumber('600')).toBe(600)
  expect(parseTryNumber('')).toBeNull()
  expect(parseTryNumber('-5')).toBeNull()
  expect(parseTryNumber('12cm')).toBeNull()
  expect(parseTryNumber('1.234,5')).toBeNull()
})

test('the form opens on the Spec "Truck 6m" and "Carton A", and those values pass', () => {
  expect(errorsOf(TRY_DEFAULTS)).toEqual({})
  expect(toTryInput(TRY_DEFAULTS)).toEqual({
    truck: { lengthCm: 600, widthCm: 240, heightCm: 250, payloadKg: 5000 },
    cartons: [{ lengthCm: 120, widthCm: 60, heightCm: 45, weightKg: 30, quantity: 4 }],
  })
})

test('truck presets are the Spec truck and the smallest and largest seed trucks, read from the data rather than typed', () => {
  const volume = (vehicle: (typeof SPEC_TRUCK_6M)) => vehicle.innerLengthCm * vehicle.innerWidthCm * vehicle.innerHeightCm
  const fleet = seedVehicles().toSorted((a, b) => volume(a) - volume(b))
  const truckOf = (vehicle: typeof SPEC_TRUCK_6M) => ({
    lengthCm: vehicle.innerLengthCm, widthCm: vehicle.innerWidthCm, heightCm: vehicle.innerHeightCm, payloadKg: vehicle.maxPayloadKg,
  })
  expect(TRUCK_PRESETS.map((preset) => preset.id)).toEqual(['spec', 'smallest', 'largest'])
  expect(TRUCK_PRESETS.map((preset) => preset.truck)).toEqual([truckOf(SPEC_TRUCK_6M), truckOf(fleet[0]!), truckOf(fleet.at(-1)!)])
  expect(CARTON_PRESET.name).toBe(SPEC_CARTON_A.name)
  expect(CARTON_PRESET.carton.quantity).toBe(SPEC_CARTON_A.quantity)
  // Mọi xe mẫu và kiện mẫu đều nằm trong khoảng form nhận
  for (const preset of TRUCK_PRESETS) {
    expect(errorsOf({ truck: truckFields(preset.truck), cartons: TRY_DEFAULTS.cartons })).toEqual({})
  }
})

function truckFields(truck: (typeof TRUCK_PRESETS)[number]['truck']): TryFormValues['truck'] {
  return { lengthCm: String(truck.lengthCm), widthCm: String(truck.widthCm), heightCm: String(truck.heightCm), payloadKg: String(truck.payloadKg) }
}

test('each field reports empty, not a number, out of range or not whole as an i18n key', () => {
  expect(errorsOf(withTruck({ lengthCm: '' }))).toEqual({ 'truck.lengthCm': TRY_ERRORS.required })
  expect(errorsOf(withTruck({ widthCm: 'abc' }))).toEqual({ 'truck.widthCm': TRY_ERRORS.number })
  expect(errorsOf(withTruck({ heightCm: '301' }))).toEqual({ 'truck.heightCm': TRY_ERRORS.range })
  expect(errorsOf(withTruck({ payloadKg: '99,9' }))).toEqual({ 'truck.payloadKg': TRY_ERRORS.range })
  expect(errorsOf(withTruck({ lengthCm: '1400' }))).toEqual({})
  const carton = { ...cartonValues(CARTON_PRESET.carton), quantity: '2,5', weightKg: '0,05' }
  expect(errorsOf({ ...TRY_DEFAULTS, cartons: [carton] })).toEqual({
    'cartons.0.weightKg': TRY_ERRORS.range,
    'cartons.0.quantity': TRY_ERRORS.integer,
  })
})

test('the two carton kinds together stay within the trial cap, reported on the last quantity', () => {
  const half = { ...cartonValues(CARTON_PRESET.carton), quantity: String(MAX_TOTAL_QUANTITY / 2) }
  expect(errorsOf({ ...TRY_DEFAULTS, cartons: [half, half] })).toEqual({})
  const over = { ...half, quantity: String(MAX_TOTAL_QUANTITY / 2 + 1) }
  expect(errorsOf({ ...TRY_DEFAULTS, cartons: [half, over] })).toEqual({ 'cartons.1.quantity': TRY_ERRORS.totalQuantity })
  expect(toTryInput({ ...TRY_DEFAULTS, cartons: [half, over] })).toBeNull()
})

test('the live preview keeps a drawable truck while the visitor is typing', () => {
  expect(previewTruck({ lengthCm: '', widthCm: '9999', heightCm: '45,5', payloadKg: 'x' })).toEqual({
    lengthCm: SPEC_TRUCK_6M.innerLengthCm,
    widthCm: 260,
    heightCm: 100,
    payloadKg: SPEC_TRUCK_6M.maxPayloadKg,
  })
})

test('a result stays current while the figures read the same, whatever the decimal sign', () => {
  const input = toTryInput(TRY_DEFAULTS)
  const sameFigures = toTryInput({ ...TRY_DEFAULTS, cartons: [{ ...TRY_DEFAULTS.cartons[0]!, weightKg: '30,0' }] })
  expect(sameInput(input, sameFigures)).toBe(true)
  expect(sameInput(input, toTryInput(withTruck({ lengthCm: '601' })))).toBe(false)
  expect(sameInput(input, null)).toBe(false)
})
