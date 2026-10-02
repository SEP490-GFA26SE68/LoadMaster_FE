import { expect, test } from 'vitest'
import type { AuditEvent } from '@/lib/mock-db'
import { hasNotifications, NOTIFICATION_LIMIT, selectNotifications } from './notifications'

/** Lọc sự kiện nhật ký thành thông báo theo vai trò (LM-098). Sự kiện dựng tay, mới nhất trước như kho trả. */

const NOW = new Date('2026-09-14T11:00:00.000Z')
const DISPATCHER = { id: 'US-0001', role: 'dispatcher' } as const

function event(id: string, at: string, actorId: string | null, action: AuditEvent['action'], targetId = 'TRIP-001'): AuditEvent {
  const type = action.startsWith('user.') || action.startsWith('auth.') ? 'user' : 'trip'
  return { id, at, actorId, action, target: { type, id: targetId }, params: {} }
}

const ids = (events: readonly AuditEvent[]) => events.map((item) => item.id)

test('the dispatcher gets plan approvals, loading, delivery and cancellation events done by others, within seven days', () => {
  const events = [
    event('EV-12', '2026-09-14T10:30:00.000Z', 'US-PN-03', 'revision.approved'),
    event('EV-11', '2026-09-14T10:20:00.000Z', 'US-0001', 'revision.approved'),
    event('EV-10', '2026-09-14T10:10:00.000Z', 'US-PN-03', 'optimization.saved'),
    event('EV-9', '2026-09-14T10:00:00.000Z', 'US-0003', 'loading.missing'),
    event('EV-8', '2026-09-14T09:00:00.000Z', 'US-0001', 'trip.cancelled'),
    event('EV-7', '2026-09-14T08:00:00.000Z', 'US-0002', 'trip.cancelled'),
    event('EV-6', '2026-09-13T08:00:00.000Z', 'US-0004', 'delivery.issue'),
    event('EV-5', '2026-09-12T08:00:00.000Z', 'US-0004', 'delivery.stopCompleted'),
    event('EV-4', '2026-09-11T08:00:00.000Z', 'US-0004', 'delivery.completed'),
    event('EV-3', '2026-09-10T08:00:00.000Z', 'US-0003', 'loading.completed'),
    event('EV-2', '2026-09-07T11:00:00.000Z', 'US-0003', 'loading.completed'),
    event('EV-1', '2026-09-07T10:59:59.000Z', 'US-0004', 'delivery.completed'),
  ]
  // EV-12: điều phối viên khác duyệt phương án (FE-0-04); EV-11, EV-8: việc của chính mình; EV-10: lưu kết quả tối ưu và EV-5: hoàn tất
  // một điểm giao không phải loại báo; EV-2 đúng mốc 7 ngày còn, EV-1 quá mốc
  expect(ids(selectNotifications(events, DISPATCHER, NOW))).toStrictEqual(['EV-12', 'EV-9', 'EV-7', 'EV-6', 'EV-4', 'EV-3', 'EV-2'])
})

test('the manager gets completed and cancelled trips and delivery issues; not warehouse progress or plan approvals', () => {
  const events = [
    event('EV-5', '2026-09-14T10:30:00.000Z', 'US-0001', 'revision.approved'),
    event('EV-4', '2026-09-14T10:00:00.000Z', 'US-0003', 'loading.missing'),
    event('EV-3', '2026-09-14T09:00:00.000Z', 'US-0001', 'trip.cancelled'),
    event('EV-2', '2026-09-13T09:00:00.000Z', 'US-0004', 'delivery.issue'),
    event('EV-1', '2026-09-12T09:00:00.000Z', 'US-0004', 'delivery.completed'),
  ]
  expect(ids(selectNotifications(events, { id: 'US-0002', role: 'manager' }, NOW))).toStrictEqual(['EV-3', 'EV-2', 'EV-1'])
})

test('the system administrator gets account events by others and failed sign-ins, not routine sign-ins and no trip events', () => {
  const events = [
    event('EV-6', '2026-09-14T10:00:00.000Z', null, 'auth.signInFailed', 'ai-do@example.vn'),
    event('EV-5', '2026-09-14T09:30:00.000Z', 'US-0003', 'auth.signedIn', 'US-0003'),
    event('EV-4', '2026-09-14T09:00:00.000Z', 'US-0003', 'user.passwordChanged', 'US-0003'),
    event('EV-3', '2026-09-14T08:00:00.000Z', 'US-0005', 'user.created', 'US-0013'),
    event('EV-2', '2026-09-13T08:00:00.000Z', 'US-0009', 'user.profileUpdated', 'US-0009'),
    event('EV-1', '2026-09-13T07:00:00.000Z', 'US-0003', 'trip.cancelled'),
  ]
  expect(ids(selectNotifications(events, { id: 'US-0005', role: 'systemAdmin' }, NOW))).toStrictEqual(['EV-6', 'EV-4', 'EV-2'])
  // Quản trị công ty nhận cùng loại sự kiện; EV-3 lần này là việc của người khác (quản trị hệ thống tạo tài khoản)
  expect(ids(selectNotifications(events, { id: 'US-LB-01', role: 'companyAdmin' }, NOW))).toStrictEqual(['EV-6', 'EV-4', 'EV-3', 'EV-2'])
})

test('warehouse workers, drivers, the platform manager and customer support have no bell', () => {
  const events = [
    event('EV-2', '2026-09-14T10:30:00.000Z', 'US-0005', 'user.created', 'US-0016'),
    event('EV-1', '2026-09-14T10:00:00.000Z', 'US-0001', 'trip.cancelled'),
  ]
  expect([hasNotifications('warehouse'), hasNotifications('driver')]).toStrictEqual([false, false])
  expect([hasNotifications('systemManager'), hasNotifications('systemSupporter')]).toStrictEqual([false, false])
  expect([hasNotifications('dispatcher'), hasNotifications('manager'), hasNotifications('systemAdmin'), hasNotifications('companyAdmin')])
    .toStrictEqual([true, true, true, true])
  expect(selectNotifications(events, { id: 'US-0003', role: 'warehouse' }, NOW)).toStrictEqual([])
  expect(selectNotifications(events, { id: 'US-NT-01', role: 'systemManager' }, NOW)).toStrictEqual([])
})

test('at most twenty, the newest first', () => {
  const events = Array.from({ length: 25 }, (_, index) =>
    event(`EV-${25 - index}`, new Date(NOW.getTime() - index * 60_000).toISOString(), 'US-0003', 'loading.completed'))
  const selected = selectNotifications(events, DISPATCHER, NOW)
  expect(NOTIFICATION_LIMIT).toBe(20)
  expect(selected).toHaveLength(20)
  expect([selected[0]?.id, selected[19]?.id]).toStrictEqual(['EV-25', 'EV-6'])
})
