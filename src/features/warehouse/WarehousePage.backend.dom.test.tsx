import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { envelope, stubBackend, type FakeCall } from '@/test/fake-backend'
import { renderWarehouse } from './warehouse-test-utils'

/**
 * Màn kho khi nhóm `warehouse` nối backend: danh sách đọc `GET /api/warehouse/tasks` (chuyến chờ xếp và chuyến Đang xếp hàng kèm phiên),
 * phiên xếp đọc lại từ máy chủ; đối chiếu bằng mã gõ, xác nhận theo thứ tự, hoàn tất. Đăng nhập vẫn là phiên kho mẫu (chỉ để dựng màn).
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'mock', apiUrl: 'http://be.test', features: new Set(['warehouse']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'warehouse',
}))

const TASK = { tripId: 7, tripCode: 'TRIP-20261106-A1', vehicleInfo: 'Isuzu NQR', totalPackages: 2, loadPlanId: 3, departureTime: '2026-11-06 14:30:00', status: 'PLANNED', executionId: null, executionStatus: null }
/** Chuyến bắt đầu xếp ở thiết bị khác: máy chủ trả kèm phiên, mở lại được ở đây. */
const OTHER = { tripId: 9, tripCode: 'TRIP-20261106-C3', vehicleInfo: 'Hino 51D-111.22', totalPackages: 1, loadPlanId: 5, departureTime: '2026-11-06 08:00:00', status: 'LOADING', executionId: 4, executionStatus: 'IN_PROGRESS' }

let started = false
let completed = false
let outcomes: Record<number, string> = {}
let calls: FakeCall[] = []

const step = (placementId: number, sequence: number, barcode: string) => ({
  placementId, packageId: placementId * 10, packageName: `Thùng nước ${sequence}`, packageCode: null, trackingBarcode: barcode, qrToken: `qr-${placementId}`,
  posX: 0, posY: 0, posZ: 0, packedLength: 60, packedWidth: 40, packedHeight: 30, rotation: 0, weightKg: 12.5, sequence,
  stopId: 31, stopSequence: 1, stopName: 'Co.opmart Biên Hoà', status: outcomes[placementId] ?? 'PENDING',
})

const session = (tripId: number, tripCode: string, placements: ReturnType<typeof step>[]) => ({
  executionId: 1, loadPlanId: 3, tripId, tripCode, vehicleInfo: 'Isuzu NQR', licensePlate: null, vehicleTypeName: null,
  // Không trả lòng thùng: màn không có khung 3D
  innerLength: null, innerWidth: null, innerHeight: null, doorWidth: null, doorHeight: null,
  totalPackages: placements.length, status: completed ? 'COMPLETED' : 'IN_PROGRESS', startedAt: null, completedAt: null, placements,
})

const tripSeven = () => session(7, TASK.tripCode, [step(101, 1, 'LB-0001'), step(102, 2, 'LB-0002')])

function confirmed(placementId: number) {
  outcomes = { ...outcomes, [placementId]: 'CONFIRMED' }
  return { body: envelope({ placementId, status: 'CONFIRMED' }) }
}

