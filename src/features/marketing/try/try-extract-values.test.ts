import { describe, expect, test } from 'vitest'
import { extractGaps, extractValues, fieldText, gapPaths, type ExtractCarton, type TryExtract } from './try-extract-values'
import { TRY_DEFAULTS, tryFormSchema } from './try-form'

/** Kết quả máy chủ đọc từ "Xe 5 tấn thùng 6 m. 200 thùng 40×30×30 nặng 12,5 kg giao điểm 1, 20 kiện 120×100×150 80 kg giao điểm 2". */
const carton = (patch: Partial<ExtractCarton> = {}): ExtractCarton => ({ lengthCm: 40, widthCm: 30, heightCm: 30, weightKg: 12.5, quantity: 200, stop: 1, ...patch })
const FULL: TryExtract = {
  truck: { lengthCm: 600, widthCm: 230, heightCm: 240, payloadKg: 5000 },
  cartons: [carton(), carton({ lengthCm: 120, widthCm: 100, heightCm: 150, weightKg: 80, quantity: 20, stop: 2 })],
  assumptions: ['Thùng xe 5 tấn: lấy lòng thùng 600 × 230 × 240 cm.'],
  missing: [],
}

describe('fieldText', () => {
  test('a number becomes the text a visitor would type: no thousands separator, the decimal mark of the language, at most two decimals', () => {
    expect(fieldText(5000, 'vi')).toBe('5000')
    expect(fieldText(5000, 'en')).toBe('5000')
    expect(fieldText(12.5, 'vi')).toBe('12,5')
    expect(fieldText(12.5, 'en')).toBe('12.5')
    expect(fieldText(0.125, 'vi')).toBe('0,13')
    expect(fieldText(12.0, 'en')).toBe('12')
  })

  test('no number (or one that is not finite) leaves the field empty', () => {
    expect(fieldText(null, 'vi')).toBe('')
    expect(fieldText(Number.NaN, 'vi')).toBe('')
    expect(fieldText(Number.POSITIVE_INFINITY, 'en')).toBe('')
  })
})

describe('extractValues', () => {
  test('a full result fills the truck and replaces the carton types, and the form accepts it as it is', () => {
    const values = extractValues(FULL, TRY_DEFAULTS, 'vi')
    expect(values).toStrictEqual({
      truck: { lengthCm: '600', widthCm: '230', heightCm: '240', payloadKg: '5000' },
      cartons: [
        { lengthCm: '40', widthCm: '30', heightCm: '30', weightKg: '12,5', quantity: '200', stop: '1' },
        { lengthCm: '120', widthCm: '100', heightCm: '150', weightKg: '80', quantity: '20', stop: '2' },
      ],
    })
    expect(tryFormSchema.safeParse(values).success).toBe(true)
  })

  test('no truck in the description keeps the truck the form already has', () => {
    const current = { ...TRY_DEFAULTS, truck: { lengthCm: '720', widthCm: '235', heightCm: '240', payloadKg: '8000' } }
    expect(extractValues({ ...FULL, truck: null }, current, 'en')?.truck).toStrictEqual(current.truck)
  })

  test('a field the server could not read is left empty, never filled with a guess', () => {
    const values = extractValues({ ...FULL, cartons: [carton({ weightKg: null })], missing: ['cartons[0].weightKg'] }, TRY_DEFAULTS, 'vi')
    expect(values?.cartons).toStrictEqual([{ lengthCm: '40', widthCm: '30', heightCm: '30', weightKg: '', quantity: '200', stop: '1' }])
  })

  test('an unknown or out-of-range stop is set to stop 1 for now (the stop picker has no empty value)', () => {
    const values = extractValues({ ...FULL, cartons: [carton({ stop: null }), carton({ stop: 7 }), carton({ stop: 4 })] }, TRY_DEFAULTS, 'vi')
    expect(values?.cartons.map(({ stop }) => stop)).toStrictEqual(['1', '1', '4'])
  })

  test('at most four carton types are kept', () => {
    const cartons = [1, 2, 3, 4, 5, 6].map((stop) => carton({ quantity: 10, stop: Math.min(stop, 4) }))
    expect(extractValues({ ...FULL, cartons }, TRY_DEFAULTS, 'vi')?.cartons).toHaveLength(4)
  })

  test('no carton recognised: nothing to fill, the form stays as it is', () => {
    expect(extractValues({ ...FULL, cartons: [], missing: ['cartons'] }, TRY_DEFAULTS, 'vi')).toBeNull()
  })
})

describe('extractGaps and gapPaths', () => {
  test('a full result has nothing missing', () => {
    expect(extractGaps(FULL)).toStrictEqual([])
  })

  test('the reported paths become gaps in form order, both index spellings are read, unknown paths are dropped', () => {
    const result: TryExtract = {
      truck: { lengthCm: null, widthCm: 230, heightCm: 240, payloadKg: 5000 },
      cartons: [carton({ weightKg: null }), carton({ quantity: null, stop: null })],
      assumptions: [],
      missing: ['cartons.1.quantity', 'cartons[0].weightKg', 'truck.lengthCm', 'cartons[1].stop', 'cartons[5].weightKg', 'truck.colour', 'whatever'],
    }
    const gaps = extractGaps(result)
    expect(gaps).toStrictEqual([
      { kind: 'truck', field: 'lengthCm' },
      { kind: 'carton', index: 0, field: 'weightKg' },
      { kind: 'carton', index: 1, field: 'quantity' },
      { kind: 'carton', index: 1, field: 'stop' },
    ])
    // Ô điểm giao đã có giá trị tạm: không kiểm
    expect(gapPaths(gaps, 2)).toStrictEqual(['truck.lengthCm', 'cartons.0.weightKg', 'cartons.1.quantity'])
  })

  test('a null the server forgot to report is still a gap, so the empty field is never silent', () => {
    expect(extractGaps({ ...FULL, cartons: [carton({ heightCm: null })] })).toStrictEqual([{ kind: 'carton', index: 0, field: 'heightCm' }])
  })

  test('over four carton types and over the total cap are gaps; the total is checked on the quantity of the last type', () => {
    const result: TryExtract = { ...FULL, cartons: [carton({ quantity: 700 }), carton({ quantity: 500 })], missing: ['cartonKinds', 'totalQuantity'] }
    const gaps = extractGaps(result)
    expect(gaps).toStrictEqual([{ kind: 'cartonKinds' }, { kind: 'totalQuantity' }])
    expect(gapPaths(gaps, 2)).toStrictEqual(['cartons.1.quantity'])
    // Máy chủ quên báo: form vẫn thấy tổng vượt trần và hơn bốn loại
    const six = Array.from({ length: 6 }, () => carton({ quantity: 300 }))
    expect(extractGaps({ ...FULL, cartons: six, missing: [] })).toStrictEqual([{ kind: 'cartonKinds' }, { kind: 'totalQuantity' }])
  })

  test('no truck means no truck gap; no carton means no gap at all', () => {
    expect(extractGaps({ ...FULL, truck: null })).toStrictEqual([])
    expect(extractGaps({ truck: null, cartons: [], assumptions: [], missing: ['cartons', 'truck.lengthCm'] })).toStrictEqual([])
  })
})
