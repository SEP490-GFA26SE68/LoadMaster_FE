import { expect, test } from 'vitest'
import { createMockDb, type AuditAction, type AuditEvent } from '@/lib/mock-db'
import { summarizeAuditLog } from './audit-summary'

/** Ba ô số liệu của `/nhat-ky` (V2): tổng sự kiện, số sự kiện của ngày gần nhất có ghi nhận (giờ Việt Nam), lần ghi gần nhất. */
function event(id: string, at: string, action: AuditAction = 'auth.signedIn'): AuditEvent {
  return { id, at, actorId: 'US-0001', companyId: 'LOG-001', action, target: { type: 'user', id: 'US-0001' }, params: {} }
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
  const db = createMockDb()
  // Đếm bằng máy trên seed, độc lập với hàm. Kho không có phiên trả cả nhật ký: 131 sự kiện — 124 có từ trước (115 + 9 của nguồn
  // hàng: 6 đợt đăng ký kiện, 2 đơn hàng, 1 lần chạy tối ưu hỏng) và 7 của Phương Nam (2 đợt đăng ký kiện, 1 đơn, 2 chuyến, 1 lần tối
  // ưu, 1 lần duyệt; FE-0-02). Ngày 14/09 có 26 sự kiện (23 + 3 của Phương Nam), lần cuối 11:40 giờ Việt Nam.
  expect(summarizeAuditLog(await db.listEvents())).toStrictEqual({ total: 131, latestDay: { date: '2026-09-14', count: 26 }, latestAt: '2026-09-14T04:40:00.000Z' })
  // Quản trị công ty Long Bình đọc 124 sự kiện của Long Bình: 120 việc người Long Bình làm và 4 việc quản trị hệ thống làm trên tài
  // khoản của Long Bình (tạo 3 tài khoản, khoá 1 — FE-0-08); 7 sự kiện của Phương Nam thì không
  db.restoreSession('US-LB-01')
  expect(summarizeAuditLog(await db.listEvents())).toStrictEqual({ total: 124, latestDay: { date: '2026-09-14', count: 23 }, latestAt: '2026-09-14T04:40:00.000Z' })
  db.restoreSession('US-PN-01')
  expect((await db.listEvents()).length).toBe(7)
})
