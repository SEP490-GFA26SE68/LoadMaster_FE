import { expect, test } from 'vitest'
import { createFormatter } from '@/lib/format'
import { createTranslator } from '@/lib/i18n'
import type { ServerAuditEntry } from './audit-backend-api'
import { serverAuditRow } from './server-audit-rows'

/**
 * Cột Chi tiết của Nhật ký máy chủ, cũng là chi tiết của chuông bản máy chủ: mã có nhãn thì dịch, mã không có nhãn thì bỏ — không bao
 * giờ hiện mã thô; chip "trước → sau" chỉ khi cả hai phía có nhãn.
 */
const vi = { t: createTranslator('vi'), format: createFormatter('vi-VN') }
const en = { t: createTranslator('en'), format: createFormatter('en-US') }

function entry(actionType: string, after: ServerAuditEntry['after'], before: ServerAuditEntry['before'] = {}): ServerAuditEntry {
  return {
    id: '1', at: '2026-11-06T02:15:00.000Z', actionType, entityName: 'Trip', entityId: '42', entityCode: 'TRIP-20261106-A1', actorId: '7',
    actorName: 'Phạm Minh Khôi', actorRole: 'dispatcher', companyName: null, before, after,
  }
}

const row = (value: ServerAuditEntry, locale = vi) => serverAuditRow(value, locale.t, locale.format)

test('xếp xong: trạng thái phiên xếp không phải trạng thái chuyến, không có chip', () => {
  const done = row(entry('LOADING_COMPLETED', { status: 'COMPLETED', tripStatus: 'LOADING', driverId: 31 }))
  expect(done.change).toBeNull()
  expect(done.details).not.toContain('COMPLETED')
  expect(done.details).not.toContain('Trạng thái')
})

test('chuyến hoàn thành không có giá trị cũ: không vẽ chip trước → sau', () => {
  const completed = row(entry('TRIP_COMPLETED', { tripId: 42, status: 'DELIVERED' }))
  expect(completed.change).toBeNull()
  expect(completed.details).toBe('')
})

test('đổi trạng thái chuyến vẫn có chip khi cả hai phía có nhãn', () => {
  const started = row(entry('TRIP_STATUS_TRANSITION', { status: 'LOADING' }, { status: 'PLANNED' }))
  expect(started.change).toMatchObject({ before: 'Đã lập kế hoạch', after: 'Đang xếp hàng' })
})

test('xác nhận tay: lý do là nhãn của từ điển, không phải mã', () => {
  expect(row(entry('MANUAL_CONFIRM_REQUESTED', { reason: 'LABEL_DAMAGED', step: 'LOADING' })).details).toBe('Lý do: Nhãn rách / mất')
  expect(row(entry('MANUAL_CONFIRM_REQUESTED', { reason: 'QR_UNREADABLE' }), en).details).toBe('Reason: QR unreadable')
  // Từ chối: lý do người dùng nhập giữ nguyên
  expect(row(entry('MANUAL_CONFIRM_REJECTED', { reason: 'Kiện không đúng mã' })).details).toBe('Lý do: Kiện không đúng mã')
})

test('lý do là mã lạ thì bỏ, không hiện mã', () => {
  expect(row(entry('TRIP_EXCEPTION_ESCALATED', { reason: 'NO_ROUTE' })).details).toBe('Không tìm được tuyến khác')
  expect(row(entry('TRIP_EXCEPTION_ESCALATED', { reason: 'MANUAL_ESCALATION' })).details).toBe('')
  expect(row(entry('TRIP_CANCELLED', { status: 'CANCELLED', reason: 'Khách hoãn đơn' }, { status: 'LOADING' })).details)
    .toBe('Lý do: Khách hoãn đơn · Trạng thái Đang xếp hàng → Đã huỷ')
})

test('duyệt phương án: không ghi "Giữ 0 kiện đã ghim"', () => {
  expect(row(entry('PLAN_APPROVED', { approved: true, movedCount: 2, pinnedCount: 0, manuallyEdited: true })).details).toBe('')
  expect(row(entry('PLAN_APPROVED', { pinnedCount: 3 })).details).toBe('Giữ 3 kiện đã ghim')
})

test('sự cố kiện: loại sự cố dịch qua nhãn dùng chung', () => {
  expect(row(entry('DELIVERY_ISSUE_REPORTED', { kind: 'REFUSED' })).details).toBe('Khách từ chối')
})

test('nhận hàng dọc đường: số kiện, kết quả mười luật, kiện chưa có chỗ — không mã trạng thái', () => {
  const requested = row(entry('PICKUP_REQUESTED', { status: 'PENDING', packages: 2, pickupId: 5, tripId: 42 }))
  expect(requested.action).toBe('Gửi yêu cầu nhận hàng dọc đường')
  expect(requested.change).toBeNull()
  expect(requested.details).toBe('2 kiện nhận dọc đường · Có luật không đạt')
  const approved = row(entry('PICKUP_APPROVED', { placed: 2, unplaced: 1, overridden: true, driverId: 31, pickupStopId: 8 }))
  expect(approved.details).toBe('3 kiện nhận dọc đường · 1 kiện chưa có chỗ trên xe · Duyệt vượt luật')
  expect(row(entry('PICKUP_REJECTED', { reason: 'Xe đã đầy', driverId: 31 }), en).details).toBe('Reason: Xe đã đầy')
  expect(row({ ...entry('PICKUP_DELIVERED', { stopId: 9 }), entityName: 'PickupRequest' }).target).toBe('Yêu cầu nhận dọc đường')
  const dropped = row(entry('PICKUP_PACKAGES_DROPPED', { droppedPackages: 2, reason: 'Chuyến đã huỷ', tripCancelled: true }))
  expect(dropped.action).toBe('Bỏ kiện nhận dọc đường chưa lên xe khi huỷ chuyến')
  expect(dropped.details).toContain('2 kiện nhận dọc đường')
})
