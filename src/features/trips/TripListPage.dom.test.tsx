import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { expect, test } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { signedInAs } from '@/test/signed-in'
import { TripListPage } from './TripListPage'

const SLOW = { timeout: 4000 }

/** Seam: kho dùng chung (seed neo 14/09/2026) → `trips-api.ts` → hook → danh sách, trạng thái lọc trên URL (D-52). */
function renderList(url = '/chuyen') {
  signedInAs('dispatcher')
  const router = createMemoryRouter(
    [
      { path: '/chuyen', element: <TripListPage /> },
      { path: '/chuyen/:tripId', element: <p>Chi tiết chuyến</p> },
    ],
    { initialEntries: [url] },
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nProvider>
      <AuthProvider>
        <QueryClientProvider client={client}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </AuthProvider>
    </I18nProvider>,
  )
  return { user: userEvent.setup(), router }
}

/** Dòng chuyến (có liên kết mã chuyến), bỏ dòng tiêu đề cột và dòng nhóm ngày chạy. */
function tripRows() {
  return screen.getAllByRole('row').filter((row) => within(row).queryByRole('link') !== null)
}

/** Mã chuyến của các dòng dữ liệu, theo thứ tự hiện trên bảng. */
function tripIds() {
  return tripRows().map((row) => within(row).getByRole('link').textContent)
}

/** Chữ của các dòng (dòng nhóm và dòng chuyến) theo thứ tự trên bảng, bỏ dòng tiêu đề cột. */
function rowTexts() {
  return screen.getAllByRole('row').slice(1).map((row) => row.textContent ?? '')
}

test('newest run date first, grouped by run date with a trip count, driver and lifecycle status on every row', async () => {
  renderList()
  const first = await screen.findByRole('row', { name: /TRIP-014/ }, SLOW)
  expect(tripIds()[0]).toBe('TRIP-014')
  // Seed: TRIP-014 chạy 16/09 (Thứ Tư), một mình một ngày; ngày neo 14/09 có 4 chuyến
  const [group, row] = rowTexts()
  expect(group).toMatch(/^Thứ Tư, 16\/09(\/2026)?1 chuyến$/)
  expect(row).toBe(first.textContent)
  expect(rowTexts().find((text) => text.includes('14/09'))).toMatch(/Thứ Hai, 14\/09(\/2026)?4 chuyến$/)
  expect(first).toHaveTextContent('Chưa gán tài xế')
  expect(first).toHaveTextContent('Nháp')
  expect(first).toHaveTextContent('2 điểm · ')
  expect(screen.getByRole('row', { name: /TRIP-2026-0914/ })).toHaveTextContent(/Hyundai HD210\s*60C-446\.32/)
  expect(screen.getByRole('row', { name: /TRIP-009/ })).toHaveTextContent('Đang vận chuyển')
  // Dòng phụ dưới chip (FE-0-05): phương án đã duyệt / chờ duyệt / lỗi thời dưới Đã lập kế hoạch, tiến độ kho dưới Đang xếp hàng
  expect(screen.getByRole('row', { name: /TRIP-2026-0914/ })).toHaveTextContent('Đã lập kế hoạchĐã duyệt')
  expect(screen.getByRole('row', { name: /TRIP-012/ })).toHaveTextContent('Đã lập kế hoạchChờ duyệt')
  expect(screen.getByRole('row', { name: /TRIP-013/ })).toHaveTextContent('Đã lập kế hoạchLỗi thời — cần tối ưu lại')
  expect(screen.getByRole('row', { name: /TRIP-011/ })).toHaveTextContent('Đang xếp hàngĐang xếp 110 / 280')
  expect(screen.getByRole('row', { name: /TRIP-010/ })).toHaveTextContent('Đang xếp hàngXếp xong — chờ xuất phát')
  expect(screen.getByRole('row', { name: /TRIP-001/ })).toHaveTextContent('Đã giao')
  expect(screen.getByRole('row', { name: /TRIP-004/ })).toHaveTextContent('Đã huỷ')
  expect(screen.getByRole('button', { name: 'Nhóm theo ngày chạy · mới nhất trước' })).toBeInTheDocument()
})

test('sorting by another column drops the date groups; the grouping button brings them back and flips the order', async () => {
  const { user, router } = renderList()
  await screen.findByRole('row', { name: /TRIP-014/ }, SLOW)
  await user.click(screen.getByRole('button', { name: 'Kiện' }))
  expect(screen.getByRole('columnheader', { name: 'Kiện' })).toHaveAttribute('aria-sort', 'descending')
  expect(rowTexts()).toHaveLength(15)
  expect(tripIds()[0]).toBe('TRIP-008')

  await user.click(screen.getByRole('button', { name: 'Nhóm theo ngày chạy' }))
  expect(router.state.location.search).toBe('')
  expect(tripIds()[0]).toBe('TRIP-014')
  await user.click(screen.getByRole('button', { name: 'Nhóm theo ngày chạy · mới nhất trước' }))
  expect(router.state.location.search).toBe('?sap-xep=scheduledDate')
  expect(tripIds()[0]).toBe('TRIP-001')
  expect(screen.getByRole('button', { name: 'Nhóm theo ngày chạy · cũ nhất trước' })).toBeInTheDocument()
})

