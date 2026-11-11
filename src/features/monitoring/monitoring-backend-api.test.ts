import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth, isApiError } from '@/lib/api-client'
import { envelope, page, stubBackend } from '@/test/fake-backend'
import {
  confirmReroute,
  escalateTripException,
  listRenegotiableRequirements,
  renegotiateDeadline,
  reportTripException,
  requestReroute,
  resolveTripException,
} from './exceptions-api'
import { fetchMonitoringBoard, getLatestLocation, getLocationHistory, listTripMonitoring, reorderRunningStops } from './monitoring-api'
import { reportDriverException } from './monitoring-backend-api'
import { MONITORING_CAPABILITIES } from './monitoring-capabilities'

/**
 * Màn Giám sát nối backend (`usesBackend('monitoring')`): mỗi hàm gọi đúng endpoint của `MonitoringController`, đổi DTO sang kiểu của
 * màn; lỗi chưa kèm mã đọc theo mã HTTP. Giờ không múi giờ của backend là giờ Việt Nam.
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['monitoring']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'monitoring',
}))

const TRIP = 'TRIP-20261018-0A1B2C3D'
const fail = (status: number) => ({ status, body: { success: false, message: 'lỗi' } })

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function codeOf(promise: Promise<unknown>): Promise<string> {
  const error: unknown = await promise.then(() => null, (reason: unknown) => reason)
  return isApiError(error) ? error.code : 'NO_ERROR'
}

test('nguồn backend: màn ẩn liên kết chuyến, đổi thứ tự điểm, gia hạn, nhận dọc đường, xác nhận tay; chuyển quản lý có', () => {
  expect(MONITORING_CAPABILITIES).toEqual({
    backend: true, openTrip: false, reorderStops: true, escalation: true, pickups: false, manualConfirm: false,
  })
})

test('bảng giám sát: tên trùng mã chuyến bỏ đi, kho toạ độ 0, 0 coi như không có, mã điểm thành chuỗi', async () => {
  const { calls } = stubBackend({
    'GET /api/dispatcher/dashboard': {
      body: envelope({
        trips: [{
          tripId: TRIP, name: TRIP, vehicleName: '51C-284.19', driverName: 'Trần Văn Hùng', depot: { name: 'Kho', lat: 0, lng: 0 },
          stops: [{ id: 7, number: 1, name: 'Co.opmart Biên Hoà', lat: 10.95, lng: 106.82, arrivedAt: '2026-10-18T09:00:00' }],
        }],
        userNames: { '4': 'Lê Thị Mai' },
      }),
    },
  })
  const board = await fetchMonitoringBoard()
  expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual(['GET /api/dispatcher/dashboard'])
  expect(board).toEqual({
    trips: [{
      tripId: TRIP, name: '', vehicleName: '51C-284.19', driverName: 'Trần Văn Hùng',
      stops: [{ id: '7', number: 1, name: 'Co.opmart Biên Hoà', lat: 10.95, lng: 106.82, arrivedAt: '2026-10-18T02:00:00.000Z' }],
    }],
    userNames: { '4': 'Lê Thị Mai' },
  })
})

test('giám sát các chuyến: giờ đến của máy chủ không phải mock, cảnh báo thiếu điểm bị bỏ, nhịp đọc lại ít nhất 1 giây', async () => {
  stubBackend({
    'GET /api/trips/monitoring': {
      body: envelope([{
        tripId: TRIP,
        location: { lat: 10.9, lng: 106.8, speedKmh: 41.6, heading: -90, recordedAt: '2026-10-18T09:05:00', source: 'GPS' },
        stops: [{ stopId: 8, number: 2, eta: '2026-10-18T10:00:00', deadline: '2026-10-18T10:10:00', deadlineStatus: 'AT_RISK', arrived: true }],
        alerts: [
          { eventId: 'ETA-1', at: '2026-10-18T09:05:00', tripId: TRIP, stopId: 8, stopNumber: 2, status: 'AT_RISK', eta: '2026-10-18T10:00:00', deadline: '2026-10-18T10:10:00' },
          { eventId: 'ETA-2', at: '2026-10-18T09:05:00', tripId: TRIP, stopId: null, stopNumber: null, status: 'AT_RISK', eta: '2026-10-18T10:00:00', deadline: '2026-10-18T10:10:00' },
        ],
        exceptions: [],
        refreshMs: 500,
        isMockResult: false,
      }]),
    },
  })
  const [live] = await listTripMonitoring()
  expect(live?.isMockResult).toBe(false)
  expect(live?.refreshMs).toBe(1000)
  expect(live?.location).toEqual({ lat: 10.9, lng: 106.8, speedKmh: 42, heading: 270, recordedAt: '2026-10-18T02:05:00.000Z', source: 'GPS' })
  expect(live?.stops).toEqual([{ stopId: '8', number: 2, eta: '2026-10-18T03:00:00.000Z', deadline: '2026-10-18T03:10:00.000Z', deadlineStatus: 'AT_RISK' }])
  expect(live?.alerts.map((alert) => alert.eventId)).toEqual(['ETA-1'])
})

test('vị trí mới nhất và lịch sử vị trí đọc theo mã chuyến', async () => {
  const point = { lat: 10.9, lng: 106.8, recordedAt: '2026-10-18T09:05:00Z' }
  const { calls } = stubBackend({
    [`GET /api/trips/${TRIP}/location/latest`]: { body: envelope(null) },
    [`GET /api/trips/${TRIP}/location/history`]: { body: envelope([point]) },
  })
  expect(await getLatestLocation(TRIP)).toBeNull()
  expect(await getLocationHistory(TRIP)).toEqual([{ lat: 10.9, lng: 106.8, speedKmh: 0, heading: 0, recordedAt: '2026-10-18T09:05:00.000Z', source: 'GPS' }])
  expect(calls).toHaveLength(2)
})

test('báo sự cố từ bảng giám sát gửi loại, mô tả, số phút; 400 là chuyến không còn đang vận chuyển', async () => {
  const exception = { id: '31', tripId: TRIP, type: 'TRAFFIC', description: 'Kẹt xe cầu Đồng Nai', delayMinutes: 25, status: 'OPEN', reportedAt: '2026-10-18T09:10:00' }
  const { calls } = stubBackend({ [`POST /api/trips/${TRIP}/exceptions`]: { body: envelope(exception) } })
  const saved = await reportTripException(TRIP, { type: 'TRAFFIC', description: 'Kẹt xe cầu Đồng Nai', delayMinutes: 25 })
  expect(calls[0]?.body).toEqual({ type: 'TRAFFIC', description: 'Kẹt xe cầu Đồng Nai', delayMinutes: 25 })
  expect(saved).toMatchObject({ id: '31', status: 'OPEN', reportedAt: '2026-10-18T02:10:00.000Z', reportedBy: null })

  stubBackend({ [`POST /api/trips/${TRIP}/exceptions`]: fail(400) })
  expect(await codeOf(reportTripException(TRIP, { type: 'TRAFFIC', description: 'Kẹt xe', delayMinutes: 5 }))).toBe('GPS_TRIP_NOT_IN_TRANSIT')
})

test('đánh dấu đã xử lý gửi ghi chú; 404 là sự cố không còn', async () => {
  const resolved = {
    id: '31', tripId: TRIP, type: 'ACCIDENT', status: 'RESOLVED', reportedAt: '2026-10-18T09:10:00',
    resolution: { at: '2026-10-18T09:40:00', by: '4', note: 'Đã qua' },
  }
  const { calls } = stubBackend({ [`POST /api/trips/${TRIP}/exceptions/31/resolve`]: { body: envelope(resolved) } })
  expect(await resolveTripException(TRIP, '31', 'Đã qua')).toMatchObject({ status: 'RESOLVED', resolution: { at: '2026-10-18T02:40:00.000Z', by: '4', note: 'Đã qua' } })
  expect(calls[0]?.body).toEqual({ note: 'Đã qua' })

  stubBackend({ [`POST /api/trips/${TRIP}/exceptions/31/resolve`]: fail(404) })
  expect(await codeOf(resolveTripException(TRIP, '31'))).toBe('TRIP_EXCEPTION_NOT_FOUND')
})

test('chuyển quản lý: không thân; 404 là sự cố không còn, 409 là sự cố đã chuyển hoặc đã xử lý', async () => {
  const escalated = {
    id: '31', tripId: TRIP, type: 'TRAFFIC', status: 'ESCALATED', reportedAt: '2026-10-18T09:10:00',
    escalation: { reason: 'NO_ROUTE', at: '2026-10-18T09:20:00', by: '4' },
  }
  const { calls } = stubBackend({ [`POST /api/trips/${TRIP}/exceptions/31/escalate`]: { body: envelope(escalated) } })
  expect(await escalateTripException(TRIP, '31')).toMatchObject({ status: 'ESCALATED', escalation: { reason: 'NO_ROUTE', at: '2026-10-18T02:20:00.000Z', by: '4' } })
  expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual([`POST /api/trips/${TRIP}/exceptions/31/escalate`])

  stubBackend({ [`POST /api/trips/${TRIP}/exceptions/31/escalate`]: fail(404), [`POST /api/trips/${TRIP}/exceptions/32/escalate`]: fail(409) })
  expect(await codeOf(escalateTripException(TRIP, '31'))).toBe('TRIP_EXCEPTION_NOT_FOUND')
  expect(await codeOf(escalateTripException(TRIP, '32'))).toBe('CONFLICT')
})

test('tài xế báo sự cố qua endpoint của tài xế theo mã số chuyến; 400 là chuyến không còn đang vận chuyển', async () => {
  const exception = { id: '40', tripId: '1', type: 'VEHICLE_BREAKDOWN', description: 'Xịt lốp', delayMinutes: 40, status: 'OPEN', reportedAt: '2026-10-18T09:30:00' }
  const { calls } = stubBackend({ 'POST /api/driver/trips/1/exceptions': { body: envelope(exception) } })
  expect(await reportDriverException('1', { type: 'VEHICLE_BREAKDOWN', description: 'Xịt lốp', delayMinutes: 40 })).toMatchObject({ id: '40', status: 'OPEN', delayMinutes: 40 })
  expect(calls[0]?.body).toEqual({ type: 'VEHICLE_BREAKDOWN', description: 'Xịt lốp', delayMinutes: 40 })

  stubBackend({ 'POST /api/driver/trips/1/exceptions': fail(400) })
  expect(await codeOf(reportDriverException('1', { type: 'OTHER', description: 'Khác', delayMinutes: 0 }))).toBe('GPS_TRIP_NOT_IN_TRANSIT')
})

test('loại sự cố ngoài hợp đồng là lỗi của máy chủ', async () => {
  stubBackend({ [`POST /api/trips/${TRIP}/exceptions/31/resolve`]: { body: envelope({ id: '31', type: 'FLOOD', status: 'RESOLVED', reportedAt: '2026-10-18T09:10:00' }) } })
  expect(await codeOf(resolveTripException(TRIP, '31'))).toBe('SERVER_ERROR')
})

test('tuyến khác: lựa chọn của máy chủ, chọn một tuyến; 404 là không còn điểm chờ giao, 400 là lựa chọn không còn hợp lệ', async () => {
  const option = { index: 0, route: 'BYPASS', distanceKm: 12.4, durationMinutes: 21, extraMs: 180000, eta: '2026-10-18T10:05:00' }
  stubBackend({
    [`POST /api/trips/${TRIP}/reroute`]: { body: envelope({ tripId: TRIP, requestedAt: '2026-10-18T09:15:00', stopId: 8, stopNumber: 2, options: [option], isMockResult: false }) },
    [`POST /api/trips/${TRIP}/reroute/0/confirm`]: { body: envelope({ ...option, stopNumber: 2, confirmedAt: '2026-10-18T09:16:00', confirmedBy: '4' }) },
  })
  const proposal = await requestReroute(TRIP)
  expect(proposal).toMatchObject({ stopId: '8', stopNumber: 2, isMockResult: false })
  expect(proposal.options).toEqual([{ index: 0, route: 'BYPASS', distanceKm: 12.4, durationMinutes: 21, extraMs: 180000, eta: '2026-10-18T03:05:00.000Z' }])
  expect(await confirmReroute(TRIP, 0)).toMatchObject({ route: 'BYPASS', stopNumber: 2, confirmedAt: '2026-10-18T02:16:00.000Z', confirmedBy: '4' })

  stubBackend({ [`POST /api/trips/${TRIP}/reroute`]: fail(404), [`POST /api/trips/${TRIP}/reroute/3/confirm`]: fail(400) })
  expect(await codeOf(requestReroute(TRIP))).toBe('NO_PENDING_DELIVERY_STOP')
  expect(await codeOf(confirmReroute(TRIP, 3))).toBe('INVALID_REROUTE_INDEX')
})

test('yêu cầu giao gia hạn được: dòng của chuyến (mã chuyến), điểm giao chưa hoàn tất của nó theo chi tiết chuyến', async () => {
  const { calls } = stubBackend({
    'GET /api/delivery-requirements': {
      body: envelope(page([
        { id: 40, customerName: 'Co.opmart', destination: '121 Phạm Văn Thuận', deadline: '2026-10-18T09:30:00', tripId: 55, tripCode: TRIP },
        { id: 41, customerName: 'Bách Hoá Xanh', destination: '215 Quốc lộ 1K', deadline: '2026-10-18T10:30:00', tripId: 55, tripCode: TRIP },
        { id: 42, customerName: 'Khác', destination: 'x', deadline: '2026-10-18T11:00:00', tripId: 56, tripCode: 'TRIP-KHAC' },
      ])),
    },
    'GET /api/trips/55/detail': {
      body: envelope({
        trip: { id: 55 },
        stops: [
          { id: 7, deliveryRequirementId: 40, stopSequence: 1, stopName: 'Co.opmart Biên Hoà', status: 'COMPLETED' },
          { id: 8, deliveryRequirementId: 41, stopSequence: 2, stopName: 'Bách Hoá Xanh Dĩ An', status: 'PENDING' },
        ],
      }),
    },
  })
  // Điểm 1 đã giao xong nên yêu cầu 40 không gia hạn được; yêu cầu 42 thuộc chuyến khác
  expect(await listRenegotiableRequirements(TRIP)).toEqual([
    { id: '41', destinationName: 'Bách Hoá Xanh Dĩ An', deadline: '2026-10-18T03:30:00.000Z', stopNumber: 2 },
  ])
  expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual(['GET /api/delivery-requirements', 'GET /api/trips/55/detail'])

  // Chuyến không có yêu cầu giao nào: không đọc chi tiết chuyến
  const empty = stubBackend({ 'GET /api/delivery-requirements': { body: envelope(page([])) } })
  expect(await listRenegotiableRequirements(TRIP)).toEqual([])
  expect(empty.calls).toHaveLength(1)
})

test('gia hạn: hạn mới gửi theo giờ Việt Nam không múi giờ, mã số yêu cầu; máy chủ từ chối thì giữ mã', async () => {
  const escalated = { id: '31', tripId: TRIP, type: 'TRAFFIC', delayMinutes: 25, status: 'ESCALATED', reportedAt: '2026-10-18T09:10:00', escalation: { reason: 'NO_ROUTE', at: '2026-10-18T09:15:00', by: '4' } }
  const { calls } = stubBackend({ [`POST /api/trips/${TRIP}/exceptions/31/renegotiate`]: { body: envelope(escalated) } })
  const input = { requirementId: '41', deadline: '2026-10-18T10:00:00.000Z', contactNote: 'Khách đồng ý nhận chiều nay' }
  expect(await renegotiateDeadline(TRIP, '31', input)).toMatchObject({ id: '31', status: 'ESCALATED' })
  expect(calls[0]?.body).toEqual({ requirementId: 41, newDeadline: '2026-10-18T17:00:00', contactNote: 'Khách đồng ý nhận chiều nay' })

  for (const code of ['CONTACT_NOTE_REQUIRED', 'REQUIREMENT_DEADLINE_PAST', 'EXCEPTION_STATUS_INVALID', 'DELIVERY_REQUIREMENT_NOT_IN_TRIP']) {
    stubBackend({ [`POST /api/trips/${TRIP}/exceptions/31/renegotiate`]: { status: 400, body: { success: false, code, message: 'x' } } })
    expect(await codeOf(renegotiateDeadline(TRIP, '31', input))).toBe(code)
  }
  // Mã yêu cầu không phải mã số của máy chủ: không gọi mạng
  const none = stubBackend({})
  expect(await codeOf(renegotiateDeadline(TRIP, '31', { ...input, requirementId: 'REQ-001' }))).toBe('DELIVERY_REQUIREMENT_NOT_FOUND')
  expect(none.calls).toEqual([])
})

test('đổi thứ tự điểm gửi mã số điểm của máy chủ; kiện bị che một phần là cảnh báo, che kín là lỗi cùng dạng kho mẫu', async () => {
  const { calls } = stubBackend({
    [`POST /api/trips/${TRIP}/stops/reorder`]: {
      body: envelope({ tripId: 7, tripCode: TRIP, stops: [{ stopId: 9, sequence: 2 }, { stopId: 8, sequence: 3 }], partial: [{ packageCode: 'PK-0012', stopId: 8 }] }),
    },
  })
  expect(await reorderRunningStops(TRIP, ['9', '8'])).toEqual({ partial: [{ packageId: 'PK-0012', stopId: '8' }] })
  expect(calls[0]?.body).toEqual({ stopIds: [9, 8] })

  const details = { packages: ['PK-0012', 'PK-0013'], stopIds: ['8', '9'] }
  stubBackend({ [`POST /api/trips/${TRIP}/stops/reorder`]: { status: 409, body: { success: false, code: 'STOP_ORDER_BLOCKS_CARGO', message: 'x', errors: details } } })
  const error: unknown = await reorderRunningStops(TRIP, ['9', '8']).then(() => null, (reason: unknown) => reason)
  expect(isApiError(error) && { code: error.code, params: error.params }).toEqual({ code: 'STOP_ORDER_BLOCKS_CARGO', params: details })
  for (const code of ['TRIP_NOT_IN_TRANSIT', 'STOP_NOT_MOVABLE', 'PICKUP_AFTER_DELIVERY']) {
    stubBackend({ [`POST /api/trips/${TRIP}/stops/reorder`]: { status: 409, body: { success: false, code, message: 'x' } } })
    expect(await codeOf(reorderRunningStops(TRIP, ['9', '8']))).toBe(code)
  }
})
