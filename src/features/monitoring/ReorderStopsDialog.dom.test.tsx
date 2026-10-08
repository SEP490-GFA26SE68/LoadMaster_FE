import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { Toaster } from 'sonner'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb, MockDbError } from '@/lib/mock-db'
import { signedInAs } from '@/test/signed-in'
import { MonitoringPage } from './MonitoringPage'

/**
 * Hộp "Đổi thứ tự điểm" của màn Giám sát (FE-BL-03) trên kho mock thật. `TRIP-009` có điểm 1 đã giao xong và xe đang đứng ở điểm 2; điều
 * phối viên duyệt một yêu cầu nhận hàng dọc đường có điểm giao riêng nên còn ba điểm chưa giao: STOP-04 (nhận), STOP-05 (giao), STOP-03.
 * Luật của kho (khả năng dỡ, điểm cố định, điểm nhận trước điểm giao) kiểm ở `reorder-stops.test.ts`; ở đây kiểm hộp nối đúng kho và nói
 * đúng lời từ chối. Đồng hồ chỉ giả `Date`, đứng yên ở 12:00 ngày neo.
 */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-14T05:00:00.000Z'))
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

const SLOW = { timeout: 8000 }
const TRIP = 'TRIP-009'

let approved: Promise<void> | undefined
/** Duyệt yêu cầu nhận hàng một lần cho cả file: kho là một thể duy nhất của tab. */
function approvePickupOnce() {
  approved ??= (async () => {
    const db = getMockDb()
    db.restoreSession('US-0001')
    const request = await db.createPickupRequest(TRIP, {
      pickup: { name: 'Xưởng may Hoàng Gia', address: 'Đường số 4, KCN VSIP 1, Thuận An, Bình Dương', lat: 10.928, lng: 106.712 },
      delivery: { name: 'Kho Dĩ An', address: '1 Quốc lộ 1K, Dĩ An', lat: 10.9, lng: 106.73 },
      packages: [{ packageCode: 'HG-0501', lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 12, handlingClass: 'STANDARD' }],
    })
    await db.approvePickupRequest(TRIP, request.id, { overrideReason: 'Khách quen' })
  })()
  return approved
}

async function openDialog() {
  await approvePickupOnce()
  signedInAs('dispatcher')
  const router = createMemoryRouter([{ path: '/giam-sat', element: <MonitoringPage /> }, { path: '/chuyen/:tripId', element: null }], { initialEntries: ['/giam-sat'] })
  render(
    <I18nProvider>
      <AuthProvider>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <RouterProvider router={router} />
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </I18nProvider>,
  )
  await userEvent.click(await screen.findByRole('button', { name: 'Đổi thứ tự điểm' }, SLOW))
  const dialog = await screen.findByRole('dialog')
  return within(dialog)
}

const orderInStore = async () => (await getMockDb().getTrip(TRIP)).stops.map((stop) => stop.id)

test('a stop already done or reached cannot be moved; moving a free stop and applying changes the order of the trip', async () => {
  const dialog = await openDialog()
  const stops = within(dialog.getByRole('list', { name: 'Thứ tự các điểm' })).getAllByRole('listitem')
  expect(stops).toHaveLength(5)
  expect(stops[0]).toHaveTextContent('Đã giao xong')
  expect(stops[1]).toHaveTextContent('Xe đã tới')
  // Hai điểm đầu khoá: không có nút dời; điểm nhận đứng ngay dưới điểm xe đã tới nên chưa lên được
  expect(within(stops[0]!).queryByRole('button')).not.toBeInTheDocument()
  expect(within(stops[1]!).queryByRole('button')).not.toBeInTheDocument()
  expect(within(stops[2]!).getByRole('button', { name: /^Dời .+ lên$/ })).toBeDisabled()
  expect(dialog.getByRole('button', { name: 'Áp dụng thứ tự mới' })).toBeDisabled()

  // Điểm 3 cũ (cuối danh sách) lên trước điểm giao của kiện nhận
  await userEvent.click(within(stops[4]!).getByRole('button', { name: /^Dời .+ lên$/ }))
  await userEvent.click(dialog.getByRole('button', { name: 'Áp dụng thứ tự mới' }))
  expect(await screen.findByText('Đã đổi thứ tự điểm giao của chuyến TRIP-009.', undefined, SLOW)).toBeInTheDocument()
  expect(await orderInStore()).toStrictEqual(['STOP-01', 'STOP-02', 'STOP-04', 'STOP-03', 'STOP-05'])
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('a refusal names every blocked package with its stop, in words, and leaves the order as it was', async () => {
  const before = await orderInStore()
  vi.spyOn(getMockDb(), 'reorderRunningStops').mockRejectedValueOnce(
    new MockDbError('STOP_ORDER_BLOCKS_CARGO', { tripId: TRIP, packages: ['PKG-003-12', 'HG-0501'], stopIds: ['STOP-03', 'STOP-05'] }),
  )
  const dialog = await openDialog()
  const stops = within(dialog.getByRole('list', { name: 'Thứ tự các điểm' })).getAllByRole('listitem')
  await userEvent.click(within(stops[4]!).getByRole('button', { name: /^Dời .+ lên$/ }))
  await userEvent.click(dialog.getByRole('button', { name: 'Áp dụng thứ tự mới' }))

  const blocked = within(await dialog.findByRole('list', { name: 'Kiện bị chắn' }, SLOW)).getAllByRole('listitem')
  expect(blocked).toHaveLength(2)
  expect(blocked[0]).toHaveTextContent(/^PKG-003-12 — điểm \d · .+/)
  expect(blocked[1]).toHaveTextContent(/^HG-0501 — điểm \d · Kho Dĩ An/)
  expect(dialog.getByText('Thứ tự điểm giữ nguyên.')).toBeInTheDocument()
  expect(await orderInStore()).toStrictEqual(before)
})
