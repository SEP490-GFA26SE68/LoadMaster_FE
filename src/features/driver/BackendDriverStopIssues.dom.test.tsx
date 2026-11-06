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
 * Màn điểm giao của tài xế khi nhóm `driver` nối backend — phần ngoài lệnh dỡ: giờ đến và hạn giao của máy chủ (không MOCK RESULT), "Xem
 * vị trí hàng" theo phương án kho đã xếp, "Báo sự cố" theo kiện (khách từ chối: kiện ở lại xe) và xác nhận tay chờ điều phối viên duyệt.
 * Máy chủ giả giữ sự cố và xác nhận tay, trả lại ở `current-stop` như máy chủ thật. Điểm 2 đã báo đến từ trước.
 */
type Reply = { readonly status?: number; readonly body: unknown }
const ok = (data: unknown): Reply => ({ body: { success: true, message: 'ok', data } })

const TRIP = { tripId: 1, tripCode: 'TRIP-20261017-94EE14F0', vehicleLicensePlate: '51C-284.19', stopCount: 3, departureTime: '2026-10-17T13:37:59', status: 'IN_TRANSIT' }
const PACKAGES = [
  { packageId: 11, packageName: 'Thùng dầu ăn 12 chai', trackingBarcode: 'LB-PK-0007', weight: 12, unloadOrder: 1 },
  { packageId: 12, packageName: 'Thùng nước mắm 6 chai', trackingBarcode: 'LB-PK-0008', weight: 9.5, unloadOrder: 2 },
]

let routes: Record<string, () => Reply> = {}
let posts: [string, unknown][] = []
let gets: string[] = []
let unloaded: Set<number>
let issues: Map<number, { kind: string; note: string }>
let manuals: Map<number, { status: string; reason: string }>

const currentStop = () => ok({
  stopId: 2, stopSequence: 2, stopName: 'Kho Bách Hoá Xanh Dĩ An', address: '215 Quốc lộ 1K, Dĩ An', status: 'ARRIVED', actualArrival: '2026-10-17T14:20:00',
  packages: PACKAGES.map((pkg) => {
    const issue = issues.get(pkg.packageId)
    const manual = manuals.get(pkg.packageId)
    return {
      ...pkg,
      unloaded: unloaded.has(pkg.packageId),
      ...(issue ? { issueKind: issue.kind, issueNote: issue.note } : {}),
      ...(manual ? { manualStatus: manual.status, manualReason: manual.reason } : {}),
    }
  }),
})

beforeEach(() => {
  posts = []
  gets = []
  unloaded = new Set()
  issues = new Map()
  manuals = new Map()
  routes = {
    'GET /api/users/me': () => ok({ id: 9 }),
    'GET /api/driver/trips': () => ok([TRIP]),
    'GET /api/driver/trips/1/current-stop': currentStop,
  }
  vi.stubGlobal('fetch', (input: string, init: RequestInit) => {
    const url = new URL(input)
    const key = `${init.method ?? 'GET'} ${url.pathname}`
    const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : undefined
    if (init.method === 'POST') posts.push([url.pathname, body])
    if ((init.method ?? 'GET') === 'GET') gets.push(url.pathname)
    const reply = routes[key]?.() ?? { status: 500, body: { success: false, message: 'không có route giả' } }
    return Promise.resolve({ ok: (reply.status ?? 200) < 400, status: reply.status ?? 200, text: () => Promise.resolve(JSON.stringify(reply.body)) })
  })
  return () => vi.unstubAllGlobals()
})

const row = (container: HTMLElement, id: number) => container.querySelector(`li[data-package-id="${id}"]`) as HTMLElement

