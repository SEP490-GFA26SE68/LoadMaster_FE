import { expect, test } from 'vitest'
import type { RequirementDraft } from './requirement-draft-api'
import { draftToFormValues } from './requirement-draft'

/** Vitest chạy ở giờ Việt Nam (`vitest.config.ts`), cùng múi với hạn của máy chủ. */
const EMPTY: RequirementDraft = {
  destinationText: null, deadline: null, priority: null, expectedPackageCount: null, note: null, customerNameGuess: null,
  packages: [], missing: ['destinationText', 'deadline', 'priority', 'expectedPackageCount'],
}

test('a full draft fills destination, deadline, priority, package count and note — 15:00 on 25/11 Vietnam time', () => {
  const values = draftToFormValues({
    ...EMPTY,
    destinationText: 'Co.opmart Biên Hoà, 121 Phạm Văn Thuận, Biên Hoà',
    // 15:00 ngày 25/11/2026 giờ Việt Nam = 08:00 UTC
    deadline: '2026-11-25T08:00:00.000Z',
    priority: 'URGENT',
    expectedPackageCount: 122,
    note: 'Gọi chị Lan 0909 123 456 trước khi tới.',
    customerNameGuess: 'Nước Suối An Phú',
    packages: [{ description: 'thùng nước suối', quantity: 120, lengthCm: 40, widthCm: 30, heightCm: 25, weightKg: 12 }],
    missing: [],
  })

  expect(values).toStrictEqual({
    destinationName: 'Co.opmart Biên Hoà, 121 Phạm Văn Thuận, Biên Hoà',
    address: 'Co.opmart Biên Hoà, 121 Phạm Văn Thuận, Biên Hoà',
    deadlineDate: '2026-11-25',
    deadlineTime: '15:00',
    priority: 'URGENT',
    expectedPackageCount: '122',
    note: 'Gọi chị Lan 0909 123 456 trước khi tới.',
  })
})

test('fields the draft leaves empty are not in the result, so the form keeps what it has', () => {
  expect(draftToFormValues(EMPTY)).toStrictEqual({})
  expect(draftToFormValues({ ...EMPTY, priority: 'LOW' })).toStrictEqual({ priority: 'LOW' })
})

test('customer, packages and coordinates are never part of the result', () => {
  const keys = Object.keys(draftToFormValues({
    ...EMPTY, destinationText: 'Kho Tân Vạn', deadline: '2026-11-25T08:00:00.000Z', priority: 'HIGH', expectedPackageCount: 3,
    note: 'Cổng sau', customerNameGuess: 'An Phú', packages: [{ description: 'pallet', quantity: 3, lengthCm: null, widthCm: null, heightCm: null, weightKg: null }],
  }))

  expect(keys).not.toContain('customerId')
  expect(keys).not.toContain('packageIds')
  expect(keys).not.toContain('coordinates')
})

test('a destination longer than the name field is cut for the name only, without splitting a character', () => {
  const destination = `${'a'.repeat(119)}😀 và phần còn lại của địa chỉ`
  const values = draftToFormValues({ ...EMPTY, destinationText: destination })

  expect(values.destinationName).toBe('a'.repeat(119))
  expect(values.address).toBe(destination)
})
