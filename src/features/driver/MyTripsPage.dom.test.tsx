import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { LOAD, renderDriver } from './driver-test-utils'

/** "Chuyến của tôi" (LM-087) trên seed neo 14/09; các bài không ghi kho. */

function card(region: ReturnType<typeof within>, tripId: string) {
  return within(region.getByRole('heading', { level: 3, name: tripId }).closest('li') as HTMLElement)
}

test('the demo driver: the loaded trip to open, the main trip still at the warehouse, recent completed trips; exit signs out', async () => {
  const { container } = renderDriver('/tai-xe')
  const ready = within(await screen.findByRole('region', { name: 'Sẵn sàng giao' }, LOAD))
  const preparing = within(screen.getByRole('region', { name: 'Kho đang chuẩn bị' }))
  const recent = within(screen.getByRole('region', { name: 'Đã hoàn thành gần đây' }))
  expect(screen.getByRole('heading', { level: 1, name: 'Chuyến của tôi' })).toBeInTheDocument()

  expect(ready.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toStrictEqual(['TRIP-010'])
  const loaded = card(ready, 'TRIP-010')
  expect(loaded.getByText('Đã xếp xong')).toBeInTheDocument()
  expect(loaded.getByText('14/09/2026 · 3 điểm giao · 210 kiện')).toBeInTheDocument()
  expect(loaded.getByText('Isuzu NQR 550 · 51C-284.19')).toBeInTheDocument()
  expect(loaded.getByRole('link', { name: 'Mở chuyến' })).toHaveAttribute('href', '/tai-xe/diem-giao?chuyen=TRIP-010')

  const waiting = card(preparing, 'TRIP-2026-0914')
  expect(waiting.getByText('Kho chưa bắt đầu xếp — chưa giao được.')).toBeInTheDocument()
  expect(waiting.queryByRole('link')).not.toBeInTheDocument()

  expect(recent.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toStrictEqual(['TRIP-007', 'TRIP-002'])
  expect(card(recent, 'TRIP-007').getByText('· 1 sự cố')).toBeInTheDocument()
  expect(card(recent, 'TRIP-007').getByRole('link', { name: 'Xem tổng kết' })).toHaveAttribute('href', '/tai-xe/diem-giao?chuyen=TRIP-007')

  // Một nút primary: chuyến nên giao trước
  expect(container.querySelectorAll('a.text-on-primary, button.text-on-primary')).toHaveLength(1)
  expect(loaded.getByRole('link', { name: 'Mở chuyến' })).toHaveClass('text-on-primary')
  expect(screen.getByRole('button', { name: 'Đăng xuất' })).toBeInTheDocument()
  // LM-096: nút tài khoản 56px mở hồ sơ cá nhân
  expect(screen.getByRole('button', { name: 'Tài khoản Phạm Quốc Dũng' })).toHaveClass('size-14')
}, 15_000)

test('the driver of a trip in delivery continues it at its current stop; another driver sees the warehouse still loading theirs', async () => {
  // Chỉ tài xế mở được màn này (FE-0-01): mỗi người thấy chuyến của mình. Ngô Văn Bảo (US-0006) đang giao TRIP-009
  const delivering = renderDriver('/tai-xe', 'US-0006')
  const ready = within(await screen.findByRole('region', { name: 'Sẵn sàng giao' }, LOAD))
  expect(ready.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toStrictEqual(['TRIP-009'])
  expect(card(ready, 'TRIP-009').getByText('Đang giao điểm 2 / 3')).toBeInTheDocument()
  expect(card(ready, 'TRIP-009').getByRole('link', { name: 'Tiếp tục giao' })).toHaveClass('text-on-primary')
  delivering.unmount()

  // Đặng Hoài Nam (US-0007): kho đang xếp TRIP-011
  renderDriver('/tai-xe', 'US-0007')
  const preparing = within(await screen.findByRole('region', { name: 'Kho đang chuẩn bị' }, LOAD))
  expect(preparing.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toStrictEqual(['TRIP-011'])
  expect(card(preparing, 'TRIP-011').getByText('Kho đang xếp 110 / 280')).toBeInTheDocument()
  expect(card(preparing, 'TRIP-011').getByText('Kho đang xếp — chưa giao được.')).toBeInTheDocument()
  // Màn chính của tài xế: thoát là đăng xuất
  expect(screen.getByRole('button', { name: 'Đăng xuất' })).toBeInTheDocument()
}, 15_000)

test('opening a ready trip goes to its first stop, waiting for the driver to start', async () => {
  renderDriver('/tai-xe')
  const ready = within(await screen.findByRole('region', { name: 'Sẵn sàng giao' }, LOAD))
  await userEvent.click(card(ready, 'TRIP-010').getByRole('link', { name: 'Mở chuyến' }))
  expect(await screen.findByRole('heading', { level: 1, name: 'Điểm 1 / 3' }, LOAD)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Bắt đầu giao' })).toBeInTheDocument()
}, 15_000)
