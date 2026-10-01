import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { expect, test, vi } from 'vitest'
import { getMockDb } from '@/lib/mock-db'
import { optimizedTwoCartonTrip } from '@/test/mock-db-samples'
import { LOAD, renderWarehouse } from './warehouse-test-utils'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() } }))

/**
 * Phiên xếp `/kho?chuyen=` (LM-086): kho dùng chung → `warehouse-api.ts` → hook → màn, không giả lập module nào. Kỳ vọng đọc thẳng
 * từ kho. Test theo thứ tự trên cùng một kho: chuyến chính được bắt đầu, ghi dần, rồi mở lại.
 */
const SEED_TRIP = 'TRIP-2026-0914'
/** Lớp phủ "Đã xếp" 1,2 s + ghi + đọc lại. */
const NEXT = { timeout: 5000 }

async function seedPlanOrder() {
  const plan = await getMockDb().getRevision('REV-002')
  return plan.result.placements.toSorted((a, b) => a.loadingOrder - b.loadingOrder).map((p) => p.packageInstanceId)
}

async function approvedTwoCartonTrip() {
  const db = getMockDb()
  const { trip, revision } = await optimizedTwoCartonTrip(db)
  const approved = await db.approveRevision(revision.id, [])
  return { db, trip, approved }
}

test('opening an approved trip starts loading it at loadingOrder 1 of the latest approved plan; exit goes back to the list', async () => {
  const [first] = await seedPlanOrder()
  renderWarehouse(`/kho?chuyen=${SEED_TRIP}`)

  expect(await screen.findByRole('heading', { level: 1, name: first }, LOAD)).toBeInTheDocument()
  expect(screen.getByText(/^Bước/)).toHaveTextContent('Bước 1 / 132')
  expect(screen.getByText('MOCK RESULT')).toBeInTheDocument()
  expect(screen.getByText('Thứ tự xếp tính lại khi duyệt')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Thoát phiên xếp hàng' })).toHaveAttribute('href', '/kho')
  const trip = await getMockDb().getTrip(SEED_TRIP)
  expect([trip.phase, trip.loading?.revisionId, trip.loading?.startedBy, trip.loading?.steps]).toStrictEqual(['loading', 'REV-002', 'US-0003', []])
}, 15_000)

test('confirming records the package as loaded and moves on; reopening resumes at the first package without a result', async () => {
  const [first, second] = await seedPlanOrder()
  const view = renderWarehouse(`/kho?chuyen=${SEED_TRIP}`)
  await screen.findByRole('heading', { level: 1, name: first }, LOAD)

  await userEvent.click(screen.getByRole('button', { name: 'Xác nhận đã xếp' }))
  expect(screen.getByText(`Đã xếp ${first}`)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Xác nhận đã xếp' })).toBeDisabled()
  expect(await screen.findByRole('heading', { level: 1, name: second }, NEXT)).toBeInTheDocument()
  expect(screen.getByText(/^Bước/)).toHaveTextContent('Bước 2 / 132')
  expect((await getMockDb().getTrip(SEED_TRIP)).loading?.steps.map((step) => [step.packageInstanceId, step.outcome])).toStrictEqual([[first, 'loaded']])

  view.unmount()
  renderWarehouse(`/kho?chuyen=${SEED_TRIP}`)
  expect(await screen.findByRole('heading', { level: 1, name: second }, LOAD)).toBeInTheDocument()
  expect(screen.getByText(/^Bước/)).toHaveTextContent('Bước 2 / 132')
}, 15_000)

test('"Kiện này không có ở kho" asks first, then records the package as missing and moves to the next one', async () => {
  const [, second, third] = await seedPlanOrder()
  renderWarehouse(`/kho?chuyen=${SEED_TRIP}`)
  await screen.findByRole('heading', { level: 1, name: second }, LOAD)

  await userEvent.click(screen.getByRole('button', { name: 'Kiện này không có ở kho' }))
  const dialog = screen.getByRole('dialog', { name: `Ghi thiếu ${second}?` })
  await userEvent.click(within(dialog).getByRole('button', { name: 'Quay lại' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1, name: second })).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Kiện này không có ở kho' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Ghi thiếu' }))
  expect(await screen.findByRole('heading', { level: 1, name: third }, NEXT)).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(toast.warning).toHaveBeenCalledWith(`Đã ghi thiếu ${second}`, { description: 'Chuyển sang kiện kế tiếp.' })
  const steps = (await getMockDb().getTrip(SEED_TRIP)).loading?.steps.map((step) => [step.packageInstanceId, step.outcome])
  expect(steps?.at(-1)).toStrictEqual([second, 'missing'])
}, 15_000)

