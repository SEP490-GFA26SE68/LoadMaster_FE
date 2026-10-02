import { expect, test } from 'vitest'
import type { DeliveryRequirement } from '@/lib/mock-db'
import {
  deadlineIso, deadlineParts, initialValues, isFieldEditable, toChanges, toInput, validateRequirement, type RequirementFormValues,
} from './requirement-form'

/**
 * Form yêu cầu giao (FE-4b-02). Vitest chạy ở múi giờ Việt Nam (`vitest.config.ts`): 17:00 ngày 16/09/2026 là `2026-09-16T10:00:00.000Z`.
 * REQ-002 chép từ seed (`seed-sourcing.ts`).
 */

const NOW = new Date('2026-09-14T05:00:00.000Z')

const REQ_002: DeliveryRequirement = {
  id: 'REQ-002', companyId: 'LOG-001', destinationName: 'KCN Phú Bài', address: 'KCN Phú Bài, TX. Hương Thuỷ, Thừa Thiên Huế', lat: 16.4022, lng: 107.696,
  deadline: '2026-09-17T10:00:00.000Z', priority: 'HIGH', packageIds: ['PK-0057', 'PK-0058'], note: 'Hàng gốm, giao trong giờ hành chính',
  status: 'PENDING', createdAt: '2026-09-13T09:45:00.000Z', createdBy: 'US-0002',
}

const VALID: RequirementFormValues = {
  destinationName: ' Nhà hàng Hương Việt ', address: '203 Lê Văn Sỹ, P. 13, Q.3', deadlineDate: '2026-09-16', deadlineTime: '17:00', priority: 'NORMAL',
  packageIds: ['PK-0023'], note: ' ',
}

test('the deadline is entered as a local date and time and stored as an instant', () => {
  expect(deadlineParts('2026-09-16T10:00:00.000Z')).toStrictEqual({ deadlineDate: '2026-09-16', deadlineTime: '17:00' })
  // 00:30 ngày 17/09 giờ Việt Nam còn là ngày 16/09 theo UTC
  expect(deadlineParts('2026-09-16T17:30:00.000Z')).toStrictEqual({ deadlineDate: '2026-09-17', deadlineTime: '00:30' })
  expect(deadlineIso('2026-09-16', '17:00')).toBe('2026-09-16T10:00:00.000Z')
  expect(deadlineIso('2026-09-17', '00:30')).toBe('2026-09-16T17:30:00.000Z')
  expect([deadlineIso('', '17:00'), deadlineIso('2026-09-16', ''), deadlineIso('16/09/2026', '17:00'), deadlineIso('2026-13-40', '17:00')]).toStrictEqual([null, null, null, null])
})

test('a new form starts empty with a 17:00 deadline time; an edit form starts from the requirement', () => {
  expect(initialValues()).toStrictEqual({ destinationName: '', address: '', deadlineDate: '', deadlineTime: '17:00', priority: 'NORMAL', packageIds: [], note: '' })
  expect(initialValues(REQ_002)).toStrictEqual({
    destinationName: 'KCN Phú Bài', address: 'KCN Phú Bài, TX. Hương Thuỷ, Thừa Thiên Huế', deadlineDate: '2026-09-17', deadlineTime: '17:00', priority: 'HIGH',
    packageIds: ['PK-0057', 'PK-0058'], note: 'Hàng gốm, giao trong giờ hành chính',
  })
})

test('validation returns one code per field; the deadline must lie in the future unless it was left as it is', () => {
  expect(validateRequirement(VALID, NOW)).toStrictEqual({})
  expect(validateRequirement({ ...VALID, destinationName: '  ', address: '', packageIds: [], deadlineDate: '' }, NOW)).toStrictEqual({
    destinationName: 'required', address: 'required', packageIds: 'packagesRequired', deadlineDate: 'required',
  })
  expect(validateRequirement({ ...VALID, deadlineTime: '' }, NOW)).toStrictEqual({ deadlineTime: 'required' })
  expect(validateRequirement({ ...VALID, deadlineDate: '2026-13-40' }, NOW)).toStrictEqual({ deadlineDate: 'deadlineInvalid' })
  expect(validateRequirement({ ...VALID, destinationName: 'a'.repeat(121), address: 'b'.repeat(201), note: 'c'.repeat(301) }, NOW)).toStrictEqual({
    destinationName: 'tooLong', address: 'tooLong', note: 'tooLong',
  })
  // 12:00 ngày 14/09 là đúng "bây giờ": chưa ở tương lai; 12:01 thì được
  expect(validateRequirement({ ...VALID, deadlineDate: '2026-09-14', deadlineTime: '12:00' }, NOW)).toStrictEqual({ deadlineDate: 'deadlinePast' })
  expect(validateRequirement({ ...VALID, deadlineDate: '2026-09-14', deadlineTime: '12:01' }, NOW)).toStrictEqual({})
  // Sửa mà giữ nguyên hạn đã qua: không báo lỗi hạn
  const later = new Date('2026-09-20T00:00:00.000Z')
  expect(validateRequirement(initialValues(REQ_002), later, REQ_002)).toStrictEqual({})
  expect(validateRequirement({ ...initialValues(REQ_002), deadlineTime: '18:00' }, later, REQ_002)).toStrictEqual({ deadlineDate: 'deadlinePast' })
})

test('the input sent to the store is trimmed; while pending every field goes, and a new address drops the coordinates', () => {
  expect(toInput(VALID)).toStrictEqual({
    destinationName: 'Nhà hàng Hương Việt', address: '203 Lê Văn Sỹ, P. 13, Q.3', deadline: '2026-09-16T10:00:00.000Z', priority: 'NORMAL', packageIds: ['PK-0023'], note: '',
  })
  const same = toChanges(initialValues(REQ_002), REQ_002)
  expect(same).toStrictEqual({
    destinationName: 'KCN Phú Bài', address: 'KCN Phú Bài, TX. Hương Thuỷ, Thừa Thiên Huế', deadline: '2026-09-17T10:00:00.000Z', priority: 'HIGH',
    packageIds: ['PK-0057', 'PK-0058'], note: 'Hàng gốm, giao trong giờ hành chính',
  })
  expect(toChanges({ ...initialValues(REQ_002), address: 'Lô B2, KCN Phú Bài' }, REQ_002)).toMatchObject({ address: 'Lô B2, KCN Phú Bài', lat: null, lng: null })
})

test('once on a trip only the deadline and the priority are editable and sent', () => {
  const assigned: DeliveryRequirement = { ...REQ_002, status: 'ASSIGNED', tripId: 'TRIP-014' }
  expect(toChanges({ ...initialValues(assigned), address: 'Địa chỉ khác', deadlineTime: '09:30', priority: 'URGENT' }, assigned)).toStrictEqual({
    deadline: '2026-09-17T02:30:00.000Z', priority: 'URGENT',
  })
  const fields = ['destinationName', 'address', 'deadline', 'priority', 'packageIds', 'note'] as const
  expect(fields.filter((field) => isFieldEditable(field, 'ASSIGNED'))).toStrictEqual(['deadline', 'priority'])
  expect(fields.filter((field) => isFieldEditable(field, 'IN_TRIP'))).toStrictEqual(['deadline', 'priority'])
  expect(fields.filter((field) => isFieldEditable(field, 'PENDING'))).toStrictEqual([...fields])
  expect(fields.filter((field) => isFieldEditable(field))).toStrictEqual([...fields])
})
