import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { renderDriver } from './driver-test-utils'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'mock', apiUrl: 'http://be.test', features: new Set(['driver']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'driver',
}))

/**
 * Màn tài xế khi nhóm `driver` nối backend: `fetch` giả trả phong bì của `DriverController`; đăng nhập vẫn là phiên kho mẫu của tài xế
 * demo (chỉ để dựng màn). Màn chỉ còn việc backend làm được: gõ mã dỡ từng kiện, hoàn tất điểm, gửi GPS.
 */
type Reply = { readonly status?: number; readonly body: unknown }
const ok = (data: unknown): Reply => ({ body: { success: true, message: 'ok', data } })

const TRIP = { tripId: 1, tripCode: 'TRIP-20261017-94EE14F0', vehicleLicensePlate: '51C-284.19', stopCount: 3, departureTime: '2026-10-17T13:37:59', status: 'IN_TRANSIT' }
const STOP_2 = {
  stopId: 2, stopSequence: 2, stopName: 'Kho Bách Hoá Xanh Dĩ An', address: '215 Quốc lộ 1K, Dĩ An',
  packages: [
    { packageId: 11, packageName: 'Thùng dầu ăn 12 chai', trackingBarcode: 'LB-PK-0007', weight: 12, unloadOrder: 1 },
    { packageId: 12, packageName: 'Thùng nước mắm 6 chai', trackingBarcode: 'LB-PK-0008', weight: 9.5, unloadOrder: 2 },
  ],
}
const STOP_3 = { stopId: 3, stopSequence: 3, stopName: 'Siêu thị Co.opmart Biên Hoà', address: '121 Phạm Văn Thuận, Biên Hoà', packages: [STOP_2.packages[0]] }

let routes: Record<string, () => Reply> = {}
let posts: string[] = []

beforeEach(() => {
  posts = []
  routes = {
    'GET /api/users/me': () => ok({ id: 9 }),
    'GET /api/driver/trips': () => ok([TRIP]),
    'GET /api/driver/trips/1/current-stop': () => ok(STOP_2),
    'POST /api/driver/packages/11/unload': () => ok({ packageId: 11, remainingPackagesCount: 1 }),
    'POST /api/driver/packages/12/unload': () => ok({ packageId: 12, remainingPackagesCount: 0 }),
    'POST /api/driver/stops/2/complete': () => {
      routes['GET /api/driver/trips/1/current-stop'] = () => ok(STOP_3)
      return ok({ stopId: 2, tripCompleted: false, nextStopId: 3 })
    },
  }
  vi.stubGlobal('fetch', (input: string, init: RequestInit) => {
    const url = new URL(input)
    const key = `${init.method ?? 'GET'} ${url.pathname}`
    if (init.method === 'POST') posts.push(`${key}${url.search}`)
    const reply = routes[key]?.() ?? { status: 500, body: { success: false, message: 'không có route giả' } }
    return Promise.resolve({ ok: (reply.status ?? 200) < 400, status: reply.status ?? 200, text: () => Promise.resolve(JSON.stringify(reply.body)) })
  })
  return () => vi.unstubAllGlobals()
})

test('"Chuyến của tôi" đọc chuyến đang vận chuyển của backend; không chuông vì backend chưa có thông báo cho tài xế', async () => {
  renderDriver('/tai-xe')
  expect(await screen.findByRole('heading', { level: 3, name: 'TRIP-20261017-94EE14F0' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: 'Đang vận chuyển' })).toBeInTheDocument()
  expect(screen.getByText(/51C-284\.19/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Thông báo/ })).toBeNull()
})

test('điểm đang giao: gõ mã dỡ từng kiện, hoàn tất điểm rồi sang điểm kế tiếp; việc backend chưa có không hiện', async () => {
  renderDriver('/tai-xe/diem-giao?chuyen=1')
  expect(await screen.findByRole('heading', { level: 1, name: 'Điểm 2 / 3' })).toBeInTheDocument()
  expect(screen.getByText('Đang giao điểm 2: gõ mã trên nhãn của từng kiện khi đưa xuống xe.')).toBeInTheDocument()
  for (const name of ['Xuất phát', 'Đã đến điểm 2', 'Báo sự cố', 'Thêm', 'Xem vị trí hàng']) expect(screen.queryByRole('button', { name })).toBeNull()
  expect(screen.getByText('Cần dỡ 2 kiện · Đã dỡ 0')).toBeInTheDocument()
  expect(screen.getByText('Thiết bị này không có định vị: không gửi được vị trí.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Hoàn tất điểm giao' })).toBeDisabled()

  await userEvent.click(screen.getByRole('button', { name: 'Đối chiếu kiện dỡ' }))
  const dialog = within(await screen.findByRole('dialog', { name: 'Đối chiếu kiện dỡ tại điểm 2' }))
  expect(dialog.queryByRole('tablist')).toBeNull()
  // Nhãn và gợi ý nói đúng mã gõ được: dữ liệu điểm của máy chủ chưa có mã QR hay mã bên gửi
  const code = dialog.getByRole('textbox', { name: 'Mã kiện' })
  expect(dialog.getByText(/Mã đứng đầu dòng kiện trên màn này/)).toBeInTheDocument()
  await userEvent.type(code, 'lb-pk-0007')
  await userEvent.click(dialog.getByRole('button', { name: 'Đối chiếu mã' }))
  expect(await dialog.findByRole('status')).toHaveTextContent('Vừa dỡ LB-PK-0007 · Thùng dầu ăn 12 chai.')
  expect(posts).toStrictEqual(['POST /api/driver/packages/11/unload?driverId=9'])
  expect(await screen.findByText('Cần dỡ 2 kiện · Đã dỡ 1')).toBeInTheDocument()

  // Mã không khớp kiện nào của điểm: nói ngay trong hộp, không gọi backend
  await userEvent.clear(code)
  await userEvent.type(code, 'XX-1')
  await userEvent.click(dialog.getByRole('button', { name: 'Đối chiếu mã' }))
  expect(await dialog.findByRole('alert')).toHaveTextContent('Mã XX-1 không khớp kiện nào của điểm này.')
  expect(posts).toHaveLength(1)

  // Kiện cuối của điểm: hộp tự đóng, hoàn tất được
  await userEvent.clear(code)
  await userEvent.type(code, 'LB-PK-0008')
  await userEvent.click(dialog.getByRole('button', { name: 'Đối chiếu mã' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  const complete = screen.getByRole('button', { name: 'Hoàn tất điểm giao' })
  await waitFor(() => expect(complete).toBeEnabled())

  await userEvent.click(complete)
  const confirm = within(await screen.findByRole('dialog', { name: 'Hoàn tất điểm 2 — Kho Bách Hoá Xanh Dĩ An?' }))
  expect(confirm.getByText('Tiếp theo: điểm 3.')).toBeInTheDocument()
  await userEvent.click(confirm.getByRole('button', { name: 'Hoàn tất' }))
  expect(await screen.findByRole('heading', { level: 1, name: 'Điểm 3 / 3' })).toBeInTheDocument()
  expect(posts.at(-1)).toBe('POST /api/driver/stops/2/complete?driverId=9')
  expect(screen.getByText('Cần dỡ 1 kiện · Đã dỡ 0')).toBeInTheDocument()
})

test('chuyến không có trong danh sách của tài xế: nói lý do, không đọc điểm của nó', async () => {
  renderDriver('/tai-xe/diem-giao?chuyen=7')
  expect(await screen.findByText('Chuyến không đang vận chuyển')).toBeInTheDocument()
  expect(posts).toStrictEqual([])
})