test('giờ đến và hạn giao theo máy chủ, không MOCK RESULT; có phương án kho đã xếp thì có "Xem vị trí hàng"', async () => {
  routes['GET /api/driver/trips/1/stops'] = () => ok({
    tripId: 1, status: 'IN_TRANSIT', location: null, refreshMs: null,
    stops: [{ stopSequence: 2, stopName: 'Kho Bách Hoá Xanh Dĩ An', status: 'ARRIVED', packageCount: 2, actualArrival: '2026-10-17T14:20:00', deadline: '2026-10-17T15:00:00' }],
  })
  routes['GET /api/driver/trips/1/load-plan'] = () => ok({
    tripId: 1, tripCode: TRIP.tripCode, loadPlanId: 40, licensePlate: '51C-284.19', innerLength: 600, innerWidth: 240, innerHeight: 240, doorWidth: 230, doorHeight: 220, maxPayloadKg: 5000,
    stops: [{ stopId: 2, stopSequence: 2, stopName: 'Kho Bách Hoá Xanh Dĩ An', status: 'ARRIVED' }],
    placements: [{ placementId: 501, packageId: 11, packageCode: null, trackingBarcode: 'LB-PK-0007', posX: 0, posY: 0, posZ: 0, packedLength: 100, packedWidth: 80, packedHeight: 60, rotation: 0, weightKg: 12, stepSequence: 1, unloadOrder: 1, stopSequence: 2, unloaded: false }],
  })
  renderDriver('/tai-xe/diem-giao?chuyen=1')
  expect(await screen.findByText('Đến kịp hạn')).toBeInTheDocument()
  expect(await screen.findByRole('button', { name: 'Xem vị trí hàng' })).toBeInTheDocument()
  expect(screen.queryByText('MOCK RESULT')).toBeNull()
})

test('máy chủ chưa có phương án hay giờ của điểm: không có "Xem vị trí hàng", không có dòng giờ đến', async () => {
  routes['GET /api/driver/trips/1/load-plan'] = () => ({ status: 404, body: { success: false, code: 'NO_LOADED_PLAN', message: 'x' } })
  routes['GET /api/driver/trips/1/stops'] = () => ok({ tripId: 1, status: 'IN_TRANSIT', location: null, refreshMs: null, stops: [] })
  renderDriver('/tai-xe/diem-giao?chuyen=1')
  expect(await screen.findByRole('button', { name: 'Đối chiếu kiện dỡ' })).toBeInTheDocument()
  await waitFor(() => expect(posts).toStrictEqual([]))
  expect(screen.queryByRole('button', { name: 'Xem vị trí hàng' })).toBeNull()
  expect(screen.queryByText('Đến kịp hạn')).toBeNull()
})

