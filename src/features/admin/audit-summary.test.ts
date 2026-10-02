import { expect, test } from 'vitest'
import { createMockDb, type AuditAction, type AuditEvent } from '@/lib/mock-db'
import { summarizeAuditLog } from './audit-summary'

/** Ba ô số liệu của `/nhat-ky` (V2): tổng sự kiện, số sự kiện của ngày gần nhất có ghi nhận (giờ Việt Nam), lần ghi gần nhất. */
function event(id: string, at: string, action: AuditAction = 'auth.signedIn'): AuditEvent {
  return { id, at, actorId: 'US-0001', action, target: { type: 'user', id: 'US-0001' }, params: {} }
}

test('nhật ký rỗng: không có ngày gần nhất, không có lần ghi gần nhất', () => {
  expect(summarizeAuditLog([])).toStrictEqual({ total: 0, latestDay: null, latestAt: null })
})

test('ngày gần nhất tính theo giờ Việt Nam, không phụ thuộc thứ tự nhận', () => {
  const events = [
    event('EV-1', '2026-09-21T09:00:00.000Z'),
    // 01:30 ngày 23/09 giờ Việt Nam — theo UTC vẫn là 22/09
    event('EV-3', '2026-09-22T18:30:00.000Z'),
    event('EV-2', '2026-09-22T16:59:00.000Z'),
    event('EV-4', '2026-09-22T17:00:00.000Z'),
  ]
  expect(summarizeAuditLog(events)).toStrictEqual({
    total: 4,
    latestDay: { date: '2026-09-23', count: 2 },
    latestAt: '2026-09-22T18:30:00.000Z',
  })
})

test('seed neo 14/09/2026: đếm trên toàn bộ nhật ký của kho', async () => {
  const events = await createMockDb().listEvents()
  const summary = summarizeAuditLog(events)
  // Đếm bằng máy trên seed, độc lập với hàm: 124 sự kiện (115 + 9 của nguồn hàng: 6 đợt đăng ký kiện, 2 đơn hàng, 1 lần chạy tối ưu
  // hỏng — 32 sự kiện lô hàng và quét nhận đã bỏ ở FE-0-06), 23 sự kiện ngày 14/09, lần cuối 11:40 giờ Việt Nam
  expect(summary).toStrictEqual({ total: 124, latestDay: { date: '2026-09-14', count: 23 }, latestAt: '2026-09-14T04:40:00.000Z' })
})
