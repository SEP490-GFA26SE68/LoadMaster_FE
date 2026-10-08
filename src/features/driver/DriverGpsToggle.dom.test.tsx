import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { getMockDb } from '@/lib/mock-db'
import { twoCartonRequest, twoCartonResult, twoCartonTrip } from '@/test/mock-db-samples'
import { loadTrip } from '@/test/trip-flow'
import { LOAD, renderDriver } from './driver-test-utils'
import { GPS_SEND_INTERVAL_MS, locationInput } from './useDeviceLocation'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() } }))

/**
 * "Dùng GPS thật" trên màn điểm giao (FE-6-13): `navigator.geolocation` giả, còn lại là kho dùng chung → `monitoring-api.ts` → hook →
 * màn. Nhịp 30 giây không chờ thật: hàm của `setInterval` 30 giây được giữ lại và gọi tay.
 */
const SWITCH = { name: 'Dùng GPS thật' }
let sharedTrip: Promise<string> | undefined

/** Một chuyến hai thùng của tài xế demo đang vận chuyển, dùng chung cho cả file (điểm giao không có toạ độ: chỉ có điểm GPS thật). */
function deliveringTrip(): Promise<string> {
  sharedTrip ??= (async () => {
    const db = getMockDb()
    const trip = await db.createTrip({ ...twoCartonTrip(), driverId: 'US-0004' })
    const revision = await db.addRevision({ tripId: trip.id, request: twoCartonRequest(), result: twoCartonResult() })
    await db.approveRevision(revision.id, [])
    await loadTrip(db, trip.id)
    await db.startDelivery(trip.id)
    return trip.id
  })()
  return sharedTrip
}

function mockGeolocation() {
  const watches = new Map<number, { success: PositionCallback; error: PositionErrorCallback | null | undefined }>()
  let nextId = 1
  const geolocation = {
    watchPosition: vi.fn((success: PositionCallback, error?: PositionErrorCallback | null) => {
      watches.set(nextId, { success, error })
      return nextId++
    }),
    clearWatch: vi.fn((id: number) => void watches.delete(id)),
    getCurrentPosition: vi.fn(),
  }
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: geolocation })
  return {
    geolocation,
    watching: () => watches.size,
    fix(latitude: number, longitude: number, speed: number | null = null, heading: number | null = null) {
      const coords = { latitude, longitude, speed, heading, accuracy: 5, altitude: null, altitudeAccuracy: null }
      for (const watch of watches.values()) watch.success({ coords, timestamp: Date.now() } as GeolocationPosition)
    },
    fail(code: 1 | 2 | 3) {
      for (const watch of [...watches.values()]) watch.error?.({ code, message: '' } as GeolocationPositionError)
    },
  }
}

/** Giữ lại hàm của nhịp gửi 30 giây thay vì hẹn giờ; `tick()` là "30 giây đã trôi qua". Hẹn giờ khác chạy thật. */
function holdSendInterval() {
  const real = globalThis.setInterval
  let handler: (() => void) | undefined
  vi.spyOn(globalThis, 'setInterval').mockImplementation(((callback: () => void, delay?: number) => {
    if (delay !== GPS_SEND_INTERVAL_MS) return real(callback, delay)
    handler = callback
    return 0
  }) as typeof setInterval)
  return { tick: () => handler?.() }
}

const gpsPoints = async (tripId: string) => (await getMockDb().getLocationHistory(tripId)).filter((point) => point.source === 'GPS')

afterEach(() => {
  // Gỡ màn trước khi gỡ `navigator.geolocation` giả: lúc gỡ, hook còn gọi `clearWatch`
  cleanup()
  Reflect.deleteProperty(navigator, 'geolocation')
  vi.restoreAllMocks()
})

test('a browser position becomes a store position: m/s to km/h, heading into [0, 360), missing values are 0', () => {
  expect(locationInput({ latitude: 10.85, longitude: 106.75, speed: 10, heading: 90 })).toStrictEqual({ lat: 10.85, lng: 106.75, speedKmh: 36, heading: 90 })
  expect(locationInput({ latitude: 10.85, longitude: 106.75, speed: 12.345, heading: 360 })).toStrictEqual({ lat: 10.85, lng: 106.75, speedKmh: 44.4, heading: 0 })
  expect(locationInput({ latitude: 10.85, longitude: 106.75, speed: null, heading: Number.NaN })).toStrictEqual({ lat: 10.85, lng: 106.75, speedKmh: 0, heading: 0 })
})

