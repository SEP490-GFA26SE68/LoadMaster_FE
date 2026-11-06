import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { envelope, stubBackend, type FakeCall } from '@/test/fake-backend'
import { renderWarehouse } from './warehouse-test-utils'

/**
 * Phiên xếp bản máy chủ có bước soạn hàng (`stagingRequired`): soạn bằng mã gõ, báo thiếu, rồi sang bước xếp — xác nhận tay chờ duyệt chặn
 * hoàn tất, kiện hỏng bỏ lại kho —, xếp xong thì ghi số seal. Đăng nhập vẫn là phiên kho mẫu (chỉ để dựng màn).
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'mock', apiUrl: 'http://be.test', features: new Set(['warehouse']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'warehouse',
}))

const CODE = 'TRIP-20261106-A1'

type Row = { status: string; staged: boolean; shortageStatus?: string; manualStatus?: string; manualStep?: string }
let rows: Record<number, Row> = {}
let completed = false
let seal: string | null = null
let calls: FakeCall[] = []

const step = (placementId: number, sequence: number, barcode: string) => ({
  placementId, packageId: placementId * 10, packageName: `Thùng nước ${sequence}`, packageCode: null, trackingBarcode: barcode, qrToken: `qr-${placementId}`,
  // Hai kiện nằm cạnh nhau trên sàn: không kiện nào tựa lên kiện nào
  posX: (sequence - 1) * 60, posY: 0, posZ: 0, packedLength: 60, packedWidth: 40, packedHeight: 30, rotation: 0, weightKg: 12.5, sequence,
  stopId: 31, stopSequence: 1, stopName: 'Co.opmart Biên Hoà', ...rows[placementId],
})

function session() {
  const placements = [step(101, 1, 'LB-0001'), step(102, 2, 'LB-0002')]
  return {
    executionId: 1, loadPlanId: 3, tripId: 7, tripCode: CODE, vehicleInfo: 'Isuzu NQR',
    innerLength: null, innerWidth: null, innerHeight: null, doorWidth: null, doorHeight: null,
    totalPackages: 2, status: completed ? 'COMPLETED' : 'IN_PROGRESS', startedAt: null, completedAt: null,
    stagingRequired: true, stagingComplete: placements.every((item) => item.staged),
    pendingManualCount: placements.filter((item) => item.manualStatus === 'PENDING').length,
    sealNumber: seal, sealedAt: seal ? '2026-11-06 11:00:00' : null, sealedByName: seal ? 'Kho Long Bình' : null,
    placements,
  }
}

function patch(placementId: number, next: Partial<Row>) {
  const row = rows[placementId] ?? { status: 'PENDING', staged: false }
  rows = { ...rows, [placementId]: { ...row, ...next } }
}

beforeEach(() => {
  rows = { 101: { status: 'PENDING', staged: false }, 102: { status: 'PENDING', staged: false } }
  completed = false
  seal = null
  connectApiAuth(() => Promise.resolve('token-1'))
  calls = stubBackend({
    'GET /api/warehouse/tasks/7': () => ({ body: envelope(session()) }),
    'POST /api/warehouse/tasks/7/staging/packages/1010/confirm': () => {
      patch(101, { staged: true })
      return { body: envelope({ packageId: 1010, alreadyStaged: false }) }
    },
    'POST /api/warehouse/tasks/7/staging/packages/1020/shortage': () => {
      patch(102, { shortageStatus: 'OPEN' })
      return { body: envelope({ id: 5, status: 'OPEN' }) }
    },
    'POST /api/warehouse/tasks/7/staging/packages/1020/confirm': () => {
      patch(102, { staged: true, shortageStatus: undefined })
      return { body: envelope({ packageId: 1020, alreadyStaged: false }) }
    },
    'POST /api/warehouse/placements/101/manual': () => {
      patch(101, { status: 'CONFIRMED', manualStatus: 'PENDING', manualStep: 'LOADING' })
      return { body: envelope({ id: 9, step: 'LOADING', status: 'PENDING' }) }
    },
    'POST /api/warehouse/placements/102/damaged': () => {
      patch(102, { status: 'DAMAGED' })
      return { body: envelope({ placementId: 102, outcome: 'LEFT_OUT', restingCount: 0, tripStatus: 'LOADING' }) }
    },
    'POST /api/warehouse/tasks/7/complete': () => {
      completed = true
      return { body: envelope({ tripId: 7, totalPackages: 2, totalDeviations: 0 }) }
    },
    'POST /api/warehouse/tasks/7/seal': (call) => {
      seal = (call.body as { sealNumber: string }).sealNumber
      return { body: envelope({ tripId: 7, sealNumber: seal }) }
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

const posts = () => calls.filter((call) => call.method === 'POST').map((call) => call.path)

test('soạn hàng: đối chiếu bằng mã gõ không cần thứ tự, báo thiếu, soạn đủ thì sang bước xếp', async () => {
  const user = userEvent.setup()
  renderWarehouse('/kho?chuyen=7')
  await screen.findByRole('heading', { level: 1, name: 'Kiện chưa soạn (2)' }, LOAD)

  // Mã lạ: màn nói ngay, không gọi máy chủ
  const dialog = await verify(user, 'LB-9999')
  expect(await dialog.findByText(/LB-9999/)).toBeInTheDocument()
  expect(posts()).toStrictEqual([])
  await user.clear(dialog.getByLabelText('Mã kiện'))
  await user.type(dialog.getByLabelText('Mã kiện'), 'lb-0001')
  await user.click(dialog.getByRole('button', { name: 'Đối chiếu mã' }))
  expect(await dialog.findByText('Đã soạn LB-0001 · Thùng nước 1.', undefined, LOAD)).toBeInTheDocument()
  await user.click(dialog.getByRole('button', { name: 'Đóng' }))
  await screen.findByRole('heading', { level: 1, name: 'Kiện chưa soạn (1)' }, LOAD)

  const list = within(screen.getByRole('list', { name: 'Kiện chưa soạn' }))
  await user.click(list.getByRole('button', { name: 'Báo thiếu' }))
  await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Báo thiếu' }))
  expect(await screen.findByText('Đã báo thiếu — chờ điều phối', undefined, LOAD)).toBeInTheDocument()
  expect(screen.getByText(/Thiếu 1 kiện — chờ điều phối viên quyết/)).toBeInTheDocument()

  // Kho tìm thấy kiện: soạn tiếp, soạn đủ thì màn tự sang bước xếp
  await verify(user, 'LB-0002')
  await screen.findByRole('region', { name: 'Kiện cần xếp — bước 1 / 2' }, LOAD)
  expect(posts()).toStrictEqual([
    '/api/warehouse/tasks/7/staging/packages/1010/confirm',
    '/api/warehouse/tasks/7/staging/packages/1020/shortage',
    '/api/warehouse/tasks/7/staging/packages/1020/confirm',
  ])
  expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ method: 'CODE' })
})

test('xếp: xác nhận tay gửi điều phối viên, kiện hỏng bỏ lại kho; còn xác nhận tay chờ duyệt thì chưa hoàn tất được', async () => {
  rows = { 101: { status: 'PENDING', staged: true }, 102: { status: 'PENDING', staged: true } }
  const user = userEvent.setup()
  renderWarehouse('/kho?chuyen=7')
  await screen.findByRole('region', { name: 'Kiện cần xếp — bước 1 / 2' }, LOAD)

  await user.click(screen.getByRole('button', { name: 'Đối chiếu kiện' }))
  const dialog = within(await screen.findByRole('dialog'))
  await user.click(dialog.getByRole('tab', { name: 'Xác nhận tay' }))
  await user.click(dialog.getByRole('radio', { name: 'QR không đọc được' }))
  await user.click(dialog.getByRole('button', { name: 'Gửi xác nhận tay' }))
  await screen.findByRole('region', { name: 'Kiện cần xếp — bước 2 / 2' }, LOAD)
  expect(calls.find((call) => call.path === '/api/warehouse/placements/101/manual')?.body).toEqual({ reason: 'QR_UNREADABLE' })

  await user.click(screen.getByRole('button', { name: 'Kiện hỏng' }))
  const damaged = within(await screen.findByRole('dialog'))
  expect(damaged.getByText(/không kiện nào tựa lên nó/)).toBeInTheDocument()
  await user.click(damaged.getByRole('button', { name: 'Ghi kiện hỏng' }))

  const complete = await screen.findByRole('button', { name: 'Hoàn tất xếp hàng' }, LOAD)
  expect(complete).toBeDisabled()
  expect(complete).toHaveAccessibleDescription('Còn 1 xác nhận tay chờ điều phối viên duyệt — chưa hoàn tất xếp được.')
  expect(posts()).toStrictEqual(['/api/warehouse/placements/101/manual', '/api/warehouse/placements/102/damaged'])
})

test('xếp xong: ghi số seal trước khi xe rời kho, phiên đọc lại mang số seal', async () => {
  rows = { 101: { status: 'CONFIRMED', staged: true }, 102: { status: 'DAMAGED', staged: true } }
  completed = true
  const user = userEvent.setup()
  renderWarehouse('/kho?chuyen=7')
  expect(await screen.findByText(`Đã xếp xong chuyến ${CODE}`, undefined, LOAD)).toBeInTheDocument()
  expect(screen.getByText(/bỏ lại 1 kiện hỏng/i)).toBeInTheDocument()

  await user.type(screen.getByRole('textbox', { name: 'Số seal' }), '  SEAL-42 ')
  await user.click(screen.getByRole('button', { name: 'Ghi số seal' }))
  expect(await screen.findByText(/Số seal SEAL-42 · ghi lúc/, undefined, LOAD)).toBeInTheDocument()
  expect(calls.find((call) => call.path === '/api/warehouse/tasks/7/seal')?.body).toEqual({ sealNumber: 'SEAL-42' })
  expect(screen.getByRole('link', { name: 'Về danh sách chuyến' })).toBeInTheDocument()
})
