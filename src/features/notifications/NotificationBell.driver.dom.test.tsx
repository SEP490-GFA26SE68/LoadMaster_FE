import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { SPEC_CARTON_A_PLACEMENT } from '@/domain/fixtures/spec-samples'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb } from '@/lib/mock-db'
import { twoCartonRequest, twoCartonResult, twoCartonTrip } from '@/test/mock-db-samples'
import { signedInAs, type SeedUserId } from '@/test/signed-in'
import { stageAll } from '@/test/trip-flow'
import type { Role } from '@/types/user'
import { NotificationBell } from './NotificationBell'

/**
 * Chuông của tài xế ở thanh màn "Chuyến của tôi" (`variant="touch"`): việc của chuyến chính họ chạy — kho bắt đầu soạn hàng (chuyến mới),
 * xếp xong, chuyến tạm dừng vì quay về Đã lập kế hoạch rồi kho soạn lại, chuyến bị huỷ, đổi tài xế, quyết định với yêu cầu nhận hàng dọc
 * đường — nói bằng câu của tài xế và mở màn điểm giao của chuyến. Kho dùng chung (seed neo 14/09/2026), đồng hồ chỉ giả `Date`: 18:00 ngày
 * neo. Tài xế demo Phạm Quốc Dũng (US-0004) có sẵn hai thông báo của TRIP-010 (kho soạn rồi xếp xong sáng 14/09). Việc của người khác giả
 * lập bằng cách đổi phiên của kho như một người dùng khác đang thao tác.
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

/**
 * Điều phối viên duyệt một phương án dựng tay cho mọi kiện hiện có của chuyến hai thùng (`twoCartonTrip`). `stacked`: thùng giao điểm 1
 * (`PKG-002-01`) đặt lên thùng giao điểm 3 (`PKG-001-01`, xếp trước).
 */
async function approveTwoCartons(tripId: string, stacked: boolean) {
  const db = getMockDb()
  const trip = await db.getTrip(tripId)
  const ids = (await db.listTripLabels(tripId)).map((label) => label.packageInstanceId)
  const placements = ids.map((packageInstanceId, index) => stacked && index === 1
    ? { ...SPEC_CARTON_A_PLACEMENT, packageInstanceId, xCm: 120, yCm: 0, zCm: 45, loadingOrder: 2, unloadingOrder: 1 }
    : { ...SPEC_CARTON_A_PLACEMENT, packageInstanceId, xCm: 120 + index * 120, yCm: 0, zCm: 0, loadingOrder: index + 1, unloadingOrder: ids.length - index })
  const revision = await db.addRevision({ tripId, request: { ...twoCartonRequest(), packages: trip.packages }, result: { ...twoCartonResult(), placements } })
  await db.approveRevision(revision.id, [])
}

test('a loading trip sent back to planned tells its driver it is on hold; staging it again by a new plan tells them the warehouse restarted', async () => {
  const user = userEvent.setup()
  const driver = renderTouchBell('driver')
  const db = getMockDb()
  const tripId = await actAs('US-0001', driver.id, async () => {
    const { id } = await db.createTrip({ ...twoCartonTrip(), driverId: driver.id })
    await approveTwoCartons(id, true)
    return id
  })
  // Kho báo hỏng thùng dưới — thùng kia tựa lên nó: chuyến quay về Đã lập kế hoạch; điều phối viên duyệt phương án mới, kho soạn lại
  await actAs('US-0003', driver.id, async () => {
    await db.startLoading(tripId)
    await stageAll(db, tripId)
    await db.reportDamagedPackage(tripId, 'PKG-001-01')
  })
  await actAs('US-0001', driver.id, () => approveTwoCartons(tripId, false))
  await actAs('US-0003', driver.id, () => db.startLoading(tripId))

  await user.click(await screen.findByRole('button', { name: /^Thông báo/ }, SLOW))
  const trip = `Tuyến Thủ Đức – Dĩ An – Biên Hoà · ${tripId}`
  await waitFor(() => expect(notificationRows()[0]?.text).toStrictEqual(['Kho đang soạn lại hàng cho chuyến', trip]), SLOW)
  // Câu đã nói đủ: chi tiết chỉ còn người làm — không mã kiện, mã phương án, số kiện tựa lên hay lý do soạn lại
  const href = `/tai-xe/diem-giao?chuyen=${tripId}`
  expect(notificationRows().slice(0, 3)).toStrictEqual([
    { text: ['Kho đang soạn lại hàng cho chuyến', trip], meta: 'Lê Văn Hải', href },
    { text: ['Chuyến tạm dừng: kho báo kiện hỏng, chờ điều phối lập lại phương án', trip], meta: 'Lê Văn Hải', href },
    { text: ['Chuyến mới: kho đang soạn hàng', trip], meta: 'Lê Văn Hải', href },
  ])
}, 30_000)

test('the driver reads the decision on a pickup request of their trip: approved with the packages to pick up, rejected with the reason', async () => {
  const user = userEvent.setup()
  // Ngô Văn Bảo (US-0006) đang chạy TRIP-009; điều phối viên gửi hai yêu cầu nhận hàng, duyệt một (vượt luật kèm lý do), từ chối một
  const driver = renderTouchBell('US-0006')
  const db = getMockDb()
  const request = (packageCode: string) => db.createPickupRequest('TRIP-009', {
    pickup: { name: 'Xưởng may Hoàng Gia', address: 'Đường số 4, KCN VSIP 1, Thuận An, Bình Dương', lat: 10.928, lng: 106.712 },
    delivery: { name: 'Kho Dĩ An', address: '1 Quốc lộ 1K, Dĩ An', lat: 10.9, lng: 106.73 },
    packages: [{ packageCode, lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 12, handlingClass: 'STANDARD' }],
  })
  await actAs('US-0001', driver.id, async () => {
    const approved = await request('HG-0501')
    await db.approvePickupRequest('TRIP-009', approved.id, { overrideReason: 'Khách quen' })
    const rejected = await request('HG-0502')
    await db.rejectPickupRequest('TRIP-009', rejected.id, 'Xe không còn chỗ')
  })

  await user.click(await screen.findByRole('button', { name: /^Thông báo/ }, SLOW))
  await waitFor(() => expect(notificationRows()[0]?.text[0]).toBe('Yêu cầu nhận hàng dọc đường bị từ chối'), SLOW)
  // Số kiện phải nhận, lý do từ chối — không mã yêu cầu, số luật không đạt hay lý do vượt luật của điều phối viên
  const trip = 'Tuyến Thủ Dầu Một – Sóng Thần · TRIP-009'
  const href = '/tai-xe/diem-giao?chuyen=TRIP-009'
  expect(notificationRows().slice(0, 2)).toStrictEqual([
    { text: ['Yêu cầu nhận hàng dọc đường bị từ chối', trip], meta: 'Nguyễn Thanh Tùng · Lý do: Xe không còn chỗ', href },
    { text: ['Điều phối đã duyệt nhận hàng dọc đường — tuyến có thêm điểm nhận', trip], meta: 'Nguyễn Thanh Tùng · Số kiện: 1', href },
  ])
}, 20_000)
