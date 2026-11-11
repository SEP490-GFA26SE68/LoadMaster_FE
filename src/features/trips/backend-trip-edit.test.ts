import { expect, test } from 'vitest'
import { backendTripChanges, backendTripFormDefaults, isBackendTripEditable } from './backend-trip-edit'
import type { TripDetailApiResponse } from './trips-api'

const TRIP: TripDetailApiResponse = {
  id: 42, tripCode: 'TRIP-2026-0042', tripName: 'Tân Bình – Quận 7', companyId: 1, vehicleId: 11, vehicleName: 'Hino 500',
  licensePlate: '51C-123.45', driverId: 7, driverName: 'Trần Văn Tài', createdByDispatcherId: 3, departureTime: '2026-11-12 08:30:00',
  originName: 'Kho Tân Bình', originAddress: '12 Cộng Hoà, Tân Bình', originLatitude: 10.8012, originLongitude: 106.6521,
  status: 'PLANNED', createdAt: '2026-11-10T09:00:00',
}

test('chỉ chuyến Nháp và Đã lập kế hoạch mở form sửa', () => {
  expect(['DRAFT', 'PLANNED', 'LOADING', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'].filter((status) =>
    isBackendTripEditable(status as TripDetailApiResponse['status']))).toEqual(['DRAFT', 'PLANNED'])
})

test('giá trị ban đầu đọc thẳng ngày, giờ giờ Việt Nam và kho xuất phát của máy chủ', () => {
  expect(backendTripFormDefaults(TRIP)).toEqual({
    name: 'Tân Bình – Quận 7', scheduledDate: '2026-11-12', departureTime: '08:30', vehicleId: '11', driverId: '7',
    depot: { name: 'Kho Tân Bình', address: '12 Cộng Hoà, Tân Bình', coordinates: { lat: '10.8012', lng: '106.6521' } }, stops: [],
  })
  expect(backendTripFormDefaults({ ...TRIP, driverId: null, departureTime: '2026-11-12T17:05:00' })).toMatchObject({ driverId: 'none', departureTime: '17:05' })
})

test('kho xuất phát máy chủ chưa có toạ độ: giữ tên, địa chỉ, toạ độ để trống', () => {
  const values = backendTripFormDefaults({ ...TRIP, originLatitude: null as unknown as number, originAddress: null })
  expect(values.depot).toEqual({ name: 'Kho Tân Bình', address: '', coordinates: { lat: '', lng: '' } })
})

test('chỉ gửi trường đã đổi; không đổi gì là null', () => {
  const initial = backendTripFormDefaults(TRIP)
  expect(backendTripChanges(initial, initial, '')).toBeNull()
  expect(backendTripChanges(initial, { ...initial, name: '  Tân Bình – Quận 7 ' }, '')).toBeNull()
  expect(backendTripChanges(initial, { ...initial, name: ' Chuyến mới ', driverId: 'none' }, '')).toEqual({ name: 'Chuyến mới', driverId: null })
  expect(backendTripChanges(initial, { ...initial, vehicleId: '12' }, '5')).toEqual({ vehicleId: '12', originWarehouseId: '5' })
})

test('đổi giờ xuất phát gửi mốc giờ Việt Nam', () => {
  const initial = backendTripFormDefaults(TRIP)
  const changes = backendTripChanges(initial, { ...initial, departureTime: '09:15' }, '')
  expect(Object.keys(changes ?? {})).toEqual(['departureAt'])
  expect(new Date(changes?.departureAt ?? '').toISOString()).toBe('2026-11-12T02:15:00.000Z')
})
