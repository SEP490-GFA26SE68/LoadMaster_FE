import { beforeAll, expect, test } from 'vitest'
import { ApiError } from '@/lib/api-client'
import { createTranslator, loadLocale } from '@/lib/i18n'
import { extractErrorMessage, extractSummary, gapLabel } from './try-extract-text'
import type { TryExtract } from './try-extract-values'

const vi = createTranslator('vi')

beforeAll(async () => {
  await loadLocale('en')
})

const RESULT: TryExtract = {
  truck: null,
  cartons: [{ lengthCm: 40, widthCm: 30, heightCm: 30, weightKg: null, quantity: 200, stop: 1 }],
  assumptions: [],
  missing: ['cartons[0].weightKg'],
}

test('each missing path reads as the name of its form field', () => {
  expect(gapLabel({ kind: 'carton', index: 0, field: 'weightKg' }, vi)).toBe('Khối lượng — loại kiện 1')
  expect(gapLabel({ kind: 'carton', index: 2, field: 'stop' }, vi)).toBe('Điểm giao — loại kiện 3 (đang tạm để điểm 1)')
  expect(gapLabel({ kind: 'truck', field: 'lengthCm' }, vi)).toBe('Chiều dài thùng')
  expect(gapLabel({ kind: 'cartonKinds' }, vi)).toBe('Chỉ giữ 4 loại kiện đầu')
  expect(gapLabel({ kind: 'totalQuantity' }, vi)).toBe('Tổng số kiện vượt 1.000')
  const en = createTranslator('en')
  expect(gapLabel({ kind: 'truck', field: 'payloadKg' }, en)).toBe('Truck payload')
  expect(gapLabel({ kind: 'totalQuantity' }, en)).toBe('More than 1,000 cartons in total')
})

test('the summary says what was filled and that the visitor runs the plans', () => {
  expect(extractSummary(RESULT, vi)).toBe('Đã điền 1 loại kiện, thùng xe giữ nguyên. Kiểm lại rồi bấm “Tính ba phương án”.')
  const twoWithTruck: TryExtract = { ...RESULT, truck: { lengthCm: 600, widthCm: 230, heightCm: 240, payloadKg: 5000 }, cartons: [RESULT.cartons[0]!, RESULT.cartons[0]!] }
  expect(extractSummary(twoWithTruck, vi)).toBe('Đã điền thùng xe và 2 loại kiện. Kiểm lại rồi bấm “Tính ba phương án”.')
  expect(extractSummary({ ...RESULT, cartons: [] }, vi)).toBe('Chưa nhận ra kiện hàng nào trong mô tả, nên form giữ nguyên. Hãy ghi rõ kích thước, khối lượng và số kiện.')
})

test('every failure says plainly that nothing was filled', () => {
  expect(extractErrorMessage(new ApiError('ASSISTANT_RATE_LIMITED', { status: 429 }), vi)).toMatch(/^Lumo đang nhận quá nhiều yêu cầu nên chưa điền giúp được/)
  expect(extractErrorMessage(new ApiError('ASSISTANT_BUDGET_EXCEEDED', { status: 503 }), vi)).toMatch(/hết lượt đọc mô tả nên chưa điền giúp được/)
  expect(extractErrorMessage(new ApiError('ASSISTANT_UNAVAILABLE', { status: 503 }), vi)).toMatch(/^Lumo chưa đọc được mô tả lúc này/)
  expect(extractErrorMessage(new ApiError('ASSISTANT_MESSAGE_TOO_LONG', { status: 400 }), vi)).toMatch(/^Mô tả dài quá 1.000 ký tự/)
  expect(extractErrorMessage(new ApiError('INVALID_INPUT', { status: 400 }), vi)).toMatch(/^Máy chủ không nhận mô tả này/)
  expect(extractErrorMessage(new ApiError('NETWORK_ERROR'), vi)).toMatch(/^Không kết nối được máy chủ nên chưa điền giúp được/)
  expect(extractErrorMessage(new ApiError('SERVER_ERROR', { status: 502 }), vi)).toMatch(/^Không kết nối được máy chủ/)
  expect(extractErrorMessage(new Error('boom'), vi)).toBe('Chưa điền giúp được. Bạn nhập số vào form nhé.')
})