test('two-carton trip: cm measures of step 1, then missing, then the last confirmation completes the loading', async () => {
  const { db, trip, approved } = await approvedTwoCartonTrip()
  const first = approved.result.placements.find((placement) => placement.loadingOrder === 1)
  renderWarehouse(`/kho?chuyen=${trip.id}`)

  const heading = await screen.findByRole('heading', { level: 1, name: 'PKG-001-01' }, LOAD)
  const card = within(heading.closest('div.overflow-y-auto') as HTMLElement)
  expect(screen.getByText(/^Bước/)).toHaveTextContent('Bước 1 / 2')
  // Truck 6m dài 600 cm, Carton A 120 × 60 × 45 cm, 30 kg, hướng LWH, đặt trên sàn tại y = 0, x = 120 — chạm hốc bánh xe OBS-001 (x 0–120)
  expect(first).toMatchObject({ packageInstanceId: 'PKG-001-01', xCm: 120 })
  expect(card.getByText('Cách cửa sau').nextSibling).toHaveTextContent('360 cm')
  expect(card.getByText('Cách vách trước').nextSibling).toHaveTextContent('120 cm')
  expect(card.getByText('Cách vách phải').nextSibling).toHaveTextContent('180 cm')
  expect(card.getByText('Lớp 1 · Cách cửa 360 cm')).toBeInTheDocument()
  expect(card.getByText('Hướng đặt').nextSibling).toHaveTextContent('LWH · Đứng thẳng · cạnh dài dọc thùng')
  expect(card.getByText('30 kg')).toBeInTheDocument()
  expect(card.getByText('120 × 60 × 45 cm')).toBeInTheDocument()
  expect(card.getByRole('img', { name: /^Minh hoạ hướng đặt LWH/ })).toBeInTheDocument()
  expect(card.getByText('Hốc bánh xe OBS-001 · khe 0 cm')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Kiện này không có ở kho' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Ghi thiếu' }))
  // Bước 2 (PKG-002-01, x = 240) cách hốc bánh xe 120 cm: không nhắc vật cản
  await screen.findByRole('heading', { level: 1, name: 'PKG-002-01' }, NEXT)
  expect(screen.queryByText('Vật cản gần nhất')).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Xác nhận đã xếp' }))
  expect(screen.getByText('Đang hoàn tất xếp hàng…')).toBeInTheDocument()
  expect(await screen.findByRole('heading', { level: 1, name: `Đã xếp xong chuyến ${trip.id}` }, NEXT)).toBeInTheDocument()
  expect(screen.getByText('Đã xếp 1 / 2 kiện')).toBeInTheDocument()
  const missing = screen.getByRole('region', { name: 'Kiện thiếu ở kho (1)' })
  expect(within(missing).getByText('PKG-001-01')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Về danh sách chuyến' })).toHaveAttribute('href', '/kho')
  expect((await db.getTrip(trip.id)).phase).toBe('loaded')
}, 20_000)

