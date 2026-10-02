import { expect, test } from 'vitest'
import { addedConflicts, OVERRIDE_REASON_MAX_LENGTH, segregation } from '@/domain/constraints'
import type { HandlingClass } from '@/domain/models'

const line = (id: string, quantity: number, handlingClass?: HandlingClass) => ({ id, quantity, ...(handlingClass ? { handlingClass } : {}) })

const PLAIN_VEHICLE = { obstacles: [] }
const COOLED_VEHICLE = { obstacles: [{ type: 'COOLING_UNIT' as const }] }

test('chuyến rỗng chưa khoá loại hàng nào', () => {
  expect(segregation([], PLAIN_VEHICLE)).toStrictEqual({ lockedClass: null, groups: [], conflicts: [], vehicleWarnings: [] })
})

test('loại của kiện đầu tiên khoá chuyến; dòng không ghi loại hàng là hàng thường', () => {
  const result = segregation([line('PKG-001', 4), line('PKG-002', 2, 'STANDARD')], PLAIN_VEHICLE)
  expect(result).toStrictEqual({
    lockedClass: 'STANDARD',
    groups: [{ handlingClass: 'STANDARD', packageIds: ['PKG-001', 'PKG-002'], count: 6 }],
    conflicts: [],
    vehicleWarnings: [],
  })
})

test('mọi dòng khác loại đang khoá là xung đột; nhóm theo thứ tự loại xuất hiện', () => {
  const result = segregation(
    [line('PKG-001', 3, 'FRAGILE'), line('PKG-002', 5), line('PKG-003', 1, 'FRAGILE'), line('PKG-004', 2, 'HIGH_VALUE')],
    PLAIN_VEHICLE,
  )
  expect(result.lockedClass).toBe('FRAGILE')
  expect(result.groups).toStrictEqual([
    { handlingClass: 'FRAGILE', packageIds: ['PKG-001', 'PKG-003'], count: 4 },
    { handlingClass: 'STANDARD', packageIds: ['PKG-002'], count: 5 },
    { handlingClass: 'HIGH_VALUE', packageIds: ['PKG-004'], count: 2 },
  ])
  expect(result.conflicts).toStrictEqual([
    { packageId: 'PKG-002', handlingClass: 'STANDARD', count: 5 },
    { packageId: 'PKG-004', handlingClass: 'HIGH_VALUE', count: 2 },
  ])
})

test('khoá tính lại theo kiện đầu tiên còn lại', () => {
  const lines = [line('PKG-001', 1, 'FRAGILE'), line('PKG-002', 5)]
  expect(segregation(lines, PLAIN_VEHICLE).lockedClass).toBe('FRAGILE')
  expect(segregation(lines.slice(1), PLAIN_VEHICLE)).toMatchObject({ lockedClass: 'STANDARD', conflicts: [] })
})

test('hàng nguy hiểm luôn cảnh báo xe', () => {
  for (const vehicle of [PLAIN_VEHICLE, COOLED_VEHICLE, undefined]) {
    expect(segregation([line('PKG-001', 7, 'HAZARDOUS')], vehicle).vehicleWarnings).toStrictEqual([
      { code: 'HAZARDOUS_VEHICLE_REQUIRED', severity: 'warning', params: { count: 7 } },
    ])
  }
})

test('hàng lạnh cảnh báo khi xe không có thiết bị làm lạnh', () => {
  const lines = [line('PKG-001', 2, 'REFRIGERATED'), line('PKG-002', 3, 'REFRIGERATED')]
  expect(segregation(lines, PLAIN_VEHICLE).vehicleWarnings).toStrictEqual([{ code: 'REFRIGERATION_MISSING', severity: 'warning', params: { count: 5 } }])
  expect(segregation(lines, undefined).vehicleWarnings).toStrictEqual([{ code: 'REFRIGERATION_MISSING', severity: 'warning', params: { count: 5 } }])
  expect(segregation(lines, COOLED_VEHICLE).vehicleWarnings).toStrictEqual([])
})

test('cảnh báo xe tính cả kiện đang xung đột', () => {
  const result = segregation([line('PKG-001', 1), line('PKG-002', 2, 'HAZARDOUS'), line('PKG-003', 4, 'REFRIGERATED')], PLAIN_VEHICLE)
  expect(result.vehicleWarnings.map((warning) => [warning.code, warning.params.count])).toStrictEqual([
    ['HAZARDOUS_VEHICLE_REQUIRED', 2],
    ['REFRIGERATION_MISSING', 4],
  ])
})

test('xung đột mới: dòng khác loại vừa thêm, hoặc dòng vừa đổi loại', () => {
  const before = [line('PKG-001', 2), line('PKG-002', 1, 'FRAGILE')]
  expect(addedConflicts(before, before)).toStrictEqual([])
  expect(addedConflicts(before, [...before, line('PKG-003', 4, 'FRAGILE'), line('PKG-004', 1)])).toStrictEqual([
    { packageId: 'PKG-003', handlingClass: 'FRAGILE', count: 4 },
  ])
  expect(addedConflicts(before, [line('PKG-001', 2), line('PKG-002', 1, 'HAZARDOUS')])).toStrictEqual([
    { packageId: 'PKG-002', handlingClass: 'HAZARDOUS', count: 1 },
  ])
  // Chuyến rỗng nhận một lô nhiều loại: loại của kiện đầu khoá, phần còn lại là xung đột mới
  expect(addedConflicts([], [line('PKG-001', 2, 'HIGH_VALUE'), line('PKG-002', 3)])).toStrictEqual([
    { packageId: 'PKG-002', handlingClass: 'STANDARD', count: 3 },
  ])
})

test('bỏ dòng đầu làm khoá đổi: dòng cũ thành xung đột cũng là xung đột mới', () => {
  const before = [line('PKG-001', 2), line('PKG-002', 1, 'FRAGILE'), line('PKG-003', 1)]
  expect(addedConflicts(before, before.slice(1))).toStrictEqual([{ packageId: 'PKG-003', handlingClass: 'STANDARD', count: 1 }])
})

test('lý do vượt luật dài tối đa 500 ký tự', () => {
  expect(OVERRIDE_REASON_MAX_LENGTH).toBe(500)
})
