import { expect, test } from 'vitest'
import { createMockDb, type MockDb, type NewGuestContact } from '@/lib/mock-db'

/**
 * Yêu cầu liên hệ của khách (`ContactOfGuest`): khách chưa có tài khoản gửi từ form công khai; ba vai trò nền tảng đọc, nhận việc, đổi trạng
 * thái và ghi chú. Yêu cầu không thuộc công ty nào, nên phiên của một công ty không đọc được.
 */

const NOW = new Date('2026-09-14T03:00:00.000Z')
const LATER = new Date('2026-09-14T05:30:00.000Z')
const SUPPORT = 'US-NT-02'
const PLATFORM_MANAGER = 'US-NT-01'
const SYSTEM_ADMIN = 'US-0005'
const DISPATCHER = 'US-0001'
const DRIVER = 'US-0004'

function dbAs(userId: string | null, now: () => Date = () => NOW): MockDb {
  const db = createMockDb({ now })
  db.restoreSession(userId)
  return db
}

const INPUT: NewGuestContact = {
  fullName: '  Đặng Minh Khôi ', email: 'khoi.dang@vantaibinhan.vn', phoneNumber: '0912 345 678', companyName: 'Vận tải Bình An',
  interestedPlanId: 'PLAN-001', requestType: 'PRICING', message: 'Cần báo giá gói Basic cho ba xe tải.',
}

test('a guest without a session sends a request: it is new, trimmed, coded LH-004 and logged for no company', async () => {
  const db = dbAs(null)
  const contact = await db.createGuestContact(INPUT)
  expect(contact).toStrictEqual({
    id: 'LH-004', fullName: 'Đặng Minh Khôi', email: INPUT.email, phoneNumber: '0912 345 678', companyName: 'Vận tải Bình An',
    interestedPlanId: 'PLAN-001', message: INPUT.message, requestType: 'PRICING', status: 'NEW', createdAt: NOW.toISOString(),
  })
  expect((await db.listEvents())[0]).toMatchObject({
    action: 'contact.received', actorId: null, companyId: null, target: { type: 'contact', id: 'LH-004' }, params: { fullName: 'Đặng Minh Khôi', contactType: 'PRICING' },
  })
})

test('blank optional fields are left out, and a signed-in person of a company may also send one', async () => {
  const db = dbAs(DRIVER)
  const contact = await db.createGuestContact({ fullName: 'Nguyễn Văn Tâm', email: 'tam@gmail.com', requestType: 'OTHER', phoneNumber: '  ', message: '' })
  expect(contact).toStrictEqual({ id: 'LH-004', fullName: 'Nguyễn Văn Tâm', email: 'tam@gmail.com', requestType: 'OTHER', status: 'NEW', createdAt: NOW.toISOString() })
  // Người của công ty gửi được nhưng không đọc được danh sách
  await expect(db.listGuestContacts()).rejects.toMatchObject({ code: 'ROLE_NOT_ALLOWED', params: { role: 'driver' } })
})

test.each([
  ['fullName', { fullName: '   ' }],
  ['fullName', { fullName: 'x'.repeat(151) }],
  ['email', { email: '' }],
  ['email', { email: 'khoi.dang' }],
  ['email', { email: `${'x'.repeat(146)}@a.vn` }],
  // Ký tự của truy vấn chèn người nhận, tiêu đề vào liên kết `mailto:` của người xử lý
  ['email', { email: 'a@b.vn?cc=x%40y.vn&subject=hi' }],
  ['phoneNumber', { phoneNumber: '0'.repeat(31) }],
  ['companyName', { companyName: 'x'.repeat(201) }],
  ['message', { message: 'x'.repeat(2001) }],
  ['requestType', { requestType: 'SALES' }],
  ['interestedPlanId', { interestedPlanId: 'PLAN-999' }],
])('a request with a bad %s is refused and nothing is stored', async (field, change) => {
  const db = dbAs(null)
  await expect(db.createGuestContact({ ...INPUT, ...change } as NewGuestContact)).rejects.toMatchObject({ code: 'CONTACT_INVALID', params: { field } })
  db.restoreSession(SUPPORT)
  expect((await db.listGuestContacts()).map((contact) => contact.id)).toStrictEqual(['LH-001', 'LH-002', 'LH-003'])
})

test.each([SUPPORT, PLATFORM_MANAGER, SYSTEM_ADMIN])('%s reads every request, newest first, and opens one by its code', async (userId) => {
  const db = dbAs(userId)
  const contacts = await db.listGuestContacts()
  expect(contacts.map((contact) => [contact.id, contact.status, contact.assignedToId ?? null]))
    .toStrictEqual([['LH-001', 'NEW', null], ['LH-002', 'IN_PROGRESS', SUPPORT], ['LH-003', 'RESOLVED', SUPPORT]])
  expect((await db.getGuestContact('LH-002')).assignedToName).toBe('Tạ Thị Ngọc Ánh')
  await expect(db.getGuestContact('LH-999')).rejects.toMatchObject({ code: 'NOT_FOUND', params: { collection: 'guestContacts', id: 'LH-999' } })
})

test('a company session cannot read, open or update requests', async () => {
  for (const userId of [DISPATCHER, DRIVER]) {
    const db = dbAs(userId)
    await expect(db.listGuestContacts()).rejects.toMatchObject({ code: 'ROLE_NOT_ALLOWED' })
    await expect(db.getGuestContact('LH-001')).rejects.toMatchObject({ code: 'ROLE_NOT_ALLOWED' })
    await expect(db.updateGuestContact('LH-001', { status: 'CLOSED' })).rejects.toMatchObject({ code: 'ROLE_NOT_ALLOWED' })
  }
})

