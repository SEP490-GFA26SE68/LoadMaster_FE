import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { getMockDb } from '@/lib/mock-db'
import { envelope, page, stubBackend } from '@/test/fake-backend'
import { changeTripVehicle, fetchVehicleChoices } from './trip-vehicle-api'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'mock', apiUrl: 'http://be.test', features: new Set(['trips']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'trips',
}))

/** Đổi xe khi nhóm `trips` nối backend: danh sách xe kèm lý do đọc từ máy chủ, đổi xe là `PATCH /api/trips/{id}` với mã số xe. */
const CODE = 'TRIP-20261019-7F3A'
const TRIP_ROW = { id: 42, tripCode: CODE, tripName: 'Biên Hoà – Dĩ An', status: 'PLANNED' }
const config = (vehicleId: number, name: string, maxPayloadKg: number) => ({
  vehicleId, vehicleName: name, licensePlate: '51C-284.19', innerLength: 600, innerWidth: 240, innerHeight: 240,
  doorWidth: 230, doorHeight: 230, maxPayloadKg, obstacles: [],
})

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('xe chọn được, xe đang chạy chuyến khác và xe quá tải đọc đúng lý do của máy chủ', async () => {
  const { calls } = stubBackend({
    'GET /api/trips': { body: envelope(page([TRIP_ROW])) },
    'GET /api/trips/42/vehicle-choices': {
      body: envelope({
        cargo: { count: 3, totalKg: 800, totalCm3: 3000000 },
        choices: [
          { vehicle: config(7, 'Xe E', 5000), status: 'AVAILABLE', current: false, busyTripCode: null, selectable: true, issues: [] },
          { vehicle: config(4, 'Xe B', 5000), status: 'AVAILABLE', current: false, busyTripCode: 'TRIP-011', selectable: false, issues: [] },
          {
            vehicle: config(5, 'Xe C', 500), status: 'AVAILABLE', current: false, busyTripCode: null, selectable: false,
            issues: [{ code: 'CARGO_WEIGHT_EXCEEDED', severity: 'error', params: { totalKg: 800, maxPayloadKg: 500, overKg: 300 } }],
          },
          { vehicle: config(6, 'Xe D', 5000), status: 'MAINTENANCE', current: false, busyTripCode: null, selectable: false, issues: [] },
        ],
      }),
    },
  })

  const result = await fetchVehicleChoices(CODE)

  expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual(['GET /api/trips', 'GET /api/trips/42/vehicle-choices'])
  expect(result.cargo).toEqual({ count: 3, totalKg: 800, totalCm3: 3000000 })
  expect(result.choices.map((choice) => [choice.vehicle.id, choice.status, choice.selectable])).toEqual([
    ['7', 'available', true], ['4', 'in_use', false], ['5', 'available', false], ['6', 'maintenance', false],
  ])
  expect(result.choices[1]?.busyTripId).toBe('TRIP-011')
  expect(result.choices[2]?.fit).toEqual({
    fits: false,
    issues: [{ code: 'CARGO_WEIGHT_EXCEEDED', severity: 'error', params: { totalKg: 800, maxPayloadKg: 500, overKg: 300 } }],
  })
})

test('đổi xe gửi PATCH với mã số xe, không ghi kho mẫu', async () => {
  const write = vi.spyOn(getMockDb(), 'changeTripVehicle')
  const { calls } = stubBackend({
    'GET /api/trips': { body: envelope(page([TRIP_ROW])) },
    'PATCH /api/trips/42': { body: envelope({ id: 42 }) },
  })

  await changeTripVehicle(CODE, '7')

  expect(calls.at(-1)).toMatchObject({ method: 'PATCH', path: '/api/trips/42', body: { vehicleId: 7 } })
  expect(write).not.toHaveBeenCalled()
})

test('máy chủ từ chối xe không chở được hàng: lỗi mang mã của máy chủ', async () => {
  stubBackend({
    'GET /api/trips': { body: envelope(page([TRIP_ROW])) },
    'PATCH /api/trips/42': { status: 400, body: { success: false, code: 'VEHICLE_CANNOT_CARRY_CARGO', message: 'x' } },
  })

  await expect(changeTripVehicle(CODE, '5')).rejects.toMatchObject({ code: 'VEHICLE_CANNOT_CARRY_CARGO' })
})