test('khách từ chối: ghi sự cố lên máy chủ theo mã kiện; kiện ở lại xe, toast nói mã in trên nhãn', async () => {
  const { toast } = await import('sonner')
  routes['POST /api/driver/packages/11/issues'] = () => {
    issues.set(11, { kind: 'REFUSED', note: 'Khách đổi đơn' })
    return ok({ issueId: 5, packageId: 11, kind: 'REFUSED' })
  }
  const user = userEvent.setup()
  const { container } = renderDriver('/tai-xe/diem-giao?chuyen=1')
  await user.click(await screen.findByRole('button', { name: 'Báo sự cố' }))
  const dialog = within(await screen.findByRole('dialog', { name: 'Báo sự cố tại điểm 2' }))
  expect(dialog.getByRole('combobox', { name: 'Kiện' })).toHaveValue('11')
  expect(dialog.getByRole('option', { name: 'LB-PK-0007 · Thùng dầu ăn 12 chai' })).toBeInTheDocument()
  await user.click(dialog.getByRole('radio', { name: 'Khách từ chối' }))
  await user.type(dialog.getByRole('textbox', { name: 'Ghi chú' }), 'Khách đổi đơn')
  await user.click(dialog.getByRole('button', { name: 'Ghi sự cố' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(posts).toStrictEqual([['/api/driver/packages/11/issues', { kind: 'REFUSED', note: 'Khách đổi đơn' }]])
  expect(toast.warning).toHaveBeenCalledWith('Khách từ chối LB-PK-0007', { description: 'Kiện ở lại xe và thành Hoàn trả khi hoàn tất điểm giao.' })
  await waitFor(() => expect(row(container, 11)).toHaveAttribute('data-state', 'returned'))
  expect(within(row(container, 11)).getByText('Sự cố: Khách từ chối')).toBeInTheDocument()
  expect(screen.getByText('Cần dỡ 2 kiện · Đã dỡ 0 · Sự cố 1')).toBeInTheDocument()
})

test('xác nhận tay: gửi lý do lên máy chủ; kiện ghi đã dỡ chờ duyệt và chặn hoàn tất điểm, lý do ngay trên nút', async () => {
  const { toast } = await import('sonner')
  routes['POST /api/driver/packages/11/manual-unload'] = () => {
    unloaded.add(11)
    manuals.set(11, { status: 'PENDING', reason: 'QR_UNREADABLE' })
    return ok({ id: 3, packageId: 11, status: 'PENDING' })
  }
  routes['POST /api/driver/packages/12/unload'] = () => {
    unloaded.add(12)
    return ok({ packageId: 12, remainingPackagesCount: 0 })
  }
  const user = userEvent.setup()
  const { container } = renderDriver('/tai-xe/diem-giao?chuyen=1')
  await user.click(await screen.findByRole('button', { name: 'Đối chiếu kiện dỡ' }))
  const dialog = within(await screen.findByRole('dialog', { name: 'Đối chiếu kiện dỡ tại điểm 2' }))
  await user.click(dialog.getByRole('tab', { name: 'Xác nhận tay' }))
  await user.click(dialog.getByRole('radio', { name: /LB-PK-0007/ }))
  await user.click(dialog.getByRole('radio', { name: 'QR không đọc được' }))
  await user.click(dialog.getByRole('button', { name: 'Gửi xác nhận tay' }))

  await waitFor(() => expect(toast.warning).toHaveBeenCalledWith('Đã ghi xác nhận tay LB-PK-0007', { description: 'Chờ điều phối viên duyệt trước khi hoàn tất điểm giao.' }))
  expect(posts).toStrictEqual([['/api/driver/packages/11/manual-unload', { reason: 'QR_UNREADABLE', note: null }]])
  await waitFor(() => expect(row(container, 11)).toHaveAttribute('data-state', 'unloaded'))
  expect(within(row(container, 11)).getByText('Đã dỡ · xác nhận tay, chờ duyệt')).toBeInTheDocument()

  // Kiện còn lại dỡ bằng mã: đủ kiện mà vẫn còn xác nhận tay chờ duyệt — chưa hoàn tất được
  await user.click(dialog.getByRole('tab', { name: 'Gõ mã' }))
  await user.type(dialog.getByRole('textbox', { name: 'Mã kiện' }), 'LB-PK-0008')
  await user.click(dialog.getByRole('button', { name: 'Đối chiếu mã' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  const complete = screen.getByRole('button', { name: 'Hoàn tất điểm giao' })
  await waitFor(() => expect(complete).toHaveAccessibleDescription('Còn 1 xác nhận tay của điểm này chờ điều phối viên duyệt — chưa hoàn tất điểm giao được.'))
  expect(complete).toBeDisabled()
})

test('hoàn tất điểm cuối không đọc lại phương án đã xếp: chuyến đã giao xong, máy chủ không còn trả phương án', async () => {
  const user = userEvent.setup()
  unloaded = new Set([11, 12])
  let completed = false
  routes['GET /api/driver/trips/1/load-plan'] = () => (completed ? { status: 404, body: { success: false, code: 'NO_LOADED_PLAN', message: 'x' } } : ok({
    tripId: 1, tripCode: TRIP.tripCode, loadPlanId: 40, licensePlate: '51C-284.19', innerLength: 600, innerWidth: 240, innerHeight: 240, doorWidth: 230, doorHeight: 220, maxPayloadKg: 5000,
    stops: [{ stopId: 2, stopSequence: 2, stopName: 'Kho Bách Hoá Xanh Dĩ An', status: 'ARRIVED' }],
    placements: [{ placementId: 501, packageId: 11, packageCode: null, trackingBarcode: 'LB-PK-0007', posX: 0, posY: 0, posZ: 0, packedLength: 100, packedWidth: 80, packedHeight: 60, rotation: 0, weightKg: 12, stepSequence: 1, unloadOrder: 1, stopSequence: 2, unloaded: true }],
  }))
  routes['POST /api/driver/stops/2/complete'] = () => { completed = true; return ok({ stopId: 2, deliveredCount: 2, returnedCount: 0, tripCompleted: true, tripStatus: 'DELIVERED' }) }
  routes['GET /api/driver/trips'] = () => ok([{ ...TRIP, status: completed ? 'DELIVERED' : 'IN_TRANSIT' }])
  renderDriver('/tai-xe/diem-giao?chuyen=1')
  await screen.findByRole('button', { name: 'Xem vị trí hàng' })
  const before = gets.filter((path) => path.endsWith('/load-plan')).length
  await user.click(screen.getByRole('button', { name: 'Hoàn tất điểm giao' }))
  await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Hoàn tất' }))
  await waitFor(() => expect(posts.map(([path]) => path)).toContain('/api/driver/stops/2/complete'))
  expect(await screen.findByText('Đã giao xong chuyến')).toBeInTheDocument()
  expect(gets.filter((path) => path.endsWith('/load-plan')).length).toBe(before)
})
