import { expect, test } from 'vitest'
import type { AuditEvent } from '@/lib/mock-db'
import { driverNotice, driverNoticeEvent, hasNotifications, NOTIFICATION_LIMIT, operationHrefs, selectNotifications } from './notifications'

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

test('the platform manager and customer support have no bell; the warehouse and the driver get no account events, nor trip events that do not name them', () => {
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
  const account = event('EV-2', '2026-09-14T10:00:00.000Z', 'US-0005', 'user.locked', 'US-0003')
  expect(operationHrefs([trip, account], { id: 'US-0003', role: 'warehouse' })).toStrictEqual(['/kho?chuyen=TRIP-2026-0914', null])
  expect(operationHrefs([trip], { id: 'US-0004', role: 'driver' })).toStrictEqual(['/tai-xe/diem-giao?chuyen=TRIP-2026-0914'])
  expect(operationHrefs([trip], DISPATCHER)).toStrictEqual([null])
})

/** Sự kiện về chuyến kèm tham số, lúc `time` (giờ UTC) của ngày neo. */
const onTrip = (id: string, time: string, actorId: string, action: AuditEvent['action'], params: AuditEvent['params'], tripId = 'TRIP-010'): AuditEvent =>
  ({ ...event(id, `2026-09-14T${time}:00.000Z`, actorId, action, tripId), params })

/** Tham số tài xế `driverId` đọc ở thông báo `item` (câu riêng của tài xế); `null` khi sự kiện không có câu cho họ. */
function keptFor(item: AuditEvent, driverId: string): AuditEvent['params'] | null {
  const notice = driverNotice(item, driverId)
  return notice === null ? null : driverNoticeEvent(item, notice).params
}

const asDriver = (id: string) => ({ id, role: 'driver' as const })

test('the driver is told about their own trip once the warehouse starts staging it: a new trip, loaded, cancelled; never about the trip of another driver', () => {
  const events = [
    onTrip('EV-6', '10:50', 'US-0001', 'trip.cancelled', { reason: 'Xe hỏng hộp số', returned: 12, driverId: 'US-0004' }, 'TRIP-009'),
    // Huỷ lúc còn lập kế hoạch: chuyến chưa hiện với tài xế nào, kho không nêu tài xế
    onTrip('EV-5', '10:40', 'US-0001', 'trip.cancelled', { reason: 'Khách huỷ đơn' }, 'TRIP-012'),
    onTrip('EV-4', '10:30', 'US-0003', 'loading.completed', { loaded: 40, damaged: 0, driverId: 'US-0004' }),
    onTrip('EV-3', '10:20', 'US-0011', 'loading.started', { revisionId: 'REV-011', driverId: 'US-0007' }, 'TRIP-011'),
    onTrip('EV-2', '10:10', 'US-0003', 'loading.started', { revisionId: 'REV-010', driverId: 'US-0004' }),
    // Chuyến chưa gán tài xế
    onTrip('EV-1', '10:00', 'US-0003', 'loading.started', { revisionId: 'REV-013' }, 'TRIP-013'),
  ]
  expect(ids(selectNotifications(events, { id: 'US-0004', role: 'driver' }, NOW))).toStrictEqual(['EV-6', 'EV-4', 'EV-2'])
  expect(ids(selectNotifications(events, { id: 'US-0007', role: 'driver' }, NOW))).toStrictEqual(['EV-3'])
  expect(events.map((item) => driverNotice(item, 'US-0004'))).toStrictEqual(['cancelled', null, 'loadingCompleted', null, 'loadingStarted', null])
  // Tài xế chỉ đọc chi tiết cần cho mình: lý do huỷ, số kiện — không tên chính mình, mã phương án hay số kiện hỏng bị bỏ lại kho
  expect(events.map((item) => keptFor(item, 'US-0004')))
    .toStrictEqual([{ reason: 'Xe hỏng hộp số', returned: 12 }, null, { loaded: 40 }, null, {}, null])
  // Vai trò khác nhận đúng những gì đã nhận: tham số tài xế không đổi gì
  expect(ids(selectNotifications(events, { id: 'US-0009', role: 'dispatcher' }, NOW))).toStrictEqual(['EV-6', 'EV-5', 'EV-4'])
  expect(ids(selectNotifications(events, { id: 'US-0002', role: 'manager' }, NOW))).toStrictEqual(['EV-6', 'EV-5'])
  expect(selectNotifications(events, { id: 'US-0010', role: 'warehouse' }, NOW)).toStrictEqual([])
})

