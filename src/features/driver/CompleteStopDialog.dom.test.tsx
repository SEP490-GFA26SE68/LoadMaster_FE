import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { afterEach, expect, test, vi } from 'vitest'
import { getMockDb, MockDbError } from '@/lib/mock-db'
import { unloadStop } from '@/test/trip-flow'
import { LOAD, loadedTwoCartonTrip, renderDriver } from './driver-test-utils'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() } }))

/**
 * Hộp hỏi lại trước khi hoàn tất điểm (`CompleteStopDialog`) trên chuyến hai thùng của tài xế demo: đã xuất phát, đã đến điểm 1 và dỡ kiện
 * của điểm bằng quét, nên nút hoàn tất bấm được ngay khi mở màn. Nội dung của hộp ở từng điểm (đã giao, hoàn trả, sự cố, kiện nhận, điểm
 * cuối) kiểm trong luồng đủ ba điểm của `DriverStopPage.dom.test.tsx` và `PickupStop.dom.test.tsx`.
 */
const WRITE = { timeout: 5000 }
const TITLE = 'Hoàn tất điểm 1 — Cửa hàng Bách Hoá Xanh Thủ Đức?'

afterEach(() => {
  vi.restoreAllMocks()
  vi.mocked(toast.error).mockClear()
  vi.mocked(toast.success).mockClear()
})

async function atFirstStopUnloaded() {
  const db = getMockDb()
  const tripId = await loadedTwoCartonTrip()
  db.restoreSession('US-0004')
  await db.startDelivery(tripId)
  await unloadStop(db, tripId, 1)
  return { db, tripId }
}

async function openQuestion() {
  await screen.findByRole('heading', { level: 1, name: 'Điểm 1 / 3' }, LOAD)
  await userEvent.click(screen.getByRole('button', { name: 'Hoàn tất điểm giao' }))
  return screen.findByRole('dialog', { name: TITLE })
}

test('the question says what will be written and what comes next; going back writes nothing and the stop can still be completed', async () => {
  const { db, tripId } = await atFirstStopUnloaded()
  const complete = vi.spyOn(db, 'completeStop')
  renderDriver(`/tai-xe/diem-giao?chuyen=${tripId}`)
  const dialog = await openQuestion()
  expect(dialog).toHaveAccessibleDescription('Hoàn tất rồi thì không mở lại được điểm này.')
  expect(within(dialog).getByText('1 kiện đã dỡ được ghi Đã giao.')).toBeInTheDocument()
  expect(within(dialog).getByText('Tiếp theo: điểm 2 · Kho Bách Hoá Xanh Dĩ An.')).toBeInTheDocument()
  expect(within(dialog).queryByText(/Hoàn trả/)).not.toBeInTheDocument()

  await userEvent.click(within(dialog).getByRole('button', { name: 'Quay lại' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(complete).not.toHaveBeenCalled()
  expect(screen.getByRole('heading', { level: 1, name: 'Điểm 1 / 3' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Hoàn tất điểm giao' })).toBeEnabled()
  expect((await db.getTrip(tripId)).delivery?.stops[0]?.completedAt).toBeUndefined()
}, 30_000)

test('a refusal from the store keeps the question open with the reason in a toast; asking again completes the stop without a success toast', async () => {
  const { db, tripId } = await atFirstStopUnloaded()
  // Ví dụ điều phối viên vừa huỷ chuyến: kho từ chối vì chuyến không còn ở pha giao
  const complete = vi.spyOn(db, 'completeStop').mockRejectedValueOnce(new MockDbError('TRIP_PHASE_INVALID', { tripId, phase: 'cancelled' }))
  renderDriver(`/tai-xe/diem-giao?chuyen=${tripId}`)
  const dialog = await openQuestion()
  await userEvent.click(within(dialog).getByRole('button', { name: 'Hoàn tất' }))
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(`Thao tác này không làm được ở trạng thái hiện tại của chuyến ${tripId}.`), WRITE)
  expect(screen.getByRole('dialog', { name: TITLE })).toBeInTheDocument()
  await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Hoàn tất' })).toBeEnabled(), WRITE)
  expect((await db.getTrip(tripId)).delivery?.stops[0]?.completedAt).toBeUndefined()

  await userEvent.click(within(dialog).getByRole('button', { name: 'Hoàn tất' }))
  expect(await screen.findByRole('heading', { level: 1, name: 'Điểm 2 / 3' }, WRITE)).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(complete).toHaveBeenCalledTimes(2)
  expect((await db.getTrip(tripId)).delivery?.stops[0]?.completedAt).toBeDefined()
  expect(toast.success).not.toHaveBeenCalled()
}, 30_000)