test('QR scan (LM-104): a wrong package is explained and not recorded; the right ones load; the seal is recorded when finished', async () => {
  const { db, trip } = await approvedTwoCartonTrip()
  const token = Object.fromEntries((await db.listTripLabels(trip.id)).map((label) => [label.packageInstanceId, label.qrToken]))
  renderWarehouse(`/kho?chuyen=${trip.id}`)
  await screen.findByRole('heading', { level: 1, name: 'PKG-001-01' }, LOAD)

  async function scan(value: string) {
    const dialog = screen.getByRole('dialog')
    const input = within(dialog).getByRole('textbox', { name: 'Nhập mã' })
    await userEvent.clear(input)
    await userEvent.type(input, value)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận mã' }))
  }

  await userEvent.click(screen.getByRole('button', { name: 'Quét QR kiện' }))
  expect(screen.getByRole('dialog', { name: 'Quét QR kiện bước 1' })).toHaveTextContent('Bước này cần kiện PKG-001-01 · Carton A')
  await scan(token['PKG-002-01'] ?? '')
  expect(await within(screen.getByRole('dialog')).findByRole('alert', {}, LOAD)).toHaveTextContent(
    'Sai kiện: vừa quét PKG-002-01 (Carton A), bước này cần PKG-001-01 (Carton A). Chưa ghi gì — để kiện này sang bên và quét đúng kiện.',
  )
  expect((await db.getTrip(trip.id)).loading?.steps).toStrictEqual([])

  await scan(token['PKG-001-01'] ?? '')
  expect(await screen.findByText('Đã xếp PKG-001-01', {}, LOAD)).toBeInTheDocument()
  expect(await screen.findByRole('heading', { level: 1, name: 'PKG-002-01' }, NEXT)).toBeInTheDocument()

  // Lớp phủ "Đã xếp" giữ các nút tới khi hết 1,2 giây
  await waitFor(() => expect(screen.getByRole('button', { name: 'Quét QR kiện' })).toBeEnabled(), NEXT)
  await userEvent.click(screen.getByRole('button', { name: 'Quét QR kiện' }))
  await scan(token['PKG-002-01'] ?? '')
  expect(await screen.findByRole('heading', { level: 1, name: `Đã xếp xong chuyến ${trip.id}` }, NEXT)).toBeInTheDocument()
  expect(screen.getByText('Đã xác nhận bằng quét QR 2 kiện')).toBeInTheDocument()
  // Chưa ghi seal: nút ghi seal là nút chính, lối về danh sách là nút phụ
  await userEvent.click(screen.getByRole('button', { name: 'Ghi số seal' }))
  expect(screen.getByText('Nhập số seal trước khi ghi.')).toBeInTheDocument()
  await userEvent.type(screen.getByRole('textbox', { name: 'Số seal' }), 'SEAL-0915')
  await userEvent.click(screen.getByRole('button', { name: 'Ghi số seal' }))
  expect(await screen.findByText(/^Số seal SEAL-0915 · ghi lúc/, {}, LOAD)).toBeInTheDocument()
  const stored = await db.getTrip(trip.id)
  expect([stored.phase, stored.loading?.seal?.number, stored.loading?.steps.map((step) => step.via)]).toStrictEqual(['loaded', 'SEAL-0915', ['qr', 'qr']])
}, 20_000)

test('a stale approved plan does not start: the worker waits for the dispatcher to approve again', async () => {
  renderWarehouse('/kho?chuyen=TRIP-013')
  expect(await screen.findByText('Chờ tối ưu và duyệt lại', {}, LOAD)).toBeInTheDocument()
  expect(screen.getByText(/^Phương án đã duyệt của chuyến TRIP-013 lỗi thời/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Xác nhận đã xếp' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Về danh sách chuyến' })).toHaveAttribute('href', '/kho')
  expect((await getMockDb().getTrip('TRIP-013')).phase).toBe('planning')
})

test('no approved plan, a cancelled trip or an unknown trip: say why, with the way back to the list', async () => {
  const db = getMockDb()
  const { trip } = await optimizedTwoCartonTrip(db)
  const view = renderWarehouse(`/kho?chuyen=${trip.id}`)
  expect(await screen.findByText('Chưa có phương án đã duyệt', {}, LOAD)).toBeInTheDocument()
  expect(screen.getByText(`Chuyến ${trip.id} chưa có phương án đã duyệt. Quản lý công ty cần duyệt phương án trước khi kho xếp.`)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Về danh sách chuyến' })).toHaveAttribute('href', '/kho')
  view.unmount()

  await db.cancelTrip(trip.id, 'Khách hoãn nhận hàng')
  const cancelled = renderWarehouse(`/kho?chuyen=${trip.id}`)
  expect(await screen.findByText('Chuyến đã huỷ', {}, LOAD)).toBeInTheDocument()
  expect(screen.getByText(`Chuyến ${trip.id} đã huỷ: Khách hoãn nhận hàng`)).toBeInTheDocument()
  cancelled.unmount()

  renderWarehouse('/kho?chuyen=TRIP-KHONG-CO')
  expect(await screen.findByText('Không tải được chuyến', {}, LOAD)).toBeInTheDocument()
  expect(screen.getByText('Không tìm thấy TRIP-KHONG-CO.')).toBeInTheDocument()
}, 15_000)

test('a warehouse worker continuing a trip a colleague started resumes at its first package without a result; exit goes to the trip list', async () => {
  // TRIP-011 (seed): Đỗ Thị Hạnh đã ghi 110 / 280 kiện; nhân viên kho demo Lê Văn Hải mở tiếp
  renderWarehouse('/kho?chuyen=TRIP-011')
  expect(await screen.findByText(/^Bước/, {}, LOAD)).toHaveTextContent('Bước 111 / 280')
  expect(screen.getByRole('link', { name: 'Thoát phiên xếp hàng' })).toHaveAttribute('href', '/kho')
})
