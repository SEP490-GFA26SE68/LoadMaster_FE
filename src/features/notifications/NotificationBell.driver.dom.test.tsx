import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb } from '@/lib/mock-db'
import { signedInAs, type SeedUserId } from '@/test/signed-in'
import type { Role } from '@/types/user'
import { NotificationBell } from './NotificationBell'

/**
 * Chuông của tài xế ở thanh màn "Chuyến của tôi" (`variant="touch"`): việc của chuyến chính họ chạy — kho bắt đầu soạn hàng (chuyến mới),
 * xếp xong, chuyến bị huỷ, đổi tài xế — nói bằng câu của tài xế và mở màn điểm giao của chuyến. Kho dùng chung (seed neo 14/09/2026), đồng
 * hồ chỉ giả `Date`: 18:00 ngày neo. Tài xế demo Phạm Quốc Dũng (US-0004) có sẵn hai thông báo của TRIP-010 (kho soạn rồi xếp xong sáng
 * 14/09). Việc của người khác giả lập bằng cách đổi phiên của kho như một người dùng khác đang thao tác.
 */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-14T11:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

const SLOW = { timeout: 4000 }

function Elsewhere() {
  const location = useLocation()
  return <output aria-label="route">{location.pathname + location.search}</output>
}

function renderTouchBell(account: Role | SeedUserId) {
  const user = signedInAs(account)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={['/']}>
            <NotificationBell variant="touch" />
            <Routes>
              <Route path="*" element={<Elsewhere />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
  return user
}

/** Làm một việc như người dùng `userId` đang đăng nhập ở máy khác, rồi trả phiên cho người đang xem. */
async function actAs<T>(userId: string, backTo: string, action: () => Promise<T>) {
  const db = getMockDb()
  db.restoreSession(userId)
  try {
    return await action()
  } finally {
    db.restoreSession(backTo)
  }
}

const menuItems = () => within(screen.getByRole('menu')).getAllByRole('menuitem').filter((item) => item.querySelector('time'))
const part = (item: Element, name: string) => item.querySelector(`[data-part="${name}"]`)?.textContent

/** Các dòng thông báo: câu, chuyến, người làm và chi tiết, nơi mở. */
const notificationRows = () => menuItems().map((item) => ({
  text: [part(item, 'action'), part(item, 'target')],
  meta: part(item, 'meta'),
  href: item.getAttribute('href'),
}))

const TRIP_010 = 'Tuyến Thủ Đức – An Phú – Phú Nhuận · TRIP-010'
const TRIP_011 = 'Tuyến Tân Bình – Q.1 – Q.7 · TRIP-011'

test('the driver is told in their own words when the warehouse starts staging a trip of theirs, and the notice opens that trip', async () => {
  const user = userEvent.setup()
  const driver = renderTouchBell('driver')
  await screen.findByRole('button', { name: 'Thông báo, 2 chưa đọc' }, SLOW)
  // Kho bắt đầu soạn hàng chuyến chính của tài xế demo; điều phối viên huỷ một chuyến còn lập kế hoạch của tài xế khác — không báo ai
  await actAs('US-0003', driver.id, () => getMockDb().startLoading('TRIP-2026-0914'))
  await actAs('US-0001', driver.id, () => getMockDb().cancelTrip('TRIP-012', 'Khách đổi lịch nhận hàng'))

  await user.click(screen.getByRole('button', { name: /^Thông báo/ }))
  await waitFor(() => expect(notificationRows()).toHaveLength(3), SLOW)
  // Chi tiết chỉ những gì tài xế cần: người làm, số kiện đã lên xe — không tên chính mình hay mã phương án
  expect(notificationRows()).toStrictEqual([
    {
      text: ['Chuyến mới: kho đang soạn hàng', 'Tuyến Q.7 – Thủ Dầu Một – Dĩ An – Biên Hoà · TRIP-2026-0914'],
      meta: 'Lê Văn Hải',
      href: '/tai-xe/diem-giao?chuyen=TRIP-2026-0914',
    },
    { text: ['Xếp xong — chờ bạn xuất phát', TRIP_010], meta: 'Lê Văn Hải · Đã lên xe: 210', href: '/tai-xe/diem-giao?chuyen=TRIP-010' },
    { text: ['Chuyến mới: kho đang soạn hàng', TRIP_010], meta: 'Lê Văn Hải', href: '/tai-xe/diem-giao?chuyen=TRIP-010' },
  ])
  // Màn cảm ứng: mọi chữ của danh sách 16 px
  expect(screen.getByRole('menu')).toHaveClass('[&_span]:text-body-lg!')

  await user.click(screen.getByRole('menuitem', { name: /^Chuyến mới: kho đang soạn hàng.*TRIP-2026-0914/ }))
  expect(await screen.findByRole('status', { name: 'route' })).toHaveTextContent('/tai-xe/diem-giao?chuyen=TRIP-2026-0914')
  expect(screen.getByRole('button', { name: 'Thông báo, 2 chưa đọc' })).toBeInTheDocument()
})

test('a driver put on a trip the warehouse is loading gets a new trip and its cancellation; the replaced driver is told the trip is gone and no notice opens it', async () => {
  const user = userEvent.setup()
  // Điều phối viên đưa Ngô Văn Bảo (US-0006) vào TRIP-011 — kho đang xếp — thay Đặng Hoài Nam (US-0007), rồi huỷ chuyến
  const driver = renderTouchBell('US-0006')
  await actAs('US-0001', driver.id, async () => {
    await getMockDb().updateTrip('TRIP-011', { driverId: 'US-0006' })
    await getMockDb().cancelTrip('TRIP-011', 'Xe hỏng máy lạnh')
  })
  await user.click(await screen.findByRole('button', { name: /^Thông báo/ }, SLOW))
  await waitFor(() => expect(notificationRows()[0]?.text[0]).toBe('Chuyến đã huỷ'), SLOW)
  expect(notificationRows().slice(0, 2)).toStrictEqual([
    { text: ['Chuyến đã huỷ', TRIP_011], meta: 'Nguyễn Thanh Tùng · Lý do: Xe hỏng máy lạnh · Đã lên xe: 110', href: '/tai-xe/diem-giao?chuyen=TRIP-011' },
    { text: ['Chuyến mới: bạn được giao chuyến này', TRIP_011], meta: 'Nguyễn Thanh Tùng', href: '/tai-xe/diem-giao?chuyen=TRIP-011' },
  ])
  await user.keyboard('{Escape}')
  cleanup()

  // Người bị thay: một câu nói chuyến không còn của mình; lần huỷ sau đó không tới anh; thông báo cũ của chuyến thôi mở chuyến
  renderTouchBell('US-0007')
  await user.click(await screen.findByRole('button', { name: /^Thông báo/ }, SLOW))
  await waitFor(() => expect(notificationRows()[0]?.text[0]).toBe('Bạn không còn chạy chuyến này'), SLOW)
  expect(notificationRows().filter((row) => row.text[1] === TRIP_011)).toStrictEqual([
    { text: ['Bạn không còn chạy chuyến này', TRIP_011], meta: 'Nguyễn Thanh Tùng', href: null },
    { text: ['Chuyến mới: kho đang soạn hàng', TRIP_011], meta: 'Đỗ Thị Hạnh', href: null },
  ])
})
