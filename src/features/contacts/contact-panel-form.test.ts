import { expect, test } from 'vitest'
import type { GuestContact } from '@/lib/mock-db'
import { createFormatter } from '@/lib/format'
import { contactPanelValues, contactPatch, mailtoHref, NO_ASSIGNEE, readableNote, type ContactPanelValues } from './contact-panel-form'

const CONTACT: GuestContact = {
  id: 'LH-002', fullName: 'Phạm Thu Trang', email: 'trang.pham@xanhlogistics.vn', requestType: 'DEMO_REQUEST', status: 'IN_PROGRESS',
  assignedToId: 'US-NT-02', assignedToName: 'Tạ Thị Ngọc Ánh', note: 'Hẹn xem thử thứ Năm.', createdAt: '2026-09-12T02:00:00.000Z',
}
const ALL_DIRTY = { status: true, assignee: true, note: true }
const values = (change: Partial<ContactPanelValues> = {}): ContactPanelValues => ({ ...contactPanelValues(CONTACT), ...change })

test('nothing edited is nothing to save, and an edit back to the stored value is nothing to save either', () => {
  expect(contactPatch(CONTACT, values(), {})).toStrictEqual({})
  expect(contactPatch(CONTACT, values(), ALL_DIRTY)).toStrictEqual({})
})

test('only edited fields are sent: a field another person changed while the panel was open is not written back', () => {
  // Người khác đã chuyển yêu cầu sang Đã giải quyết; form còn giữ Đang xử lý nhưng người dùng chỉ sửa ghi chú
  const changedByOther: GuestContact = { ...CONTACT, status: 'RESOLVED' }
  expect(contactPatch(changedByOther, values({ note: 'Đã gửi tài liệu.' }), { note: true })).toStrictEqual({ note: 'Đã gửi tài liệu.' })
})

test('"none" removes the assignee; a note equal after trimming is left out; a cleared note is sent as an empty string', () => {
  expect(contactPatch(CONTACT, values({ assignee: NO_ASSIGNEE }), { assignee: true })).toStrictEqual({ assignedToId: null })
  expect(contactPatch(CONTACT, values({ note: '  Hẹn xem thử thứ Năm.  ' }), { note: true })).toStrictEqual({})
  expect(contactPatch(CONTACT, values({ note: '   ' }), { note: true })).toStrictEqual({ note: '' })
  expect(contactPatch(CONTACT, values({ status: 'CLOSED', assignee: 'US-NT-01' }), ALL_DIRTY)).toStrictEqual({ status: 'CLOSED', assignedToId: 'US-NT-01' })
})

test('the mail link encodes each side of the address, so a query cannot add recipients or a subject', () => {
  expect(mailtoHref('trang.pham@xanhlogistics.vn')).toBe('mailto:trang.pham@xanhlogistics.vn')
  expect(mailtoHref('a@b.vn?cc=x%40y.vn&subject=hi')).toBe('mailto:a@b.vn%3Fcc%3Dx%2540y.vn%26subject%3Dhi')
  expect(mailtoHref('a+b?x@c.vn')).toBe('mailto:a%2Bb%3Fx@c.vn')
})

test('a server timestamp in the note reads as date and time in Vietnam time, like the time a support ticket was sent', () => {
  const vi = createFormatter('vi-VN')
  const note = 'Đã gọi khách.\n[Phản hồi email lúc 2026-11-19T13:59:23.530714200Z]: xin chào tôi đã xem\n[Phản hồi email lúc 2026-11-20T01:05:00Z]: gửi lại báo giá'
  expect(readableNote(note, vi)).toBe(
    'Đã gọi khách.\n[Phản hồi email lúc 19/11/2026 20:59]: xin chào tôi đã xem\n[Phản hồi email lúc 20/11/2026 08:05]: gửi lại báo giá',
  )
  // Ngày giờ người dùng tự gõ (không múi giờ) và ghi chú đã đọc được giữ nguyên
  expect(readableNote('Hẹn 2026-11-21T09:00 gọi lại', vi)).toBe('Hẹn 2026-11-21T09:00 gọi lại')
  expect(readableNote('', vi)).toBe('')
})
