import { expect, test } from 'vitest'
import { SPEC_TRUCK_6M } from '@/domain/fixtures/spec-samples'
import type { VehicleConfig } from '@/domain/models'
import type { VehicleState } from '@/lib/mock-db'
import { filterVehicleRows, statusFromSlug, vehicleRows, VEHICLE_STATUSES, VEHICLE_STATUS_SLUGS } from './vehicle-status'

/** Ba xe đủ ba trạng thái; chỉ tên và mã quan trọng cho tìm/lọc. */
function vehicle(id: string, name: string): VehicleConfig {
  return { ...SPEC_TRUCK_6M, id, name }
}

const VEHICLES = [
  vehicle('VEHICLE-001', 'Hyundai HD210 · 60C-446.32'),
  vehicle('VEHICLE-002', 'Isuzu NQR 550 · 51C-284.19'),
  vehicle('VEHICLE-003', 'Hino FC9J đông lạnh · 51C-190.07'),
]
const STATES: VehicleState[] = [
  { vehicleId: 'VEHICLE-002', status: 'in_use', tripId: 'TRIP-011' },
  { vehicleId: 'VEHICLE-003', status: 'maintenance', maintenance: { note: 'Thay má phanh', since: '2026-09-10T02:15:00.000Z' } },
]

test('rows join each vehicle with its state; a vehicle missing from the states is available', () => {
  const rows = vehicleRows(VEHICLES, STATES)
  expect(rows.map((row) => [row.id, row.state.status])).toStrictEqual([
    ['VEHICLE-001', 'available'],
    ['VEHICLE-002', 'in_use'],
    ['VEHICLE-003', 'maintenance'],
  ])
  expect(rows[1]!.state.tripId).toBe('TRIP-011')
})

test('the status filter reads the Vietnamese URL slug; an unknown slug filters nothing', () => {
  const rows = vehicleRows(VEHICLES, STATES)
  expect(VEHICLE_STATUS_SLUGS).toStrictEqual({ available: 'san-sang', in_use: 'dang-chay', maintenance: 'bao-duong', retired: 'ngung-su-dung' })
  expect(filterVehicleRows(rows, '', 'bao-duong').map((row) => row.id)).toStrictEqual(['VEHICLE-003'])
  expect(filterVehicleRows(rows, '', 'dang-chay').map((row) => row.id)).toStrictEqual(['VEHICLE-002'])
  expect(statusFromSlug('khong-co')).toBeNull()
  expect(filterVehicleRows(rows, '', 'khong-co')).toHaveLength(3)
  // Không xe nào ngừng sử dụng: lọc ra danh sách rỗng
  expect(filterVehicleRows(rows, '', 'ngung-su-dung')).toHaveLength(0)
  // Nguồn chỉ có ba trạng thái còn chạy: slug ngừng sử dụng là slug lạ, không lọc gì
  expect(statusFromSlug('ngung-su-dung', VEHICLE_STATUSES)).toBeNull()
})

test('the retired slug filters the retired vehicles', () => {
  const rows = vehicleRows(VEHICLES, [...STATES, { vehicleId: 'VEHICLE-001', status: 'retired' }])
  expect(statusFromSlug('ngung-su-dung')).toBe('retired')
  expect(filterVehicleRows(rows, '', 'ngung-su-dung').map((row) => row.id)).toStrictEqual(['VEHICLE-001'])
})

test('search ignores accents and matches the name, the plate, the code and the running trip', () => {
  const rows = vehicleRows(VEHICLES, STATES)
  expect(filterVehicleRows(rows, 'dong lanh', '').map((row) => row.id)).toStrictEqual(['VEHICLE-003'])
  expect(filterVehicleRows(rows, '446.32', '').map((row) => row.id)).toStrictEqual(['VEHICLE-001'])
  expect(filterVehicleRows(rows, 'vehicle-002', '').map((row) => row.id)).toStrictEqual(['VEHICLE-002'])
  expect(filterVehicleRows(rows, 'trip-011', '').map((row) => row.id)).toStrictEqual(['VEHICLE-002'])
  expect(filterVehicleRows(rows, 'hino', 'san-sang')).toHaveLength(0)
})