test('taking a request: assign it, move it on, write a note — one event with the changed fields; no change logs nothing', async () => {
  const db = dbAs(SUPPORT)
  const before = (await db.listEvents()).length
  const updated = await db.updateGuestContact('LH-001', { status: 'IN_PROGRESS', assignedToId: PLATFORM_MANAGER, note: ' Gọi lại sáng mai ' })
  expect(updated).toMatchObject({ status: 'IN_PROGRESS', assignedToId: PLATFORM_MANAGER, assignedToName: 'Đinh Quang Huy', note: 'Gọi lại sáng mai' })
  expect(updated.resolvedAt).toBeUndefined()
  const events = await db.listEvents()
  expect(events).toHaveLength(before + 1)
  expect(events[0]).toMatchObject({
    action: 'contact.updated', actorId: SUPPORT, companyId: null, target: { type: 'contact', id: 'LH-001' },
    params: { fullName: 'Lê Hoàng Nam', fields: 'status,assignedToId,note', contactStatus: 'IN_PROGRESS', assignedTo: PLATFORM_MANAGER },
  })

  await db.updateGuestContact('LH-001', { status: 'IN_PROGRESS', assignedToId: PLATFORM_MANAGER, note: 'Gọi lại sáng mai' })
  expect(await db.listEvents()).toHaveLength(before + 1)

  // Bỏ người nhận và xoá ghi chú
  const cleared = await db.updateGuestContact('LH-001', { assignedToId: null, note: '' })
  expect([cleared.assignedToId, cleared.assignedToName, cleared.note]).toStrictEqual([undefined, undefined, undefined])
  expect((await db.listEvents())[0]?.params).toStrictEqual({ fullName: 'Lê Hoàng Nam', fields: 'assignedToId,note' })
})

test('resolvedAt is set the first time a request is resolved or closed, and kept when it is reopened', async () => {
  let now = NOW
  const db = dbAs(SYSTEM_ADMIN, () => now)
  expect((await db.updateGuestContact('LH-001', { status: 'CLOSED' })).resolvedAt).toBe(NOW.toISOString())
  now = LATER
  expect((await db.updateGuestContact('LH-001', { status: 'NEW' })).resolvedAt).toBe(NOW.toISOString())
  expect((await db.updateGuestContact('LH-001', { status: 'RESOLVED' })).resolvedAt).toBe(NOW.toISOString())
  // Đang xử lý rồi giải quyết lần đầu: mốc là lúc đó
  expect((await db.updateGuestContact('LH-002', { status: 'RESOLVED' })).resolvedAt).toBe(LATER.toISOString())
})

test('the assignee must be an active person of a handling role; a bad status or a too long note is refused', async () => {
  const db = dbAs(SUPPORT)
  for (const assignedToId of [DISPATCHER, 'US-9999']) {
    await expect(db.updateGuestContact('LH-001', { assignedToId })).rejects.toMatchObject({ code: 'CONTACT_INVALID', params: { field: 'assignedToId' } })
  }
  await expect(db.updateGuestContact('LH-001', { status: 'DONE' as never })).rejects.toMatchObject({ code: 'CONTACT_INVALID', params: { field: 'status' } })
  await expect(db.updateGuestContact('LH-001', { note: 'x'.repeat(2001) })).rejects.toMatchObject({ code: 'CONTACT_INVALID', params: { field: 'note' } })
  expect((await db.getGuestContact('LH-001')).status).toBe('NEW')
})

test('every limit is inclusive and counted after trimming: 150, 150, 30, 200, 2000 characters are kept', async () => {
  const db = dbAs(null)
  const email = `${'k'.repeat(145)}@a.vn`
  const contact = await db.createGuestContact({
    ...INPUT,
    fullName: `  ${'H'.repeat(150)}  `,
    email: ` ${email} `,
    phoneNumber: `  ${'0'.repeat(30)} `,
    companyName: ` ${'C'.repeat(200)}  `,
    message: `
${'m'.repeat(2000)}
`,
  })
  expect([contact.fullName.length, contact.email, contact.phoneNumber?.length, contact.companyName?.length, contact.message?.length])
    .toStrictEqual([150, email, 30, 200, 2000])
})

test('an internal note of 2000 characters is kept, surrounding spaces are not counted; one more is refused', async () => {
  const db = dbAs(SUPPORT)
  expect((await db.updateGuestContact('LH-001', { note: `  ${'n'.repeat(2000)}  ` })).note).toHaveLength(2000)
  await expect(db.updateGuestContact('LH-001', { note: 'n'.repeat(2001) })).rejects.toMatchObject({ code: 'CONTACT_INVALID', params: { field: 'note' } })
})

test('a locked handler cannot be given a request: nothing changes and nothing is logged', async () => {
  const db = dbAs(SYSTEM_ADMIN)
  await db.setUserStatus(PLATFORM_MANAGER, 'suspended')
  db.restoreSession(SUPPORT)
  const before = await db.listEvents()
  await expect(db.updateGuestContact('LH-001', { status: 'IN_PROGRESS', assignedToId: PLATFORM_MANAGER }))
    .rejects.toMatchObject({ code: 'CONTACT_INVALID', params: { field: 'assignedToId' } })
  const stored = await db.getGuestContact('LH-001')
  expect([stored.status, stored.assignedToId]).toStrictEqual(['NEW', undefined])
  expect(await db.listEvents()).toHaveLength(before.length)
})