beforeEach(() => {
  started = false
  completed = false
  outcomes = {}
  connectApiAuth(() => Promise.resolve('token-1'))
  calls = stubBackend({
    'GET /api/warehouse/tasks': () => ({ body: envelope([OTHER, started ? { ...TASK, status: 'LOADING', executionId: 1, executionStatus: 'IN_PROGRESS' } : TASK]) }),
    'POST /api/warehouse/tasks/7/start': () => {
      started = true
      return { body: envelope(tripSeven()) }
    },
    'GET /api/warehouse/tasks/7': () => ({ body: envelope(tripSeven()) }),
    'GET /api/warehouse/tasks/9': () => ({ body: envelope(session(9, OTHER.tripCode, [step(901, 1, 'LB-0901')])) }),
    'POST /api/warehouse/placements/101/confirm': () => confirmed(101),
    'POST /api/warehouse/placements/102/confirm': () => confirmed(102),
    'POST /api/warehouse/tasks/7/complete': () => {
      completed = true
      return { body: envelope({ tripId: 7, totalPackages: 2, totalDeviations: 0 }) }
    },
  }).calls
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const LOAD = { timeout: 4000 }

async function verify(user: ReturnType<typeof userEvent.setup>, code: string) {
  await user.click(screen.getByRole('button', { name: 'Đối chiếu kiện' }))
  const dialog = within(await screen.findByRole('dialog'))
  // Máy không có camera quét (jsdom): hộp mở ở tab gõ mã
  await user.type(dialog.getByLabelText('Mã kiện'), code)
  await user.click(dialog.getByRole('button', { name: 'Đối chiếu mã' }))
  return dialog
}

test('danh sách: chờ xếp có nút bắt đầu; chuyến bắt đầu xếp ở thiết bị khác mở lại được ở đây; không có chuông', async () => {
  const user = userEvent.setup()
  renderWarehouse('/kho')
  await screen.findByRole('heading', { level: 2, name: 'Chờ xếp' }, LOAD)
  expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toStrictEqual(['Đang xếp hàng', 'Chờ xếp'])
  expect(screen.queryByRole('button', { name: /Thông báo/ })).not.toBeInTheDocument()
  const other = within(screen.getByRole('heading', { level: 3, name: OTHER.tripCode }).closest('li') as HTMLElement)
  await user.click(other.getByRole('link', { name: 'Tiếp tục soạn / xếp' }))
  const card = await screen.findByRole('region', { name: 'Kiện cần xếp — bước 1 / 1' }, LOAD)
  expect(within(card).getByText('LB-0901')).toBeInTheDocument()
  expect(within(card).getByText('1 · Co.opmart Biên Hoà')).toBeInTheDocument()
  // Mở lại bằng GET, không bắt đầu lần hai
  expect(calls.some((call) => call.method === 'POST')).toBe(false)
  expect(calls.some((call) => call.method === 'GET' && call.path === '/api/warehouse/tasks/9')).toBe(true)
})

test('bắt đầu → đối chiếu từng kiện theo thứ tự bằng mã gõ → hoàn tất', async () => {
  const user = userEvent.setup()
  renderWarehouse('/kho')
  await user.click(await screen.findByRole('button', { name: 'Bắt đầu soạn hàng' }, LOAD))

  const card = await screen.findByRole('region', { name: 'Kiện cần xếp — bước 1 / 2' }, LOAD)
  expect(within(card).getByText('Thùng nước 1')).toBeInTheDocument()
  expect(within(card).getByText('LB-0001')).toBeInTheDocument()
  // Khối lượng kiện của máy chủ, như thẻ kiện của kho mẫu
  expect(within(card).getByText('Khối lượng').nextSibling).toHaveTextContent('12,5 kg')

  // Mã của kiện khác: không gọi máy chủ
  const wrong = await verify(user, 'LB-0002')
  expect(await wrong.findByText(/Mã LB-0002 không phải kiện của bước này/)).toBeInTheDocument()
  expect(calls.some((call) => call.path.endsWith('/confirm'))).toBe(false)

  await user.clear(wrong.getByLabelText('Mã kiện'))
  await user.type(wrong.getByLabelText('Mã kiện'), 'lb-0001')
  await user.click(wrong.getByRole('button', { name: 'Đối chiếu mã' }))
  expect(await wrong.findByText('Đã xếp Thùng nước 1.', undefined, LOAD)).toBeInTheDocument()
  await user.click(wrong.getByRole('button', { name: 'Đóng' }))
  await screen.findByRole('region', { name: 'Kiện cần xếp — bước 2 / 2' }, LOAD)

  // Kiện cuối gõ mã QR in trên nhãn: hộp đóng, màn nói đã xếp mọi kiện
  await verify(user, 'QR-102')
  expect(await screen.findByText(/Đã xếp mọi kiện/, undefined, LOAD)).toBeInTheDocument()
  await user.click(await screen.findByRole('button', { name: 'Hoàn tất xếp hàng' }, LOAD))
  expect(await screen.findByText(`Đã xếp xong chuyến ${TASK.tripCode}`, undefined, LOAD)).toBeInTheDocument()
  expect(calls.filter((call) => call.method === 'POST').map((call) => call.path)).toStrictEqual([
    '/api/warehouse/tasks/7/start',
    '/api/warehouse/placements/101/confirm',
    '/api/warehouse/placements/102/confirm',
    '/api/warehouse/tasks/7/complete',
  ])
})

test('danh sách: chuyến quay về lập kế hoạch vì thiếu kiện nằm ở nhóm chờ điều phối tối ưu lại, không có nút', async () => {
  const stale = { ...TASK, tripId: 11, tripCode: 'TRIP-20261106-D4', totalPackages: null, loadPlanId: null, status: 'DRAFT', awaitingReplan: true, replanReason: 'STAGING_SHORTAGE' }
  calls = stubBackend({ 'GET /api/warehouse/tasks': () => ({ body: envelope([TASK, stale]) }) }).calls
  renderWarehouse('/kho')
  await screen.findByRole('heading', { level: 2, name: 'Chờ điều phối tối ưu lại' }, LOAD)
  expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toStrictEqual(['Chờ xếp', 'Chờ điều phối tối ưu lại'])
  const card = within(screen.getByRole('heading', { level: 3, name: stale.tripCode }).closest('li') as HTMLElement)
  expect(card.getByText(/Điều phối viên đã bỏ kiện kho báo thiếu/)).toBeInTheDocument()
  expect(card.queryByRole('button')).not.toBeInTheDocument()
  expect(card.queryByRole('link')).not.toBeInTheDocument()
  expect(calls.find((call) => call.path === '/api/warehouse/tasks')?.query).toEqual({ includeAwaitingReplan: 'true' })
})
