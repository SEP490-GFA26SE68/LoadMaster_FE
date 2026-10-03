import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { expect, test, vi } from 'vitest'
import { getMockDb } from '@/lib/mock-db'
import { twoCartonRequest, twoCartonResult, twoCartonTrip } from '@/test/mock-db-samples'
import { LOAD, renderDriver } from './driver-test-utils'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() } }))

/**
 * Một chuyến của tài xế `/tai-xe/diem-giao?chuyen=` (LM-087): kho dùng chung → `driver-api.ts` → hook → màn, không giả lập module
 * nào. Tiến độ đọc/ghi trong kho. Test theo thứ tự: bài cuối làm chuyến chính lỗi thời.
 */
const SEED_TRIP = 'TRIP-2026-0914'
const WRITE = { timeout: 5000 }

/** Mã kiện điểm `stop` theo `unloadingOrder` của bản duyệt mới nhất, đọc thẳng từ kho. */
async function approvedUnloadOrder(tripId: string, stop: number) {
  const approved = (await getMockDb().listRevisions(tripId)).findLast((revision) => revision.approvedAt !== undefined)
  const prefixes = approved?.request.packages.filter((pkg) => pkg.deliveryStop === stop).map((pkg) => `${pkg.id}-`) ?? []
  return (approved?.result.placements ?? [])
    .filter((p) => prefixes.some((prefix) => p.packageInstanceId.startsWith(prefix)))
    .toSorted((a, b) => a.unloadingOrder - b.unloadingOrder)
    .map((p) => p.packageInstanceId)
}

function rowIds(container: HTMLElement) {
  return [...container.querySelectorAll('li[data-package-id]')].map((row) => row.getAttribute('data-package-id'))
}

/** Chuyến hai thùng của tài xế demo, đã duyệt và kho đã xếp xong: `missing` là các kiện kho báo thiếu. */
async function loadedTwoCartonTrip(missing: string[] = []) {
  const db = getMockDb()
  const trip = await db.createTrip({ ...twoCartonTrip(), driverId: 'US-0004' })
  const revision = await db.addRevision({ tripId: trip.id, request: twoCartonRequest(), result: twoCartonResult() })
  await db.approveRevision(revision.id, [])
  await db.startLoading(trip.id)
  for (const id of ['PKG-001-01', 'PKG-002-01']) await db.recordLoadingStep(trip.id, { packageInstanceId: id, outcome: missing.includes(id) ? 'missing' : 'loaded' })
  await db.completeLoading(trip.id)
  return trip.id
}

test('without a trip the screen goes back to My trips', async () => {
  renderDriver('/tai-xe/diem-giao')
  expect(await screen.findByRole('heading', { level: 1, name: 'Chuyến của tôi' }, LOAD)).toBeInTheDocument()
}, 15_000)

test('a trip the warehouse has not loaded: preview of stop 1 in the approved unloading order, call and directions, nothing to start', async () => {
  const { container } = renderDriver(`/tai-xe/diem-giao?chuyen=${SEED_TRIP}`)
  expect(await screen.findByRole('heading', { level: 1, name: 'Điểm 1 / 4' }, LOAD)).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Kho chưa xếp xong chuyến này: bạn xem trước được, chưa bắt đầu giao được.')
  const expected = await approvedUnloadOrder(SEED_TRIP, 1)
  expect(expected).toHaveLength(38)
  expect(rowIds(container)).toStrictEqual(expected)
  expect(screen.queryByRole('button', { name: /^Đánh dấu đã dỡ/ })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Gọi Chị Hương' })).toHaveAttribute('href', 'tel:02837751122')
  expect(screen.getByText('Chị Hương · 0283 775 1122')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Chỉ đường tới Công ty TNHH Thực phẩm Sài Gòn' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Xem vị trí hàng' })).toBeInTheDocument()
  expect(container.querySelectorAll('a.text-on-primary, button.text-on-primary')).toHaveLength(0)
  expect(screen.getByRole('link', { name: 'Về danh sách chuyến' })).toHaveAttribute('href', '/tai-xe')
}, 15_000)

