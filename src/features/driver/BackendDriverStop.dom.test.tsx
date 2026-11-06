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
 * demo (chỉ để dựng màn). Màn chỉ còn việc backend làm được: báo đã đến, quét hoặc gõ mã dỡ từng kiện, hoàn tất điểm, gửi GPS. Máy chủ giả
 * giữ giờ đến và kiện đã dỡ, trả lại ở `current-stop` như máy chủ thật.
 */
type Reply = { readonly status?: number; readonly body: unknown }
const ok = (data: unknown): Reply => ({ body: { success: true, message: 'ok', data } })

const TRIP = { tripId: 1, tripCode: 'TRIP-20261017-94EE14F0', vehicleLicensePlate: '51C-284.19', stopCount: 3, departureTime: '2026-10-17T13:37:59', status: 'IN_TRANSIT' }
type StopPackage = { readonly packageId: number } & Readonly<Record<string, unknown>>
type Stop = { readonly stopId: number; readonly stopSequence: number; readonly stopName: string; readonly address: string; readonly packages: readonly StopPackage[] }

const STOP_2: Stop = {
  stopId: 2, stopSequence: 2, stopName: 'Kho Bách Hoá Xanh Dĩ An', address: '215 Quốc lộ 1K, Dĩ An',
  packages: [
    { packageId: 11, packageName: 'Thùng dầu ăn 12 chai', trackingBarcode: 'LB-PK-0007', qrToken: '63abd059-f710-4bf5-abe1-a1c120f2c6d9', weight: 12, unloadOrder: 1 },
    { packageId: 12, packageName: 'Thùng nước mắm 6 chai', trackingBarcode: 'LB-PK-0008', qrToken: 'a1c120f2-63ab-4bf5-f710-d0596d9abe1c', weight: 9.5, unloadOrder: 2 },
  ],
}
const STOP_3: Stop = {
  stopId: 3, stopSequence: 3, stopName: 'Siêu thị Co.opmart Biên Hoà', address: '121 Phạm Văn Thuận, Biên Hoà',
  packages: [{ packageId: 13, packageName: 'Thùng mì', trackingBarcode: 'LB-PK-0009', weight: 5, unloadOrder: 1 }],
}

let routes: Record<string, () => Reply> = {}
let posts: string[] = []
let lastBody: unknown
/** Máy chủ giả: giờ đến theo điểm và kiện đã dỡ — `current-stop` trả lại đúng như vậy, kể cả sau khi tải lại trang. */
let arrivals: Map<number, string>
let unloaded: Set<number>
let current: Stop

const stopReply = (stop: Stop) => ok({
  ...stop,
  status: arrivals.has(stop.stopId) ? 'ARRIVED' : 'PENDING',
  actualArrival: arrivals.get(stop.stopId) ?? null,
  packages: stop.packages.map((pkg) => ({ ...pkg, unloaded: unloaded.has(pkg.packageId) })),
})

const arrive = (stop: Stop, at: string) => () => {
  arrivals.set(stop.stopId, at)
  return ok({ stopId: stop.stopId, tripId: 1, stopSequence: stop.stopSequence, stopName: stop.stopName, status: 'ARRIVED', actualArrival: at })
}

const unload = (packageId: number, remaining: number) => () => {
  unloaded.add(packageId)
  return ok({ packageId, remainingPackagesCount: remaining })
}

