import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getMockDb } from '@/lib/mock-db'
import { loadingOrder } from '@/test/trip-flow'
import { LOAD, renderDriver } from './driver-test-utils'

/**
 * Chuông ở "Chuyến của tôi" (FE-6-01): việc của chuyến tới chuông của đúng tài xế, và thông báo mở màn của chuyến đó — chuyến bị huỷ lúc kho
 * đang xếp mở màn chuyến đã huỷ kèm lý do điều phối viên ghi; chuyến quay về Đã lập kế hoạch mở màn chuyến tạm dừng kèm lý do. Đồng hồ chỉ
 * giả `Date` (18:00 ngày neo seed) để thông báo nằm trong cửa sổ của chuông.
 */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-14T11:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

test('a trip cancelled while the warehouse loads it reaches the bell of its driver, and the notice opens the cancelled trip with the reason', async () => {
  const user = userEvent.setup()
  // Đặng Hoài Nam (US-0007) chạy TRIP-011, kho đang xếp; điều phối viên huỷ chuyến ở máy khác
  renderDriver('/tai-xe', 'US-0007')
  await screen.findByRole('region', { name: 'Kho đang soạn / xếp' }, LOAD)
  const db = getMockDb()
  db.restoreSession('US-0001')
  try {
    await db.cancelTrip('TRIP-011', 'Xe hỏng máy lạnh')
  } finally {
    db.restoreSession('US-0007')
  }

  await user.click(screen.getByRole('button', { name: /^Thông báo/ }))
  await user.click(await screen.findByRole('menuitem', { name: /^Chuyến đã huỷ.*TRIP-011/ }, LOAD))
  expect(await screen.findByText('Chuyến TRIP-011 đã huỷ: Xe hỏng máy lạnh', {}, LOAD)).toBeInTheDocument()
}, 15_000)

test('a trip sent back to planned reaches the bell of its driver, and the notice opens the trip on hold with the reason, not the old plan', async () => {
  const user = userEvent.setup()
  // Chuyến chính của Phạm Quốc Dũng (US-0004): kho bắt đầu soạn hàng rồi báo thiếu một kiện; điều phối viên bỏ kiện đó khỏi chuyến — chuyến
  // quay về Đã lập kế hoạch, chờ phương án mới
  const tripId = 'TRIP-2026-0914'
  const db = getMockDb()
  db.restoreSession('US-0003')
  await db.startLoading(tripId)
  const [missing = ''] = await loadingOrder(db, tripId)
  await db.reportStagingShortage(tripId, missing)
  db.restoreSession('US-0001')
  await db.resolveStagingShortage(tripId, missing, 'DROP')

  renderDriver('/tai-xe')
  await user.click(await screen.findByRole('button', { name: /^Thông báo/ }, LOAD))
  await user.click(await screen.findByRole('menuitem', { name: /^Chuyến tạm dừng: thiếu kiện.*TRIP-2026-0914/ }, LOAD))
  expect(await screen.findByText('Chuyến tạm dừng', {}, LOAD)).toBeInTheDocument()
  expect(screen.getByText(
    'Kho không tìm thấy một kiện của chuyến TRIP-2026-0914 lúc soạn hàng, điều phối đã bỏ kiện đó khỏi chuyến. Điều phối lập lại phương án rồi kho soạn lại hàng; khi đó chuyến hiện lại ở "Chuyến của tôi".',
  )).toBeInTheDocument()
  expect(screen.queryByRole('heading', { level: 1, name: /^Điểm / })).not.toBeInTheDocument()
}, 20_000)
