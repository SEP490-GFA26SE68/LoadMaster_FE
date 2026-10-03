import { screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { getMockDb } from '@/lib/mock-db'
import { LOAD, renderWarehouse } from './warehouse-test-utils'

/** Danh sách chuyến của kho (LM-086) trên seed neo 14/09. Test theo thứ tự: bài cuối sửa kho. */

function cardOf(tripId: string) {
  const heading = screen.getByRole('heading', { level: 3, name: tripId })
  return within(heading.closest('li') as HTMLElement)
}

const tripsIn = (group: string) => within(screen.getByRole('list', { name: group })).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)

test('trips grouped by status (FE-6-01): loading with Continue (110/280), waiting to be staged, loaded, and the stale one without a start; one primary; exit signs out', async () => {
  const { container } = renderWarehouse('/kho')
  await screen.findByRole('list', { name: 'Đang xếp hàng' }, LOAD)
  expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toStrictEqual([
    'Đang xếp hàng', 'Chờ soạn', 'Xếp xong — chờ xuất phát', 'Chờ điều phối tối ưu lại',
  ])
  expect(['Đang xếp hàng', 'Chờ soạn', 'Xếp xong — chờ xuất phát', 'Chờ điều phối tối ưu lại'].map(tripsIn)).toStrictEqual([
    ['TRIP-011'], ['TRIP-2026-0914'], ['TRIP-010'], ['TRIP-013'],
  ])

  // Chip trạng thái và dòng phụ như mọi màn (FE-0-05)
  const loading = cardOf('TRIP-011')
  expect(loading.getByText('Đang xếp hàng')).toBeInTheDocument()
  expect(loading.getByText('Đang xếp 110 / 280')).toBeInTheDocument()
  expect(loading.getByRole('link', { name: 'Tiếp tục xếp (110/280)' })).toHaveAttribute('href', '/kho?chuyen=TRIP-011')
  expect(loading.getByRole('progressbar', { name: 'Tiến độ xếp chuyến TRIP-011' })).toHaveAttribute('aria-valuenow', '39')

  const approved = cardOf('TRIP-2026-0914')
  expect(approved.getByText('Đã lập kế hoạch')).toBeInTheDocument()
  expect(approved.getByText('Đã duyệt')).toBeInTheDocument()
  expect(approved.getByText('14/09/2026')).toBeInTheDocument()
  expect(approved.getByText('Hyundai HD210 · 60C-446.32')).toBeInTheDocument()
  expect(approved.getByText('132')).toBeInTheDocument()
  expect(approved.getByText('0/132')).toBeInTheDocument()
  expect(approved.getByRole('link', { name: 'Bắt đầu soạn hàng' })).toHaveAttribute('href', '/kho?chuyen=TRIP-2026-0914')

  // Xếp xong chờ tài xế xuất phát: kho còn mở lại được để ghi số seal
  const loaded = cardOf('TRIP-010')
  expect(loaded.getByText('Xếp xong — chờ xuất phát')).toBeInTheDocument()
  expect(loaded.getByText('210/210')).toBeInTheDocument()
  expect(loaded.getByText('Chưa ghi số seal.')).toBeInTheDocument()
  expect(loaded.getByRole('link', { name: 'Xem chuyến đã xếp' })).toHaveAttribute('href', '/kho?chuyen=TRIP-010')
  expect(loaded.getByRole('link', { name: 'Xem chuyến đã xếp' })).toHaveClass('h-14')

  const stale = cardOf('TRIP-013')
  expect(stale.getByText('Đã lập kế hoạch')).toBeInTheDocument()
  expect(stale.getByText('Lỗi thời — cần tối ưu lại')).toBeInTheDocument()
  expect(stale.getByText(/^Phương án đã duyệt lỗi thời/)).toBeInTheDocument()
  expect(stale.queryByRole('link')).not.toBeInTheDocument()

  // Một nút primary: chuyến đang xếp dở
  expect(container.querySelectorAll('a.text-on-primary, button.text-on-primary')).toHaveLength(1)
  expect(loading.getByRole('link', { name: 'Tiếp tục xếp (110/280)' })).toHaveClass('text-on-primary')
  expect(screen.getByRole('button', { name: 'Đăng xuất' })).toBeInTheDocument()
  // FE-3b-06: Tra cứu kiện mở từ màn chính của kho, nút phụ 56 px
  expect(screen.getByRole('link', { name: 'Tra cứu kiện' })).toHaveAttribute('href', '/tra-cuu-kien')
  expect(screen.getByRole('link', { name: 'Tra cứu kiện' })).toHaveClass('h-14')
  // FE-6-04: chuông 56px — xác nhận tay của mình bị điều phối viên từ chối
  expect(await screen.findByRole('button', { name: 'Thông báo' }, LOAD)).toHaveClass('size-14')
  // LM-096: nút tài khoản 56px mở hồ sơ cá nhân
  expect(screen.getByRole('button', { name: 'Tài khoản Lê Văn Hải' })).toHaveClass('size-14')
})

