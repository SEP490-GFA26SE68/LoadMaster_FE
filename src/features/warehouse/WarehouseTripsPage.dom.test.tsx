import { screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { getMockDb } from '@/lib/mock-db'
import { LOAD, renderWarehouse } from './warehouse-test-utils'

/** Danh sách chuyến của kho (LM-086) trên seed neo 14/09. Test theo thứ tự: bài cuối sửa kho. */

function cardOf(tripId: string) {
  const heading = screen.getByRole('heading', { level: 2, name: tripId })
  return within(heading.closest('li') as HTMLElement)
}

test('in-progress trip first with Continue (110/280), then the approved trip, then the stale one without a start; one primary; exit signs out', async () => {
  const { container } = renderWarehouse('/kho')
  const list = await screen.findByRole('list', { name: 'Chuyến cần xếp' }, LOAD)
  expect(within(list).getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toStrictEqual(['TRIP-011', 'TRIP-2026-0914', 'TRIP-013'])

  const loading = cardOf('TRIP-011')
  expect(loading.getByText('Đã duyệt')).toBeInTheDocument()
  expect(loading.getByText('Kho đang xếp 110 / 280')).toBeInTheDocument()
  expect(loading.getByRole('link', { name: 'Tiếp tục (110/280)' })).toHaveAttribute('href', '/kho?chuyen=TRIP-011')
  expect(loading.getByRole('progressbar', { name: 'Tiến độ xếp chuyến TRIP-011' })).toHaveAttribute('aria-valuenow', '39')

  const approved = cardOf('TRIP-2026-0914')
  expect(approved.getByText('Đã duyệt')).toBeInTheDocument()
  expect(approved.getByText('14/09/2026')).toBeInTheDocument()
  expect(approved.getByText('Hyundai HD210 · 60C-446.32')).toBeInTheDocument()
  expect(approved.getByText('132')).toBeInTheDocument()
  expect(approved.getByText('0/132')).toBeInTheDocument()
  expect(approved.getByRole('link', { name: 'Bắt đầu xếp' })).toHaveAttribute('href', '/kho?chuyen=TRIP-2026-0914')

  const stale = cardOf('TRIP-013')
  expect(stale.getByText('Đã tối ưu')).toBeInTheDocument()
  expect(stale.getByText('Lỗi thời — cần tối ưu lại')).toBeInTheDocument()
  expect(stale.getByText(/^Phương án đã duyệt lỗi thời/)).toBeInTheDocument()
  expect(stale.queryByRole('link')).not.toBeInTheDocument()

  // Một nút primary: chuyến đang xếp dở
  expect(container.querySelectorAll('a.text-on-primary, button.text-on-primary')).toHaveLength(1)
  expect(loading.getByRole('link', { name: 'Tiếp tục (110/280)' })).toHaveClass('text-on-primary')
  expect(screen.getByRole('button', { name: 'Đăng xuất' })).toBeInTheDocument()
  // LM-096: nút tài khoản 56px mở hồ sơ cá nhân
  expect(screen.getByRole('button', { name: 'Tài khoản Lê Văn Hải' })).toHaveClass('size-14')
})

test('missing packages recorded at the warehouse show next to the progress', async () => {
  const db = getMockDb()
  await db.startLoading('TRIP-2026-0914')
  const plan = await db.getRevision('REV-002')
  const [first] = plan.result.placements.toSorted((a, b) => a.loadingOrder - b.loadingOrder)
  await db.recordLoadingStep('TRIP-2026-0914', { packageInstanceId: first?.packageInstanceId ?? '', outcome: 'missing' })

  renderWarehouse('/kho')
  await screen.findByRole('list', { name: 'Chuyến cần xếp' }, LOAD)
  const card = cardOf('TRIP-2026-0914')
  expect(card.getByText('1/132')).toBeInTheDocument()
  expect(card.getByText('· thiếu 1')).toBeInTheDocument()
  expect(card.getByRole('link', { name: 'Tiếp tục (1/132)' })).toBeInTheDocument()
}, 15_000)

test('nothing left to load: a real empty state, no made-up trips', async () => {
  const db = getMockDb()
  for (const tripId of ['TRIP-2026-0914', 'TRIP-011', 'TRIP-013']) await db.cancelTrip(tripId, 'Khách hoãn nhận hàng')
  renderWarehouse('/kho')
  expect(await screen.findByText('Không có chuyến cần xếp', {}, LOAD)).toBeInTheDocument()
  expect(screen.getByText('Chuyến có phương án đã duyệt sẽ hiện ở đây để kho bắt đầu xếp.')).toBeInTheDocument()
  expect(screen.queryByRole('list', { name: 'Chuyến cần xếp' })).not.toBeInTheDocument()
}, 15_000)