beforeEach(() => {
  posts = []
  lastBody = undefined
  arrivals = new Map()
  unloaded = new Set()
  current = STOP_2
  routes = {
    'GET /api/users/me': () => ok({ id: 9 }),
    'GET /api/driver/trips': () => ok([TRIP]),
    'GET /api/driver/trips/1/current-stop': () => stopReply(current),
    'POST /api/driver/stops/2/arrive': arrive(STOP_2, '2026-10-17T14:20:00'),
    'POST /api/driver/stops/3/arrive': arrive(STOP_3, '2026-10-17T15:05:00'),
    'POST /api/driver/packages/11/unload': unload(11, 1),
    'POST /api/driver/packages/12/unload': unload(12, 0),
    'POST /api/driver/stops/2/complete': () => {
      current = STOP_3
      return ok({ stopId: 2, tripCompleted: false, nextStopId: 3 })
    },
  }
  vi.stubGlobal('fetch', (input: string, init: RequestInit) => {
    const url = new URL(input)
    const key = `${init.method ?? 'GET'} ${url.pathname}`
    if (init.method === 'POST') {
      posts.push(`${key}${url.search}`)
      lastBody = typeof init.body === 'string' ? JSON.parse(init.body) : undefined
    }
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

test('điểm đang giao: báo đã đến, quét hoặc gõ mã dỡ từng kiện, hoàn tất điểm rồi sang điểm kế tiếp; việc backend chưa có không hiện', async () => {
  renderDriver('/tai-xe/diem-giao?chuyen=1')
  expect(await screen.findByRole('heading', { level: 1, name: 'Điểm 2 / 3' })).toBeInTheDocument()
  expect(screen.getByText('Đang tới điểm 2. Đến nơi thì bấm Đã đến rồi mới dỡ hàng.')).toBeInTheDocument()
  for (const name of ['Xuất phát', 'Báo sự cố', 'Xem vị trí hàng', 'Đối chiếu kiện dỡ']) expect(screen.queryByRole('button', { name })).toBeNull()
  expect(screen.getByText('Thiết bị này không có định vị: không gửi được vị trí.')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Đã đến điểm 2' }))
  expect(await screen.findByText(/Đã đến điểm 2 lúc 14:20/)).toBeInTheDocument()
  expect(posts).toStrictEqual(['POST /api/driver/stops/2/arrive'])
  expect(screen.getByText('Cần dỡ 2 kiện · Đã dỡ 0')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Hoàn tất điểm giao' })).toBeDisabled()

  await userEvent.click(screen.getByRole('button', { name: 'Đối chiếu kiện dỡ' }))
  const dialog = within(await screen.findByRole('dialog', { name: 'Đối chiếu kiện dỡ tại điểm 2' }))
  // Quét QR và gõ mã; chưa có xác nhận tay. Không có camera (jsdom) thì hộp mở ở gõ mã
  expect(dialog.getAllByRole('tab').map((tab) => tab.textContent)).toStrictEqual(['Quét QR', 'Gõ mã'])
  expect(dialog.getByRole('tab', { name: 'Gõ mã' })).toHaveAttribute('aria-selected', 'true')
  const code = dialog.getByRole('textbox', { name: 'Mã kiện' })
  expect(dialog.getByText(/Mã QR in dưới hình, mã đứng đầu dòng kiện trên màn này/)).toBeInTheDocument()
  await userEvent.type(code, 'lb-pk-0007')
  await userEvent.click(dialog.getByRole('button', { name: 'Đối chiếu mã' }))
  expect(await dialog.findByRole('status')).toHaveTextContent('Vừa dỡ LB-PK-0007 · Thùng dầu ăn 12 chai.')
  expect(posts.at(-1)).toBe('POST /api/driver/packages/11/unload?driverId=9')
  expect(await screen.findByText('Cần dỡ 2 kiện · Đã dỡ 1')).toBeInTheDocument()

  // Mã không khớp kiện nào của điểm: nói ngay trong hộp, không gọi backend
  await userEvent.clear(code)
  await userEvent.type(code, 'XX-1')
  await userEvent.click(dialog.getByRole('button', { name: 'Đối chiếu mã' }))
  expect(await dialog.findByRole('alert')).toHaveTextContent('Mã XX-1 không khớp kiện nào của điểm này.')
  expect(posts).toHaveLength(2)

  // Kiện cuối của điểm, bằng mã QR in dưới hình (máy chủ trả chữ thường): hộp tự đóng, hoàn tất được
  await userEvent.clear(code)
  await userEvent.type(code, 'A1C120F2-63AB-4BF5-F710-D0596D9ABE1C')
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
  // Điểm kế tiếp: lại báo đến trước khi dỡ
  expect(screen.getByRole('button', { name: 'Đã đến điểm 3' })).toBeInTheDocument()
  expect(screen.getByText('Cần dỡ 1 kiện · Đã dỡ 0')).toBeInTheDocument()
})

test('tải lại trang: giờ đến và kiện đã dỡ đọc từ máy chủ, không phải gõ lại', async () => {
  arrivals.set(2, '2026-10-17T14:20:00')
  unloaded.add(11)
  renderDriver('/tai-xe/diem-giao?chuyen=1')
  expect(await screen.findByText(/Đã đến điểm 2 lúc 14:20/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Đã đến điểm 2' })).toBeNull()
  expect(screen.getByText('Cần dỡ 2 kiện · Đã dỡ 1')).toBeInTheDocument()
  expect(posts).toStrictEqual([])
})

test('máy chủ báo đã đến từ trước (báo ở máy khác): coi như đã đến, giờ đến đọc lại từ máy chủ; lỗi khác thì toast nói lý do', async () => {
  const { toast } = await import('sonner')
  routes['POST /api/driver/stops/2/arrive'] = () => ({ status: 409, body: { success: false, code: 'DELIVERY_STOP_NOT_CURRENT', message: 'x' } })
  const user = userEvent.setup()
  renderDriver('/tai-xe/diem-giao?chuyen=1')
  await user.click(await screen.findByRole('button', { name: 'Đã đến điểm 2' }))
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Chưa tới lượt điểm giao này — hoàn tất điểm đang giao trước.'))
  expect(screen.getByRole('button', { name: 'Đã đến điểm 2' })).toBeInTheDocument()

  routes['POST /api/driver/stops/2/arrive'] = () => {
    arrivals.set(2, '2026-10-17T14:12:00')
    return { status: 409, body: { success: false, code: 'DELIVERY_STOP_ALREADY_ARRIVED', message: 'x' } }
  }
  await user.click(screen.getByRole('button', { name: 'Đã đến điểm 2' }))
  expect(await screen.findByText(/Đã đến điểm 2 lúc 14:12/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Đối chiếu kiện dỡ' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Đã đến điểm 2' })).toBeNull()
})

test('"Thêm" chỉ còn "Sự cố trên đường": báo sự cố gửi lên máy chủ theo mã số chuyến, tiêu đề nói mã chuyến', async () => {
  const { toast } = await import('sonner')
  routes['POST /api/driver/trips/1/exceptions'] = () => ok({
    id: 'EXC-7', tripId: '1', type: 'TRAFFIC', description: 'Kẹt xe cầu Đồng Nai', delayMinutes: 25, status: 'OPEN', reportedAt: '2026-10-17T14:05:00',
  })
  const user = userEvent.setup()
  renderDriver('/tai-xe/diem-giao?chuyen=1')
  await user.click(await screen.findByRole('button', { name: 'Thêm' }))
  const sheet = within(await screen.findByRole('dialog', { name: 'Thêm thao tác' }))
  expect(sheet.queryByRole('button', { name: 'Nhận hàng dọc đường' })).toBeNull()
  await user.click(sheet.getByRole('button', { name: 'Sự cố trên đường' }))

  const dialog = within(await screen.findByRole('dialog', { name: 'Báo sự cố chuyến TRIP-20261017-94EE14F0' }))
  expect(dialog.getByText(/Máy chủ ghi lại sự cố/)).toBeInTheDocument()
  await user.click(dialog.getByRole('radio', { name: 'Tắc đường' }))
  await user.type(dialog.getByRole('textbox', { name: 'Mô tả' }), 'Kẹt xe cầu Đồng Nai')
  await user.type(dialog.getByRole('textbox', { name: 'Số phút dự kiến chậm' }), '25')
  await user.click(dialog.getByRole('button', { name: 'Báo sự cố' }))

  await waitFor(() => expect(posts).toStrictEqual(['POST /api/driver/trips/1/exceptions']))
  expect(lastBody).toStrictEqual({ type: 'TRAFFIC', description: 'Kẹt xe cầu Đồng Nai', delayMinutes: 25 })
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Đã báo sự cố EXC-7'))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

test('chuyến không có trong danh sách của tài xế: nói lý do, không đọc điểm của nó', async () => {
  renderDriver('/tai-xe/diem-giao?chuyen=7')
  expect(await screen.findByText('Chuyến không đang vận chuyển')).toBeInTheDocument()
  expect(posts).toStrictEqual([])
})

const LOADING_TRIP = { ...TRIP, tripId: 4, tripCode: 'TRIP-20261106-LOAD01', status: 'LOADING', loadingCompleted: true }

test('chuyến kho chưa xếp xong: Xuất phát mờ, lý do ngay trên nút, không gọi máy chủ', async () => {
  routes['GET /api/driver/trips'] = () => ok([{ ...LOADING_TRIP, loadingCompleted: false }])
  renderDriver('/tai-xe')
  expect(await screen.findByRole('heading', { level: 2, name: 'Kho đang soạn / xếp' })).toBeInTheDocument()
  const depart = screen.getByRole('button', { name: 'Xuất phát' })
  expect(depart).toBeDisabled()
  expect(depart).toHaveAccessibleDescription('Kho chưa xếp xong — xuất phát được khi kho hoàn tất xếp hàng.')
  expect(posts).toStrictEqual([])
})

test('kho đã xếp xong: chuyến ở nhóm Xếp xong, Xuất phát bật; máy chủ vẫn từ chối thì toast nói lý do, không đổi gì', async () => {
  const { toast } = await import('sonner')
  routes['GET /api/driver/trips'] = () => ok([LOADING_TRIP])
  routes['POST /api/driver/trips/4/start'] = () => ({ status: 409, body: { success: false, message: 'Loading not completed' } })
  const user = userEvent.setup()
  renderDriver('/tai-xe')
  expect(await screen.findByRole('heading', { level: 2, name: 'Xếp xong — chờ xuất phát' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Xuất phát' }))
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Kho chưa xếp xong hàng cho chuyến này, chưa xuất phát được.'))
  expect(posts).toStrictEqual(['POST /api/driver/trips/4/start'])
  expect(screen.getByRole('button', { name: 'Xuất phát' })).toBeInTheDocument()
})

test('Xuất phát được thì mở màn điểm giao của chuyến', async () => {
  routes['GET /api/driver/trips'] = () => ok([LOADING_TRIP])
  routes['POST /api/driver/trips/4/start'] = () => {
    routes['GET /api/driver/trips'] = () => ok([{ ...LOADING_TRIP, status: 'IN_TRANSIT' }])
    routes['GET /api/driver/trips/4/current-stop'] = () => ok(STOP_2)
    return ok({ tripId: 4, status: 'IN_TRANSIT' })
  }
  const user = userEvent.setup()
  renderDriver('/tai-xe')
  await user.click(await screen.findByRole('button', { name: 'Xuất phát' }))
  await waitFor(() => expect(posts).toStrictEqual(['POST /api/driver/trips/4/start']))
  expect((await screen.findAllByText('Kho Bách Hoá Xanh Dĩ An', undefined, { timeout: 4000 })).length).toBeGreaterThan(0)
})
