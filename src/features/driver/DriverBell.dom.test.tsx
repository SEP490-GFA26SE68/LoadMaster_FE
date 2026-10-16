import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getMockDb } from '@/lib/mock-db'
import { LOAD, renderDriver } from './driver-test-utils'

/**
 * Chuông ở "Chuyến của tôi" (FE-6-01): chuyến bị huỷ lúc kho đang xếp tới chuông của đúng tài xế, và thông báo mở màn của chuyến đó — màn
 * chuyến đã huỷ kèm lý do điều phối viên ghi. Đồng hồ chỉ giả `Date` (18:00 ngày neo seed) để thông báo nằm trong cửa sổ của chuông.
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
