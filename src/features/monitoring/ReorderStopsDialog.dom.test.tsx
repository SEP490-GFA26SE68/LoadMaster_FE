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
 * Hộp "Đổi thứ tự điểm" của màn Giám sát (FE-BL-03) trên kho mock thật. `TRIP-010` (xếp xong, ba điểm) được tài xế `US-0004` cho xuất
 * phát và đã tới điểm 1, nên còn hai điểm tự do: STOP-02, STOP-03. `TRIP-009` có điểm 1 đã giao xong và xe đang đứng ở điểm 2 nên chỉ
 * còn một điểm tự do. Luật của kho (khả năng dỡ, điểm cố định) kiểm ở `reorder-stops.test.ts`; ở đây kiểm hộp nối đúng kho và nói đúng
 * lời từ chối. Đồng hồ chỉ giả `Date`, đứng yên ở 12:00 ngày neo.
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
const TRIP = 'TRIP-010'

let departed: Promise<void> | undefined
/** Cho `TRIP-010` xuất phát và tới điểm 1 một lần cho cả file: kho là một thể duy nhất của tab. */
function departOnce() {
  departed ??= (async () => {
    const db = getMockDb()
    db.restoreSession('US-0004')
    await db.startDelivery(TRIP)
    await db.arriveAtStop(TRIP, 1)
  })()
  return departed
}

function renderBoard(tripId: string) {
  signedInAs('dispatcher')
  const router = createMemoryRouter(
    [{ path: '/giam-sat', element: <MonitoringPage /> }, { path: '/chuyen/:tripId', element: null }],
    { initialEntries: [`/giam-sat?chuyen=${tripId}`] },
  )
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
}

async function openDialog() {
  await departOnce()
  renderBoard(TRIP)
  await userEvent.click(await screen.findByRole('button', { name: 'Đổi thứ tự điểm' }, SLOW))
  const dialog = await screen.findByRole('dialog')
  return within(dialog)
}

const orderInStore = async () => (await getMockDb().getTrip(TRIP)).stops.map((stop) => stop.id)

test('a trip with only one stop left to choose cannot be reordered', async () => {
  await departOnce()
  renderBoard('TRIP-009')
  expect(await screen.findByRole('button', { name: 'Đổi thứ tự điểm' }, SLOW)).toBeDisabled()
})

test('a stop already reached cannot be moved; moving a free stop and applying sends the new order', async () => {
  const reorder = vi.spyOn(getMockDb(), 'reorderRunningStops').mockImplementationOnce(async (tripId) => ({ trip: await getMockDb().getTrip(tripId), partial: [] }))
  const dialog = await openDialog()
  const stops = within(dialog.getByRole('list', { name: 'Thứ tự các điểm' })).getAllByRole('listitem')
  expect(stops).toHaveLength(3)
  expect(stops[0]).toHaveTextContent('Xe đã tới')
  // Điểm xe đã tới khoá: không có nút dời; điểm đứng ngay dưới nó chưa lên được
  expect(within(stops[0]!).queryByRole('button')).not.toBeInTheDocument()
  expect(within(stops[1]!).getByRole('button', { name: /^Dời .+ lên$/ })).toBeDisabled()
  expect(dialog.getByRole('button', { name: 'Áp dụng thứ tự mới' })).toBeDisabled()

  await userEvent.click(within(stops[2]!).getByRole('button', { name: /^Dời .+ lên$/ }))
  await userEvent.click(dialog.getByRole('button', { name: 'Áp dụng thứ tự mới' }))
  expect(await screen.findByText('Đã đổi thứ tự điểm giao của chuyến TRIP-010.', undefined, SLOW)).toBeInTheDocument()
  expect(reorder).toHaveBeenCalledWith(TRIP, ['STOP-01', 'STOP-03', 'STOP-02'])
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('the store refuses an order that buries cargo: the dialog names every blocked package with its stop, in words, and leaves the order as it was', async () => {
  const before = await orderInStore()
  const dialog = await openDialog()
  const stops = within(dialog.getByRole('list', { name: 'Thứ tự các điểm' })).getAllByRole('listitem')
  await userEvent.click(within(stops[2]!).getByRole('button', { name: /^Dời .+ lên$/ }))
  await userEvent.click(dialog.getByRole('button', { name: 'Áp dụng thứ tự mới' }))

  const blocked = within(await dialog.findByRole('list', { name: 'Kiện bị chắn' }, SLOW)).getAllByRole('listitem')
  expect(blocked.length).toBeGreaterThan(0)
  for (const item of blocked) expect(item).toHaveTextContent(/^PKG-\d{3}-\d+ — điểm \d · .+/)
  expect(dialog.getByText('Thứ tự điểm giữ nguyên.')).toBeInTheDocument()
  expect(await orderInStore()).toStrictEqual(before)
})

test('a refusal for missing coordinates names every stop that has none, in words', async () => {
  vi.spyOn(getMockDb(), 'reorderRunningStops').mockRejectedValueOnce(
    new MockDbError('MISSING_STOP_COORDINATES', { tripId: TRIP, stopIds: ['STOP-03'], stopNumbers: [3] }),
  )
  const dialog = await openDialog()
  const stops = within(dialog.getByRole('list', { name: 'Thứ tự các điểm' })).getAllByRole('listitem')
  await userEvent.click(within(stops[2]!).getByRole('button', { name: /^Dời .+ lên$/ }))
  await userEvent.click(dialog.getByRole('button', { name: 'Áp dụng thứ tự mới' }))

  const missing = within(await dialog.findByRole('list', { name: 'Điểm chưa có toạ độ' }, SLOW)).getAllByRole('listitem')
  expect(missing.map((item) => item.textContent)).toStrictEqual([expect.stringMatching(/^điểm \d · .+$/)])
  expect(dialog.getByText('Không đổi được: các điểm sau chưa có toạ độ')).toBeInTheDocument()
})