test('a new driver after staging started gets a new trip, the replaced one is told it is no longer theirs and its notices stop opening it; nobody while planning', () => {
  const changed = (id: string, time: string, params: AuditEvent['params']) => onTrip(id, time, 'US-0001', 'trip.updated', { fields: 'driverId', ...params })
  const events = [
    changed('EV-5', '10:40', { before: 'US-0006', after: 'US-0004', driverId: 'US-0004', previousDriverId: 'US-0006' }),
    changed('EV-4', '10:30', { before: 'US-0004', after: 'US-0006', driverId: 'US-0006', previousDriverId: 'US-0004' }),
    onTrip('EV-3', '10:20', 'US-0003', 'loading.started', { revisionId: 'REV-010', driverId: 'US-0004' }),
    // Lúc còn lập kế hoạch: kho không nêu tài xế
    changed('EV-2', '10:10', { before: 'US-0007', after: 'US-0004' }),
    onTrip('EV-1', '10:00', 'US-0001', 'trip.updated', { fields: 'name', before: 'Tuyến sáng', after: 'Tuyến chiều' }),
  ]
  const driver = (id: string) => ({ id, role: 'driver' as const })
  expect([ids(selectNotifications(events, driver('US-0004'), NOW)), ids(selectNotifications(events, driver('US-0006'), NOW))])
    .toStrictEqual([['EV-5', 'EV-4', 'EV-3'], ['EV-5', 'EV-4']])
  expect(selectNotifications(events, driver('US-0007'), NOW)).toStrictEqual([])
  expect(['US-0004', 'US-0006'].map((id) => events.map((item) => driverNotice(item, id)))).toStrictEqual([
    ['assigned', 'unassigned', 'loadingStarted', null, null],
    ['unassigned', 'assigned', null, null, null],
  ])
  // US-0006 thôi chạy chuyến: không thông báo nào của chuyến còn mở được nó; US-0004 được giao lại nên mọi thông báo đều mở chuyến
  const href = '/tai-xe/diem-giao?chuyen=TRIP-010'
  expect(operationHrefs(events.slice(0, 2), driver('US-0006'))).toStrictEqual([null, null])
  expect(operationHrefs(events.slice(0, 3), driver('US-0004'))).toStrictEqual([href, href, href])
  // Trước khi được giao lại, US-0004 không mở được chuyến từ thông báo nào của nó
  expect(operationHrefs(events.slice(1, 3), driver('US-0004'))).toStrictEqual([null, null])
  // Không vai trò nào khác được báo việc sửa chuyến
  expect(selectNotifications(events, { id: 'US-0009', role: 'dispatcher' }, NOW)).toStrictEqual([])
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

test('the driver of a loading trip sent back to planned is told it is on hold — a damaged package others rest on, a dropped missing one — and told again when staging restarts', () => {
  const events = [
    onTrip('EV-7', '10:50', 'US-0003', 'loading.started', { revisionId: 'REV-031', replanReason: 'SHORTAGE', driverId: 'US-0007' }, 'TRIP-011'),
    onTrip('EV-6', '10:40', 'US-0001', 'loading.shortageDropped',
      { packageInstanceId: 'PKG-001-02', packageCode: 'KH-101', requirementId: 'REQ-001', requestedBy: 'US-0003', driverId: 'US-0007' }, 'TRIP-011'),
    onTrip('EV-5', '10:30', 'US-0003', 'loading.started', { revisionId: 'REV-030', replanReason: 'DAMAGED', driverId: 'US-0004' }),
    onTrip('EV-4', '10:20', 'US-0003', 'loading.damaged', { packageInstanceId: 'PKG-002-01', packageCode: 'PKG-002-01', supporting: 2, driverId: 'US-0004' }),
    // Kiện hỏng bị bỏ lại kho, kho xếp tiếp: kho không nêu tài xế
    onTrip('EV-3', '10:10', 'US-0003', 'loading.damaged', { packageInstanceId: 'PKG-002-02', packageCode: 'PKG-002-02' }),
    // Bỏ kiện thiếu của chuyến chưa gán tài xế
    onTrip('EV-2', '10:05', 'US-0001', 'loading.shortageDropped', { packageInstanceId: 'PKG-003-01', packageCode: 'KH-301', requestedBy: 'US-0011' }, 'TRIP-015'),
    // "Tìm tiếp" là việc của người báo thiếu, không phải của tài xế
    onTrip('EV-1', '10:00', 'US-0001', 'loading.shortageKept', { packageInstanceId: 'PKG-001-02', requestedBy: 'US-0003' }, 'TRIP-011'),
  ]
  // EV-6 tới tài xế theo `driverId` dù người báo thiếu là nhân viên kho: với tài xế chỉ xác nhận tay mới tính theo người gửi
  expect([ids(selectNotifications(events, asDriver('US-0004'), NOW)), ids(selectNotifications(events, asDriver('US-0007'), NOW))])
    .toStrictEqual([['EV-5', 'EV-4'], ['EV-7', 'EV-6']])
  expect(['US-0004', 'US-0007'].map((id) => events.map((item) => driverNotice(item, id)))).toStrictEqual([
    [null, null, 'loadingRestarted', 'replanDamaged', null, null, null],
    ['loadingRestarted', 'replanShortage', null, null, null, null, null],
  ])
  // Câu đã nói đủ: tài xế không đọc mã kiện, mã phương án, số kiện tựa lên, lý do soạn lại hay người báo thiếu
  expect(events.slice(0, 4).map((item) => keptFor(item, item.params.driverId as string))).toStrictEqual([{}, {}, {}, {}])
  // Thông báo mở chuyến ở màn của tài xế, nơi nói chuyến đang tạm dừng
  expect(operationHrefs(events.slice(0, 2), asDriver('US-0007'))).toStrictEqual(['/tai-xe/diem-giao?chuyen=TRIP-011', '/tai-xe/diem-giao?chuyen=TRIP-011'])
  // Vai trò khác nhận đúng những gì đã nhận: tham số tài xế không đổi gì
  expect(ids(selectNotifications(events, { id: 'US-0009', role: 'dispatcher' }, NOW))).toStrictEqual(['EV-4', 'EV-3'])
  expect(ids(selectNotifications(events, { id: 'US-0002', role: 'manager' }, NOW))).toStrictEqual(['EV-6'])
  expect(ids(selectNotifications(events, { id: 'US-0003', role: 'warehouse' }, NOW))).toStrictEqual(['EV-6', 'EV-1'])
  expect(ids(selectNotifications(events, { id: 'US-0011', role: 'warehouse' }, NOW))).toStrictEqual(['EV-2'])
})

test('the driver reads a pickup decision and a new stop order of their trip in their own words, with only what they act on', () => {
  const events = [
    onTrip('EV-4', '10:40', 'US-0001', 'trip.stopsReordered', { count: 2, lateStops: 1, driverId: 'US-0006' }, 'TRIP-009'),
    onTrip('EV-3', '10:30', 'US-0001', 'pickup.rejected', { pickupId: 'PKR-003', reason: 'Xe không còn chỗ', driverId: 'US-0006' }, 'TRIP-009'),
    onTrip('EV-2', '10:20', 'US-0001', 'pickup.approved', { pickupId: 'PKR-002', count: 2, failedRules: 1, reason: 'Khách quen', driverId: 'US-0006' }, 'TRIP-009'),
    onTrip('EV-1', '10:10', 'US-0001', 'trip.stopsReordered', { count: 3, lateStops: 0, driverId: 'US-0006' }, 'TRIP-009'),
  ]
  expect(ids(selectNotifications(events, asDriver('US-0006'), NOW))).toStrictEqual(['EV-4', 'EV-3', 'EV-2', 'EV-1'])
  expect(events.map((item) => driverNotice(item, 'US-0006'))).toStrictEqual(['stopsReordered', 'pickupRejected', 'pickupApproved', 'stopsReordered'])
  // Số điểm trễ hạn dự kiến, lý do từ chối, số kiện phải nhận — không mã yêu cầu, số luật không đạt, lý do vượt luật của điều phối viên
  // hay số điểm đổi chỗ
  expect(events.map((item) => keptFor(item, 'US-0006'))).toStrictEqual([{ lateStops: 1 }, { reason: 'Xe không còn chỗ' }, { count: 2 }, { lateStops: 0 }])
  expect(selectNotifications(events, asDriver('US-0004'), NOW)).toStrictEqual([])
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

test('a reply from customer support reaches only the person who sent the ticket, whichever company role they have (FE-8-07)', () => {
  const reply = { ...event('EV-1', '2026-09-14T10:00:00.000Z', 'US-NT-02', 'ticket.replied', 'TKT-001'), params: { requestedBy: 'US-0003' } }
  expect(ids(selectNotifications([reply], { id: 'US-0003', role: 'warehouse' }, NOW))).toStrictEqual(['EV-1'])
  // Đồng nghiệp cùng công ty chỉ nhận khi chính họ là người gửi, ở vai trò nào cũng vậy
  expect(selectNotifications([reply], { id: 'US-0001', role: 'dispatcher' }, NOW)).toStrictEqual([])
  expect(ids(selectNotifications([{ ...reply, params: { requestedBy: 'US-0001' } }], { id: 'US-0001', role: 'dispatcher' }, NOW))).toStrictEqual(['EV-1'])
  // Tài khoản nền tảng không có chuông; lần trả lời của chính người gửi không tự báo cho mình
  expect(selectNotifications([reply], { id: 'US-NT-02', role: 'systemSupporter' }, NOW)).toStrictEqual([])
  expect(selectNotifications([{ ...reply, actorId: 'US-0003' }], { id: 'US-0003', role: 'warehouse' }, NOW)).toStrictEqual([])
})