test("another driver's trip is not shown: the store answers not found", async () => {
  renderDriver('/tai-xe/diem-giao?chuyen=TRIP-009')
  expect(await screen.findByText('Không tải được chuyến', {}, LOAD)).toBeInTheDocument()
  expect(screen.getByText('Không tìm thấy TRIP-009.')).toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: 'Về danh sách chuyến' }).map((link) => link.getAttribute('href'))).toStrictEqual(['/tai-xe', '/tai-xe'])
}, 15_000)

test('packages missing at the warehouse are not on the list and a notice says so', async () => {
  const tripId = await loadedTwoCartonTrip(['PKG-002-01'])
  renderDriver(`/tai-xe/diem-giao?chuyen=${tripId}`)
  expect(await screen.findByRole('heading', { level: 1, name: 'Điểm 1 / 3' }, LOAD)).toBeInTheDocument()
  expect(screen.getByText('Kho báo thiếu 1 kiện của điểm này: không có trên xe, không cần dỡ.')).toBeInTheDocument()
  expect(screen.getByText('Không có kiện nào của điểm giao này trên xe.')).toBeInTheDocument()
}, 15_000)

test('the driver delivers a trip: start, unload, a stop with nothing on board, an issue, then the trip summary', async () => {
  const tripId = await loadedTwoCartonTrip()
  const { container } = renderDriver(`/tai-xe/diem-giao?chuyen=${tripId}`)
  expect(await screen.findByRole('heading', { level: 1, name: 'Điểm 1 / 3' }, LOAD)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Bắt đầu giao' }))

  // Điểm 1: PKG-002-01. Chưa dỡ thì chưa hoàn tất được
  const complete = await screen.findByRole('button', { name: 'Hoàn tất điểm giao' }, WRITE)
  expect(complete).toBeDisabled()
  expect(screen.getByText('Còn 1 kiện chưa dỡ hoặc chưa báo sự cố')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Đánh dấu đã dỡ PKG-002-01' }))
  const row = container.querySelector('li[data-package-id="PKG-002-01"]') as HTMLElement
  expect(row).toHaveAttribute('data-state', 'unloaded')
  expect(row).toHaveClass('bg-badge-success-bg')
  expect(within(row).getByText('Đã dỡ')).toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Hoàn tất điểm giao' })).toBeEnabled(), WRITE)
  await userEvent.click(screen.getByRole('button', { name: 'Hoàn tất điểm giao' }))
  expect(await screen.findByRole('heading', { level: 1, name: 'Điểm 2 / 3' }, WRITE)).toBeInTheDocument()
  expect(toast.success).toHaveBeenCalledWith('Đã hoàn tất điểm giao 1', { description: 'Chuyển sang điểm giao 2.' })

  // Điểm 2 không có kiện nào
  expect(screen.getByText('Mọi kiện của điểm này đã dỡ hoặc đã báo sự cố.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Hoàn tất điểm giao' }))
  expect(await screen.findByRole('heading', { level: 1, name: 'Điểm 3 / 3' }, WRITE)).toBeInTheDocument()

  // Điểm 3: khách từ chối PKG-001-01; "Khác" mà không ghi chú thì không ghi
  await userEvent.click(screen.getByRole('button', { name: 'Báo sự cố' }))
  const dialog = within(screen.getByRole('dialog', { name: 'Báo sự cố tại điểm 3' }))
  expect(dialog.getByRole('combobox', { name: 'Kiện' })).toHaveValue('PKG-001-01')
  await userEvent.click(dialog.getByRole('radio', { name: 'Khác' }))
  await userEvent.click(dialog.getByRole('button', { name: 'Ghi sự cố' }))
  expect(await dialog.findByText('Chọn Khác thì cần ghi chú.')).toBeInTheDocument()
  await userEvent.click(dialog.getByRole('radio', { name: 'Khách từ chối' }))
  await userEvent.type(dialog.getByRole('textbox', { name: 'Ghi chú' }), 'Khách đổi đơn')
  await userEvent.click(dialog.getByRole('button', { name: 'Ghi sự cố' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), WRITE)
  expect(toast.success).toHaveBeenCalledWith('Đã ghi sự cố cho PKG-001-01')
  const refused = container.querySelector('li[data-package-id="PKG-001-01"]') as HTMLElement
  expect(refused).toHaveAttribute('data-state', 'issue')
  expect(within(refused).getByText('Sự cố: Khách từ chối')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Hoàn tất điểm giao' }))
  expect(await screen.findByRole('heading', { level: 1, name: 'Tổng kết chuyến' }, WRITE)).toBeInTheDocument()
  expect(screen.getByText(`Đã giao xong chuyến ${tripId}`)).toBeInTheDocument()
  expect(screen.getByText('Số điểm giao').nextSibling).toHaveTextContent('3')
  expect(screen.getByText('Kiện đã giao').nextSibling).toHaveTextContent('1')
  const issues = within(screen.getByRole('region', { name: 'Sự cố' }))
  expect(issues.getByText('Khách từ chối')).toBeInTheDocument()
  expect(issues.getByText('PKG-001-01 · Điểm 3')).toBeInTheDocument()
  expect(issues.getByText('Carton A')).toBeInTheDocument()
  expect(issues.getByText('Khách đổi đơn')).toBeInTheDocument()
  // Nút thoát ở thanh trên và nút chính ở chân màn đều về danh sách
  expect(screen.getAllByRole('link', { name: 'Về danh sách chuyến' }).map((link) => link.getAttribute('href'))).toStrictEqual(['/tai-xe', '/tai-xe'])

  const stored = await getMockDb().getTrip(tripId)
  expect([stored.phase, stored.delivery?.issues.map((issue) => [issue.kind, issue.packageInstanceId, issue.note, issue.reportedBy])]).toStrictEqual([
    'completed', [['refused', 'PKG-001-01', 'Khách đổi đơn', 'US-0004']],
  ])
}, 30_000)

test('verification at a stop (FE-6-03, FE-6-04): a package of another stop is explained; a manual confirmation blocks the stop until the dispatcher decides; a typed code unloads', async () => {
  const tripId = await loadedTwoCartonTrip()
  const db = getMockDb()
  const first = renderDriver(`/tai-xe/diem-giao?chuyen=${tripId}`)
  await screen.findByRole('heading', { level: 1, name: 'Điểm 1 / 3' }, LOAD)
  await userEvent.click(screen.getByRole('button', { name: 'Bắt đầu giao' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Đối chiếu kiện dỡ' }, WRITE))
  const dialog = within(screen.getByRole('dialog', { name: 'Đối chiếu kiện dỡ tại điểm 1' }))
  expect(screen.getByRole('dialog')).toHaveAccessibleDescription(/Điểm 1: đã dỡ 0 \/ 1 kiện\.$/)

  // Mức 2: gõ mã của bên gửi của kiện điểm 3 — nói kiện thuộc điểm nào, không ghi
  await userEvent.type(dialog.getByRole('textbox', { name: 'Mã QR hoặc mã bên gửi' }), 'PKG-001-01')
  await userEvent.click(dialog.getByRole('button', { name: 'Đối chiếu mã' }))
  expect(await dialog.findByRole('alert', {}, WRITE)).toHaveTextContent(
    'Kiện PKG-001-01 (Carton A) thuộc điểm 3 · Siêu thị Co.opmart Biên Hoà, không phải điểm này. Chưa ghi gì — để kiện lại trên xe.',
  )
  expect((await db.getTrip(tripId)).delivery?.stops[0]?.unloadedIds).toStrictEqual([])

  // Mức 3: kiện duy nhất chờ dỡ của điểm được chọn sẵn; tài xế không có nút in lại nhãn
  await userEvent.click(dialog.getByRole('tab', { name: 'Xác nhận tay' }))
  expect(dialog.getByRole('radio', { name: /PKG-002-01/ })).toBeChecked()
  expect(dialog.queryByRole('link', { name: /^In lại nhãn/ })).not.toBeInTheDocument()
  await userEvent.click(dialog.getByRole('radio', { name: 'QR không đọc được' }))
  await userEvent.click(dialog.getByRole('button', { name: 'Gửi xác nhận tay' }))
  // Hết kiện chờ dỡ của điểm: hộp tự đóng
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), WRITE)
  expect(toast.warning).toHaveBeenCalledWith('Đã ghi xác nhận tay PKG-002-01', { description: 'Chờ điều phối viên duyệt trước khi hoàn tất điểm giao.' })
  const row = () => first.container.querySelector('li[data-package-id="PKG-002-01"]') as HTMLElement
  await waitFor(() => expect(row()).toHaveAttribute('data-state', 'unloaded'), WRITE)
  expect(within(row()).getByText('Đã dỡ · xác nhận tay, chờ duyệt')).toBeInTheDocument()

  // Còn xác nhận tay chờ duyệt: chưa hoàn tất điểm được, lý do ngay trên nút
  const complete = screen.getByRole('button', { name: 'Hoàn tất điểm giao' })
  expect(complete).toBeDisabled()
  expect(complete).toHaveAccessibleDescription('Còn 1 xác nhận tay của điểm này chờ điều phối viên duyệt — chưa hoàn tất điểm giao được.')
  first.unmount()

  // Điều phối viên từ chối: kiện quay về chưa dỡ, kèm lý do để kiểm lại
  db.restoreSession('US-0001')
  await db.rejectManualConfirmation(tripId, 'VF-001', 'Gọi khách đếm lại số kiện')
  const { container } = renderDriver(`/tai-xe/diem-giao?chuyen=${tripId}`)
  await screen.findByRole('heading', { level: 1, name: 'Điểm 1 / 3' }, LOAD)
  const rejected = container.querySelector('li[data-package-id="PKG-002-01"]') as HTMLElement
  expect(rejected).toHaveAttribute('data-state', 'pending')
  expect(within(rejected).getByRole('alert')).toHaveTextContent('Điều phối viên từ chối xác nhận tay, kiểm lại kiện này. Lý do: Gọi khách đếm lại số kiện')
  expect(screen.getByRole('button', { name: 'Hoàn tất điểm giao' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Hoàn tất điểm giao' })).not.toHaveAccessibleDescription()

  // Gõ mã của bên gửi (duy nhất trong chuyến): kiểm như quét, không cần duyệt
  await userEvent.click(screen.getByRole('button', { name: 'Đối chiếu kiện dỡ' }))
  const again = within(screen.getByRole('dialog'))
  await userEvent.type(again.getByRole('textbox', { name: 'Mã QR hoặc mã bên gửi' }), 'pkg-002-01')
  await userEvent.click(again.getByRole('button', { name: 'Đối chiếu mã' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), WRITE)
  expect(toast.success).toHaveBeenCalledWith('Đã dỡ PKG-002-01')
  await waitFor(() => expect(container.querySelector('li[data-package-id="PKG-002-01"]')).toHaveAttribute('data-state', 'unloaded'), WRITE)
  expect(within(container.querySelector('li[data-package-id="PKG-002-01"]') as HTMLElement).getByText('Đã dỡ · gõ mã')).toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Hoàn tất điểm giao' })).toBeEnabled(), WRITE)
  expect((await db.getTrip(tripId)).verifications?.map((entry) => [entry.method, entry.manual?.status, entry.by])).toStrictEqual([
    ['MANUAL', 'MANUAL_REJECTED', 'US-0004'], ['CODE', undefined, 'US-0004'],
  ])
}, 40_000)

test('reopening a trip in delivery resumes at the first stop not completed', async () => {
  // TRIP-009 (seed): điểm 1 đã xong, điểm 2 dỡ được 25/50 kiện; tài xế của chuyến là Ngô Văn Bảo (US-0006)
  renderDriver('/tai-xe/diem-giao?chuyen=TRIP-009', 'US-0006')
  expect(await screen.findByRole('heading', { level: 1, name: 'Điểm 2 / 3' }, LOAD)).toBeInTheDocument()
  expect(screen.getByText('Cần dỡ 50 kiện · Đã dỡ 25 · Sự cố 0')).toBeInTheDocument()
  expect(screen.getByText('Còn 25 kiện chưa dỡ hoặc chưa báo sự cố')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Về danh sách chuyến' })).toHaveAttribute('href', '/tai-xe')
}, 15_000)

test('a stale approved plan still previews, with a warning', async () => {
  const db = getMockDb()
  const trip = await db.getTrip(SEED_TRIP)
  await db.updateTrip(SEED_TRIP, { packages: trip.packages.map((pkg, i) => (i === 0 ? { ...pkg, weightKg: pkg.weightKg + 1 } : pkg)) })
  renderDriver(`/tai-xe/diem-giao?chuyen=${SEED_TRIP}`)
  expect(await screen.findByRole('alert', {}, LOAD)).toHaveTextContent('Phương án đã duyệt này đã lỗi thời')
  expect(screen.getByRole('heading', { level: 1, name: 'Điểm 1 / 4' })).toBeInTheDocument()
}, 15_000)
