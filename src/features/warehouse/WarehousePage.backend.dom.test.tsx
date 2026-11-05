import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { envelope, page, stubBackend, type FakeCall } from '@/test/fake-backend'
import { renderWarehouse } from './warehouse-test-utils'

/**
 * Màn kho khi nhóm `warehouse` nối backend: danh sách đọc `GET /api/warehouse/tasks` + chuyến Đang xếp hàng, phiên xếp theo danh sách kiện
 * máy chủ trả lúc bắt đầu; đối chiếu bằng mã gõ, xác nhận theo thứ tự, hoàn tất. Đăng nhập vẫn là phiên kho mẫu (chỉ để dựng màn).
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'mock', apiUrl: 'http://be.test', features: new Set(['warehouse']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'warehouse',
}))

const TASK = { tripId: 7, tripCode: 'TRIP-20261106-A1', vehicleInfo: 'Isuzu NQR', totalPackages: 2, loadPlanId: 3, departureTime: '2026-11-06 14:30:00', status: 'PLANNED' }
const OTHER = { id: 9, tripCode: 'TRIP-20261106-C3', vehicleName: 'Hino', licensePlate: '51D-111.22', departureTime: '2026-11-06T08:00:00', packageCount: 4 }

const step = (placementId: number, sequence: number, barcode: string) => ({
  placementId, packageId: placementId * 10, packageName: `Thùng nước ${sequence}`, trackingBarcode: barcode,
  posX: 0, posY: 0, posZ: 0, packedLength: 60, packedWidth: 40, packedHeight: 30, rotation: 0, sequence,
})

let started = false
let calls: FakeCall[] = []

beforeEach(() => {
  started = false
  sessionStorage.removeItem('loadmaster.phien-xep-may-chu')
  connectApiAuth(() => Promise.resolve('token-1'))
  calls = stubBackend({
    'GET /api/warehouse/tasks': () => ({ body: envelope(started ? [] : [TASK]) }),
    'GET /api/trips': () => ({ body: page(started ? [OTHER, { id: 7, tripCode: TASK.tripCode, departureTime: '2026-11-06T14:30:00' }] : [OTHER]) }),
    'POST /api/warehouse/tasks/7/start': () => {
      started = true
      return { body: envelope({ executionId: 1, tripId: 7, tripCode: TASK.tripCode, vehicleInfo: 'Isuzu NQR', totalPackages: 2, status: 'IN_PROGRESS', startedAt: null, placements: [step(101, 1, 'LB-0001'), step(102, 2, 'LB-0002')] }) }
    },
    'POST /api/warehouse/placements/101/confirm': { body: envelope({ placementId: 101, status: 'CONFIRMED' }) },
    'POST /api/warehouse/placements/102/confirm': { body: envelope({ placementId: 102, status: 'CONFIRMED' }) },
    'POST /api/warehouse/tasks/7/complete': { body: envelope({ tripId: 7, totalPackages: 2, totalDeviations: 0 }) },
  }).calls
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const LOAD = { timeout: 4000 }

async function verify(user: ReturnType<typeof userEvent.setup>, code: string) {
  await user.click(screen.getByRole('button', { name: 'Đối chiếu kiện' }))
  const dialog = within(await screen.findByRole('dialog'))
  await user.type(dialog.getByLabelText('Mã kiện'), code)
  await user.click(dialog.getByRole('button', { name: 'Đối chiếu mã' }))
  return dialog
}

test('danh sách: chờ xếp có nút bắt đầu, chuyến đang xếp ở nơi khác chỉ nói lý do; không có chuông', async () => {
  renderWarehouse('/kho')
  await screen.findByRole('heading', { level: 2, name: 'Chờ xếp' }, LOAD)
  expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toStrictEqual(['Chờ xếp', 'Đang xếp ở thiết bị khác'])
  const elsewhere = within(screen.getByRole('heading', { level: 3, name: OTHER.tripCode }).closest('li') as HTMLElement)
  expect(elsewhere.queryByRole('button')).not.toBeInTheDocument()
  expect(elsewhere.queryByRole('link')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Thông báo/ })).not.toBeInTheDocument()
})

test('bắt đầu → đối chiếu từng kiện theo thứ tự bằng mã gõ → hoàn tất', async () => {
  const user = userEvent.setup()
  renderWarehouse('/kho')
  await user.click(await screen.findByRole('button', { name: 'Bắt đầu xếp hàng' }, LOAD))

  const card = await screen.findByRole('region', { name: 'Kiện cần xếp — bước 1 / 2' }, LOAD)
  expect(within(card).getByText('Thùng nước 1')).toBeInTheDocument()
  expect(within(card).getByText('LB-0001')).toBeInTheDocument()

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

  // Kiện cuối: hộp đóng, màn nói đã xếp mọi kiện
  await verify(user, '1020')
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