test('turned on, the first fix is sent at once and the latest position every 30 seconds; the store records GPS points', async () => {
  const tripId = await deliveringTrip()
  const geo = mockGeolocation()
  const interval = holdSendInterval()
  renderDriver(`/tai-xe/diem-giao?chuyen=${tripId}`)
  const toggle = await screen.findByRole('switch', SWITCH, LOAD)
  expect(toggle).not.toBeChecked()
  expect(screen.getByText('Mô phỏng', { exact: true })).toBeInTheDocument()
  expect(screen.getByText('Chưa có máy chủ: vị trí từ điện thoại chỉ hiện trong trình duyệt này.')).toBeInTheDocument()

  await userEvent.click(toggle)
  expect(toggle).toBeChecked()
  expect(geo.geolocation.watchPosition).toHaveBeenCalledTimes(1)
  expect(screen.getByText('Đang chờ quyền vị trí và tín hiệu GPS…')).toBeInTheDocument()

  geo.fix(10.85, 106.75, 10, 90)
  expect(await screen.findByText(/^Đã gửi vị trí lúc \d{2}:\d{2}\. Gửi lại mỗi 30 giây\.$/, {}, LOAD)).toBeInTheDocument()
  expect(screen.getByText('GPS', { exact: true })).toBeInTheDocument()
  expect((await gpsPoints(tripId)).map(({ lat, lng, speedKmh, heading }) => ({ lat, lng, speedKmh, heading }))).toStrictEqual([{ lat: 10.85, lng: 106.75, speedKmh: 36, heading: 90 }])

  // vị trí mới chưa tới nhịp thì chưa gửi; tới nhịp 30 giây thì gửi vị trí mới nhất
  geo.fix(10.86, 106.76)
  geo.fix(10.87, 106.77)
  expect((await gpsPoints(tripId)).length).toBe(1)
  interval.tick()
  await waitFor(async () => expect((await gpsPoints(tripId)).map((point) => point.lat)).toStrictEqual([10.85, 10.87]), LOAD)
})

test('permission denied: tracking stops, the switch goes back off with the reason, and no point is recorded', async () => {
  const tripId = await deliveringTrip()
  const before = (await gpsPoints(tripId)).length
  const geo = mockGeolocation()
  renderDriver(`/tai-xe/diem-giao?chuyen=${tripId}`)
  const toggle = await screen.findByRole('switch', SWITCH, LOAD)
  await userEvent.click(toggle)
  geo.fail(1)
  expect(await screen.findByText('Trình duyệt không cho dùng vị trí: vị trí xe về mô phỏng. Cấp quyền vị trí cho trang rồi bật lại.')).toBeInTheDocument()
  expect(toggle).not.toBeChecked()
  await waitFor(() => expect([geo.geolocation.clearWatch.mock.calls.length, geo.watching()]).toStrictEqual([1, 0]))
  expect(screen.getByText('Mô phỏng', { exact: true })).toBeInTheDocument()
  expect((await gpsPoints(tripId)).length).toBe(before)
})

test('a lost signal and turning it off both go back to simulation with a message; leaving the trip screen stops watching', async () => {
  const tripId = await deliveringTrip()
  const geo = mockGeolocation()
  const view = renderDriver(`/tai-xe/diem-giao?chuyen=${tripId}`)
  const toggle = await screen.findByRole('switch', SWITCH, LOAD)
  await userEvent.click(toggle)
  geo.fix(10.85, 106.75)
  expect(await screen.findByText(/^Đã gửi vị trí lúc/, {}, LOAD)).toBeInTheDocument()
  geo.fail(2)
  expect(await screen.findByText('Mất tín hiệu GPS: vị trí xe về mô phỏng. Bật lại khi có tín hiệu.')).toBeInTheDocument()
  // Thôi theo dõi nằm ở phần dọn của effect, chạy sau lần vẽ đã hiện câu trên: chờ nó thay vì đọc ngay
  await waitFor(() => expect([toggle.getAttribute('aria-checked'), geo.watching()]).toStrictEqual(['false', 0]))

  await userEvent.click(toggle)
  expect(geo.watching()).toBe(1)
  await userEvent.click(toggle)
  expect(screen.getByText('Đã tắt GPS thật: vị trí xe về mô phỏng.')).toBeInTheDocument()
  expect(geo.watching()).toBe(0)

  await userEvent.click(toggle)
  expect(geo.watching()).toBe(1)
  view.unmount()
  expect(geo.watching()).toBe(0)
})

test('a device without geolocation shows the switch disabled with the reason', async () => {
  const tripId = await deliveringTrip()
  renderDriver(`/tai-xe/diem-giao?chuyen=${tripId}`)
  expect(await screen.findByRole('switch', SWITCH, LOAD)).toBeDisabled()
  expect(screen.getByText('Thiết bị này không có định vị: vị trí xe là mô phỏng.')).toBeInTheDocument()
})