test('a trip being staged shows its staging progress and a reported shortage; dropped by the dispatcher, it waits to be optimized again (FE-6-02)', async () => {
  const db = getMockDb()
  await db.startLoading('TRIP-2026-0914')
  const plan = await db.getRevision('REV-002')
  const [first, second] = plan.result.placements.toSorted((a, b) => a.loadingOrder - b.loadingOrder).map((placement) => placement.packageInstanceId)
  const labels = await db.listTripLabels('TRIP-2026-0914')
  await db.confirmStagingByQr('TRIP-2026-0914', labels.find((label) => label.packageInstanceId === second)?.qrToken ?? '')
  await db.reportStagingShortage('TRIP-2026-0914', first ?? '')

  const view = renderWarehouse('/kho')
  await screen.findByRole('list', { name: 'Đang xếp hàng' }, LOAD)
  expect(tripsIn('Đang xếp hàng')).toStrictEqual(['TRIP-011', 'TRIP-2026-0914'])
  const card = cardOf('TRIP-2026-0914')
  expect(card.getByText('1/132')).toBeInTheDocument()
  expect(card.getByText('Thiếu kiện — chờ điều phối')).toBeInTheDocument()
  expect(card.getByRole('link', { name: 'Tiếp tục soạn (1/132)' })).toBeInTheDocument()
  view.unmount()

  db.restoreSession('US-0001')
  await db.resolveStagingShortage('TRIP-2026-0914', first ?? '', 'DROP')
  renderWarehouse('/kho')
  await screen.findByRole('list', { name: 'Chờ điều phối tối ưu lại' }, LOAD)
  expect(tripsIn('Chờ điều phối tối ưu lại')).toStrictEqual(['TRIP-2026-0914', 'TRIP-013'])
  const waiting = cardOf('TRIP-2026-0914')
  expect(waiting.getByText('Lỗi thời — cần tối ưu lại')).toBeInTheDocument()
  expect(waiting.getByText(/^Điều phối viên đã bỏ kiện thiếu khỏi chuyến TRIP-2026-0914\. Kiện đã soạn giữ nguyên ở khu chờ/)).toBeInTheDocument()
  expect(waiting.queryByRole('link')).not.toBeInTheDocument()
}, 20_000)

test('nothing left to load: a real empty state, no made-up trips', async () => {
  const db = getMockDb()
  for (const tripId of ['TRIP-2026-0914', 'TRIP-010', 'TRIP-011', 'TRIP-013']) await db.cancelTrip(tripId, 'Khách hoãn nhận hàng')
  renderWarehouse('/kho')
  expect(await screen.findByText('Không có chuyến cần xếp', {}, LOAD)).toBeInTheDocument()
  expect(screen.getByText('Chuyến có phương án đã duyệt sẽ hiện ở đây để kho bắt đầu soạn hàng.')).toBeInTheDocument()
  expect(screen.queryByRole('list')).not.toBeInTheDocument()
}, 15_000)
