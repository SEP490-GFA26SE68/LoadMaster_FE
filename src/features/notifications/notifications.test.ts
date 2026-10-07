import { expect, test } from 'vitest'
import type { AuditEvent } from '@/lib/mock-db'
import { hasNotifications, NOTIFICATION_LIMIT, operationHref, selectNotifications } from './notifications'

/** Lọc sự kiện nhật ký thành thông báo theo vai trò (LM-098). Sự kiện dựng tay, mới nhất trước như kho trả. */

const NOW = new Date('2026-09-14T11:00:00.000Z')
const DISPATCHER = { id: 'US-0001', role: 'dispatcher' } as const

function event(id: string, at: string, actorId: string | null, action: AuditEvent['action'], targetId = 'TRIP-001'): AuditEvent {
  const type = action.startsWith('user.') || action.startsWith('auth.') ? 'user' : 'trip'
  return { id, at, actorId, companyId: 'LOG-001', action, target: { type, id: targetId }, params: {} }
}

const ids = (events: readonly AuditEvent[]) => events.map((item) => item.id)

test('the dispatcher gets plan approvals, loading, delivery and cancellation events done by others, within seven days', () => {
  const events = [
    event('EV-13', '2026-09-14T10:40:00.000Z', 'US-0003', 'package.found', 'PK-0063'),
    event('EV-12', '2026-09-14T10:30:00.000Z', 'US-PN-03', 'revision.approved'),
    event('EV-11', '2026-09-14T10:20:00.000Z', 'US-0001', 'revision.approved'),
    event('EV-10', '2026-09-14T10:10:00.000Z', 'US-PN-03', 'optimization.saved'),
    event('EV-9', '2026-09-14T10:00:00.000Z', 'US-0003', 'loading.shortageReported'),
    event('EV-8', '2026-09-14T09:00:00.000Z', 'US-0001', 'trip.cancelled'),
    event('EV-7', '2026-09-14T08:00:00.000Z', 'US-0002', 'trip.cancelled'),
    event('EV-6', '2026-09-13T08:00:00.000Z', 'US-0004', 'delivery.issue'),
    event('EV-5', '2026-09-12T08:00:00.000Z', 'US-0004', 'delivery.stopCompleted'),
    event('EV-4', '2026-09-11T08:00:00.000Z', 'US-0004', 'delivery.completed'),
    event('EV-3', '2026-09-10T08:00:00.000Z', 'US-0003', 'loading.completed'),
    event('EV-2', '2026-09-07T11:00:00.000Z', 'US-0003', 'loading.completed'),
    event('EV-1', '2026-09-07T10:59:59.000Z', 'US-0004', 'delivery.completed'),
  ]
  // EV-13: kho quét thấy lại kiện mang cờ "Không tìm thấy" (FE-3b-06, D-92); EV-12: điều phối viên khác duyệt phương án (FE-0-04); EV-11, EV-8: việc của chính mình; EV-10: lưu kết quả tối ưu và EV-5: hoàn tất
  // một điểm giao không phải loại báo; EV-2 đúng mốc 7 ngày còn, EV-1 quá mốc
  expect(ids(selectNotifications(events, DISPATCHER, NOW))).toStrictEqual(['EV-13', 'EV-12', 'EV-9', 'EV-7', 'EV-6', 'EV-4', 'EV-3', 'EV-2'])
  // Quản lý công ty không nhận việc của kho kiện
  expect(ids(selectNotifications(events.slice(0, 1), { id: 'US-0002', role: 'manager' }, NOW))).toStrictEqual([])
})