test('filters read from the URL: status, and a driver-less trip through the driver chip', async () => {
  const { user, router } = renderList('/chuyen?trang-thai=dang-van-chuyen')
  await screen.findByRole('row', { name: /TRIP-009/ }, SLOW)
  expect(tripIds()).toStrictEqual(['TRIP-009'])
  expect(screen.getByRole('tab', { name: /^Đang vận chuyển/ })).toHaveAttribute('aria-selected', 'true')

  await user.click(screen.getByRole('button', { name: 'Xoá lọc' }))
  const driver = screen.getByRole('combobox', { name: 'Tài xế' })
  expect(driver).toHaveTextContent('Tài xế: tất cả')
  await user.click(driver)
  await user.click(await screen.findByRole('option', { name: 'Chưa gán' }))
  expect(tripIds()).toStrictEqual(['TRIP-014'])
  expect(router.state.location.search).toBe('?tai-xe=chua-gan')
  expect(driver).toHaveTextContent('Tài xế: Chưa gán')
})

test('the run-date chip opens the two date fields; a date filter on the URL opens them and names the range', async () => {
  const { user } = renderList('/chuyen?tu=2026-09-14&den=2026-09-14')
  await screen.findByRole('row', { name: /TRIP-2026-0914/ }, SLOW)
  const chip = screen.getByRole('button', { name: 'Ngày chạy: 14/09/2026 – 14/09/2026' })
  expect(chip).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByLabelText('Từ ngày')).toHaveValue('2026-09-14')
  expect(tripIds().toSorted()).toStrictEqual(['TRIP-009', 'TRIP-010', 'TRIP-011', 'TRIP-2026-0914'])

  await user.click(chip)
  expect(screen.queryByLabelText('Từ ngày')).toBeNull()
})

test('a saved link with an old status value still filters and lights the matching tab', async () => {
  // `da_duyet` của LM-104 nay là Đã lập kế hoạch: chuyến chính (đã duyệt), TRIP-012 (chờ duyệt), TRIP-013 (lỗi thời)
  renderList('/chuyen?trang-thai=da_duyet')
  await screen.findByRole('row', { name: /TRIP-2026-0914/ }, SLOW)
  expect(tripIds().toSorted()).toStrictEqual(['TRIP-012', 'TRIP-013', 'TRIP-2026-0914'])
  expect(screen.getByRole('tab', { name: /^Đã lập kế hoạch/ })).toHaveAttribute('aria-selected', 'true')
})

test('the stats line counts the whole store; tabs are the six statuses, filter on the URL, and their counts follow the other filters', async () => {
  const { user, router } = renderList()
  await screen.findByRole('row', { name: /TRIP-014/ }, SLOW)
  // Seed (FE-0-05): 15 chuyến; TRIP-014 nháp; chuyến chính (đã duyệt), TRIP-012 (chờ duyệt), TRIP-013 (lỗi thời) đã lập kế hoạch;
  // TRIP-011/010 kho đang xếp / xếp xong; TRIP-009 đang vận chuyển; 7 đã giao; TRIP-004 đã huỷ
  expect(screen.getByRole('heading', { name: 'Chuyến hàng' }).closest('header')).toHaveTextContent('15 chuyến·1 đang vận chuyển·2 cần bạn xử lý')
  const tabs = within(screen.getByRole('tablist', { name: 'Trạng thái của chuyến' })).getAllByRole('tab')
  // Tab Đã lập kế hoạch: số của tab, rồi số hổ phách chuyến cần người dùng (chờ duyệt + lỗi thời)
  expect(tabs.map((item) => item.getAttribute('aria-selected'))).toStrictEqual(['true', 'false', 'false', 'false', 'false', 'false', 'false'])
  const names = [/^Tất cả\s*15$/, /^Nháp\s*1$/, /^Đã lập kế hoạch\s*3\s*2 cần bạn xử lý$/, /^Đang xếp hàng\s*2$/, /^Đang vận chuyển\s*1$/, /^Đã giao\s*7$/, /^Đã huỷ\s*1$/]
  expect(tabs).toHaveLength(names.length)
  for (const [index, name] of names.entries()) expect(tabs[index]).toHaveAccessibleName(name)
  const tab = (name: RegExp) => screen.getByRole('tab', { name })

  await user.click(tab(/^Đang xếp hàng/))
  expect(router.state.location.search).toBe('?trang-thai=dang-xep-hang')
  expect(tripIds().toSorted()).toStrictEqual(['TRIP-010', 'TRIP-011'])
  expect(tab(/^Đang xếp hàng/)).toHaveAttribute('aria-selected', 'true')

  // Chọn một tài xế: số trên tab đếm lại theo bộ lọc đó, dòng số dưới tiêu đề vẫn là cả kho
  await user.click(screen.getByRole('combobox', { name: 'Tài xế' }))
  await user.click(await screen.findByRole('option', { name: 'Phạm Quốc Dũng' }))
  expect(tab(/^Tất cả/)).toHaveAccessibleName(/^Tất cả\s*4$/)
  expect(tripIds()).toStrictEqual(['TRIP-010'])
  // Chuyến đã lập kế hoạch của tài xế này là chuyến chính, phương án đã duyệt: không còn số hổ phách
  expect(tab(/^Đã lập kế hoạch/)).toHaveAccessibleName(/^Đã lập kế hoạch\s*1$/)
  expect(screen.getByRole('heading', { name: 'Chuyến hàng' }).closest('header')).toHaveTextContent('15 chuyến·1 đang vận chuyển·2 cần bạn xử lý')

  await user.click(tab(/^Tất cả/))
  expect(router.state.location.search).toBe('?tai-xe=US-0004')
})

test('search ignores diacritics and covers the driver name', async () => {
  const { user } = renderList()
  const search = await screen.findByRole('searchbox', { name: 'Tìm theo mã, tên, tuyến, xe, tài xế' }, SLOW)
  await user.type(search, 'quoc dung')
  expect(tripIds().toSorted()).toStrictEqual(['TRIP-002', 'TRIP-007', 'TRIP-010', 'TRIP-2026-0914'])
})