test('the manager gets completed and cancelled trips and delivery issues; not warehouse progress or plan approvals', () => {
  const events = [
    event('EV-5', '2026-09-14T10:30:00.000Z', 'US-0001', 'revision.approved'),
    event('EV-4', '2026-09-14T10:00:00.000Z', 'US-0003', 'loading.shortageReported'),
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

test('the platform manager and customer support have no bell; the warehouse and the driver get no trip or account events', () => {
  const events = [
    event('EV-2', '2026-09-14T10:30:00.000Z', 'US-0005', 'user.created', 'US-0016'),
    event('EV-1', '2026-09-14T10:00:00.000Z', 'US-0001', 'trip.cancelled'),
  ]
  expect([hasNotifications('systemManager'), hasNotifications('systemSupporter')]).toStrictEqual([false, false])
  expect([hasNotifications('dispatcher'), hasNotifications('manager'), hasNotifications('systemAdmin'), hasNotifications('companyAdmin')])
    .toStrictEqual([true, true, true, true])
  expect(selectNotifications(events, { id: 'US-0003', role: 'warehouse' }, NOW)).toStrictEqual([])
  expect(selectNotifications(events, { id: 'US-0004', role: 'driver' }, NOW)).toStrictEqual([])
  expect(selectNotifications(events, { id: 'US-NT-01', role: 'systemManager' }, NOW)).toStrictEqual([])
})

test('manual confirmations (FE-6-04): a new one reaches the dispatcher; a rejected one reaches only the person who sent it', () => {
  const sentBy = (id: string, at: string, requestedBy: string): AuditEvent =>
    ({ ...event(id, at, 'US-0001', 'manualConfirm.rejected'), params: { packageInstanceId: 'PKG-001-01', reason: 'Sai kiện', requestedBy } })
  const events = [
    sentBy('EV-5', '2026-09-14T10:40:00.000Z', 'US-0004'),
    sentBy('EV-4', '2026-09-14T10:30:00.000Z', 'US-0010'),
    sentBy('EV-3', '2026-09-14T10:20:00.000Z', 'US-0003'),
    { ...event('EV-2', '2026-09-14T10:10:00.000Z', 'US-0001', 'manualConfirm.approved'), params: { packageInstanceId: 'PKG-002-01', requestedBy: 'US-0003' } },
    event('EV-1', '2026-09-14T10:00:00.000Z', 'US-0003', 'manualConfirm.requested'),
  ]
  expect([hasNotifications('warehouse'), hasNotifications('driver')]).toStrictEqual([true, true])
  // Nhân viên kho US-0003 chỉ nhận lần từ chối xác nhận của chính mình — không nhận của đồng nghiệp US-0010, của tài xế, hay lần duyệt
  expect(ids(selectNotifications(events, { id: 'US-0003', role: 'warehouse' }, NOW))).toStrictEqual(['EV-3'])
  expect(ids(selectNotifications(events, { id: 'US-0004', role: 'driver' }, NOW))).toStrictEqual(['EV-5'])
  // Điều phối viên khác nhận xác nhận tay mới gửi; quyết định duyệt / từ chối không phải loại báo cho điều phối
  expect(ids(selectNotifications(events, { id: 'US-0009', role: 'dispatcher' }, NOW))).toStrictEqual(['EV-1'])
  expect(ids(selectNotifications(events, { id: 'US-0002', role: 'manager' }, NOW))).toStrictEqual([])
})

test('a trip notification opens the screen of the warehouse or the driver; other roles follow the audit log link', () => {
  const trip = event('EV-1', '2026-09-14T10:00:00.000Z', 'US-0001', 'manualConfirm.rejected', 'TRIP-2026-0914')
  expect(operationHref(trip, 'warehouse')).toBe('/kho?chuyen=TRIP-2026-0914')
  expect(operationHref(trip, 'driver')).toBe('/tai-xe/diem-giao?chuyen=TRIP-2026-0914')
  expect(operationHref(trip, 'dispatcher')).toBeNull()
  expect(operationHref(event('EV-2', '2026-09-14T10:00:00.000Z', 'US-0005', 'user.locked', 'US-0003'), 'warehouse')).toBeNull()
})

test('at most twenty, the newest first', () => {
  const events = Array.from({ length: 25 }, (_, index) =>
    event(`EV-${25 - index}`, new Date(NOW.getTime() - index * 60_000).toISOString(), 'US-0003', 'loading.completed'))
  const selected = selectNotifications(events, DISPATCHER, NOW)
  expect(NOTIFICATION_LIMIT).toBe(20)
  expect(selected).toHaveLength(20)
  expect([selected[0]?.id, selected[19]?.id]).toStrictEqual(['EV-25', 'EV-6'])
})

test('shortages and damaged packages reach who must act (FE-6-02, FE-6-05): the dispatcher always, the manager only for a requirement, the warehouse reporter for the decision', () => {
  const withParams = (id: string, actorId: string, action: AuditEvent['action'], params: AuditEvent['params']): AuditEvent =>
    ({ ...event(id, '2026-09-14T10:00:00.000Z', actorId, action, 'TRIP-011'), params })
  const events = [
    withParams('EV-6', 'US-0001', 'loading.shortageDropped', { packageInstanceId: 'PKG-001-02', requirementId: 'REQ-001', requestedBy: 'US-0003' }),
    withParams('EV-5', 'US-0001', 'loading.shortageDropped', { packageInstanceId: 'PKG-002-01', requestedBy: 'US-0011' }),
    withParams('EV-4', 'US-0001', 'loading.shortageKept', { packageInstanceId: 'PKG-001-03', requestedBy: 'US-0003' }),
    withParams('EV-3', 'US-0003', 'loading.damaged', { packageInstanceId: 'PKG-001-04', requirementId: 'REQ-001' }),
    withParams('EV-2', 'US-0003', 'loading.damaged', { packageInstanceId: 'PKG-002-02' }),
    withParams('EV-1', 'US-0003', 'loading.shortageReported', { packageInstanceId: 'PKG-001-02' }),
  ]
  // Điều phối viên khác (US-PN-03 ở đây chỉ là một mã người dùng): kho báo thiếu và kiện hỏng; quyết định của đồng nghiệp thì không báo
  expect(ids(selectNotifications(events, { id: 'US-0009', role: 'dispatcher' }, NOW))).toStrictEqual(['EV-3', 'EV-2', 'EV-1'])
  // Quản lý công ty: chỉ kiện của một yêu cầu giao — yêu cầu đó thành giao thiếu
  expect(ids(selectNotifications(events, { id: 'US-0002', role: 'manager' }, NOW))).toStrictEqual(['EV-6', 'EV-3'])
  // Nhân viên kho: quyết định cho kiện chính mình báo thiếu
  expect(ids(selectNotifications(events, { id: 'US-0003', role: 'warehouse' }, NOW))).toStrictEqual(['EV-6', 'EV-4'])
  expect(ids(selectNotifications(events, { id: 'US-0011', role: 'warehouse' }, NOW))).toStrictEqual(['EV-5'])
})

test('the warehouse is told about a trip cancelled while it was loading — to unload — not about other cancellations (FE-6-07)', () => {
  const cancelled = (id: string, params: AuditEvent['params']): AuditEvent => ({ ...event(id, '2026-09-14T10:00:00.000Z', 'US-0001', 'trip.cancelled'), params })
  const events = [cancelled('EV-3', { reason: 'Xe hỏng', loaded: 110 }), cancelled('EV-2', { reason: 'Xe hỏng', loaded: 0 }), cancelled('EV-1', { reason: 'Khách huỷ' })]
  expect(ids(selectNotifications(events, { id: 'US-0003', role: 'warehouse' }, NOW))).toStrictEqual(['EV-3', 'EV-2'])
  expect(ids(selectNotifications(events, { id: 'US-0004', role: 'driver' }, NOW))).toStrictEqual([])
  expect(ids(selectNotifications(events, { id: 'US-0002', role: 'manager' }, NOW))).toStrictEqual(['EV-3', 'EV-2', 'EV-1'])
})

test('a pickup request reaches the dispatcher, and the decision on it reaches only the driver of that trip', () => {
  const requested = { ...event('EV-3', '2026-09-14T10:30:00.000Z', 'US-0006', 'pickup.requested', 'TRIP-009'), params: { pickupId: 'PKR-002', count: 1, failedRules: 0 } }
  const approved = { ...event('EV-2', '2026-09-14T10:20:00.000Z', 'US-0001', 'pickup.approved', 'TRIP-009'), params: { pickupId: 'PKR-002', driverId: 'US-0006' } }
  const rejected = { ...event('EV-1', '2026-09-14T10:10:00.000Z', 'US-0001', 'pickup.rejected', 'TRIP-009'), params: { pickupId: 'PKR-003', driverId: 'US-0004' } }
  const events = [requested, approved, rejected]
  expect(ids(selectNotifications(events, DISPATCHER, NOW))).toStrictEqual(['EV-3'])
  expect(ids(selectNotifications(events, { id: 'US-0006', role: 'driver' }, NOW))).toStrictEqual(['EV-2'])
  expect(ids(selectNotifications(events, { id: 'US-0004', role: 'driver' }, NOW))).toStrictEqual(['EV-1'])
  expect(ids(selectNotifications(events, { id: 'US-0003', role: 'warehouse' }, NOW))).toStrictEqual([])
})
