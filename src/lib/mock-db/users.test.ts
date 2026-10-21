import { expect, test } from 'vitest'
import { createMockDb } from '@/lib/mock-db'

const NOW = new Date('2026-09-14T03:00:00.000Z')
const newDb = () => createMockDb({ now: () => NOW })

test('signing in sets the session, stamps the last activity and logs who signed in (D-42, D-43)', async () => {
  const db = newDb()
  const user = await db.authenticate(' QuanTri@loadmaster.vn ', 'loadmaster')
  expect([user.id, user.lastActiveAt, db.sessionUser()?.id]).toStrictEqual(['US-0005', NOW.toISOString(), 'US-0005'])
  const [event] = await db.listEvents()
  expect([event?.action, event?.actorId, event?.target]).toStrictEqual(['auth.signedIn', 'US-0005', { type: 'user', id: 'US-0005' }])
  await db.signOut()
  expect(db.sessionUser()).toBeNull()
  expect((await db.listEvents())[0]?.action).toBe('auth.signedOut')
})

test('a wrong password and an unknown email give the same error; a locked account is refused', async () => {
  const db = newDb()
  await expect(db.authenticate('quantri@loadmaster.vn', 'sai-mat-khau')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
  await expect(db.authenticate('khong-co@loadmaster.vn', 'loadmaster')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
  await expect(db.authenticate('lan.bui@loadmaster.vn', 'loadmaster')).rejects.toMatchObject({ code: 'ACCOUNT_SUSPENDED' })
  const failures = (await db.listEvents()).filter((event) => event.action === 'auth.signInFailed')
  expect(failures.map((event) => event.actorId)).toStrictEqual([null, null, null])
  expect(db.sessionUser()).toBeNull()
})

test('an account created by the company admin joins that company and signs in with its temporary password; the email must be free', async () => {
  const db = newDb()
  await db.authenticate('qtcongty@loadmaster.vn', 'loadmaster')
  const input = { fullName: 'Phan Thị Yến', email: 'yen.phan@loadmaster.vn', phone: '0915 678 903', role: 'driver' as const, depot: 'Kho Long Bình' }
  const { user, temporaryPassword } = await db.createUser(input)
  expect(user).toStrictEqual({ ...input, companyId: 'LOG-001', id: 'US-0016', status: 'active', lastActiveAt: null })
  expect(temporaryPassword).toMatch(/^[A-Za-z2-9]{10}$/)
  await expect(db.createUser({ ...input, email: 'YEN.PHAN@loadmaster.vn' })).rejects.toMatchObject({ code: 'EMAIL_TAKEN' })
  await db.signOut()
  expect((await db.authenticate('yen.phan@loadmaster.vn', temporaryPassword)).id).toBe('US-0016')
})

test('the seed has three platform accounts without a company or depot, and the staff of two logistics companies (FE-0-03)', async () => {
  const db = newDb()
  const users = await db.listUsers()
  const account = (email: string) => {
    const user = users.find((item) => item.email === email)
    return user && { id: user.id, role: user.role, companyId: user.companyId, depot: user.depot }
  }
  expect(account('quantri@loadmaster.vn')).toStrictEqual({ id: 'US-0005', role: 'systemAdmin', companyId: undefined, depot: undefined })
  expect(account('nentang@loadmaster.vn')).toStrictEqual({ id: 'US-NT-01', role: 'systemManager', companyId: undefined, depot: undefined })
  expect(account('hotro@loadmaster.vn')).toStrictEqual({ id: 'US-NT-02', role: 'systemSupporter', companyId: undefined, depot: undefined })
  expect(account('qtcongty@loadmaster.vn')).toStrictEqual({ id: 'US-LB-01', role: 'companyAdmin', companyId: 'LOG-001', depot: 'Trụ sở TP. Hồ Chí Minh' })
  expect(users.filter((user) => user.companyId === undefined).map((user) => user.role)).toStrictEqual(['systemAdmin', 'systemManager', 'systemSupporter'])
  // Long Bình: 11 nhân viên có từ trước và quản trị công ty; tài khoản nhà sản xuất, logistics của Review 1 đã bỏ (FE-0-06)
  expect(users.filter((user) => user.companyId === 'LOG-001')).toHaveLength(12)
  expect(users.map((user) => user.email).filter((email) => email === 'sanxuat@loadmaster.vn' || email === 'logistics@loadmaster.vn')).toStrictEqual([])
  expect(new Set(users.map((user) => user.companyId))).toStrictEqual(new Set([undefined, 'LOG-001', 'LOG-002']))
  // Phương Nam đủ năm vai trò công ty: `viet.lam@` thành nhân viên kho
  expect(users.filter((user) => user.companyId === 'LOG-002').map((user) => [user.id, user.email, user.role])).toStrictEqual([
    ['US-0015', 'viet.lam@phuongnam.vn', 'warehouse'],
    ['US-PN-01', 'qtcongty@phuongnam.vn', 'companyAdmin'],
    ['US-PN-02', 'quanly@phuongnam.vn', 'companyManager'],
    ['US-PN-03', 'dieuphoi@phuongnam.vn', 'dispatcher'],
    ['US-PN-04', 'taixe@phuongnam.vn', 'driver'],
  ])
  // Tài khoản mới đăng nhập được bằng mật khẩu chung của seed
  expect((await db.authenticate('nentang@loadmaster.vn', 'loadmaster')).role).toBe('systemManager')
  expect((await db.authenticate('dieuphoi@phuongnam.vn', 'loadmaster')).id).toBe('US-PN-03')
})

test('a platform account has no depot or company: both are dropped on creation and ignored when it is edited (FE-0-03)', async () => {
  const db = newDb()
  await db.authenticate('quantri@loadmaster.vn', 'loadmaster')
  const { user } = await db.createUser({ fullName: 'Vương Thị Bích Ngọc', email: 'ngoc.vuong@loadmaster.vn', phone: '0926 971 238', role: 'systemSupporter', depot: 'Kho Long Bình', companyId: 'LOG-001' })
  expect(user).toStrictEqual({ fullName: 'Vương Thị Bích Ngọc', email: 'ngoc.vuong@loadmaster.vn', phone: '0926 971 238', role: 'systemSupporter', id: 'US-0016', status: 'active', lastActiveAt: null })

  // Sửa một tài khoản nền tảng mà form gửi kèm ô kho rỗng: không tính là thay đổi, không ghi nhật ký
  const before = (await db.listEvents()).length
  expect(await db.updateUser('US-NT-01', { depot: '' })).not.toHaveProperty('depot')
  expect((await db.listEvents()).length).toBe(before)
  await db.updateUser('US-NT-01', { phone: '0918 204 000', depot: 'Kho Sóng Thần' })
  expect((await db.listEvents())[0]).toMatchObject({ action: 'user.updated', params: { fields: 'phone' } })
  expect(await db.getUser('US-NT-01')).not.toHaveProperty('depot')

  // Vai trò đổi được trong ba vai trò nền tảng; tài khoản vẫn không có kho hay công ty
  const moved = await db.updateUser('US-NT-01', { role: 'systemSupporter', depot: 'Kho Sóng Thần' })
  expect([moved.role, 'depot' in moved, 'companyId' in moved]).toStrictEqual(['systemSupporter', false, false])
})

test('resetting a password invalidates the old one; changing it needs the current password and 8 characters', async () => {
  const db = newDb()
  await db.authenticate('quantri@loadmaster.vn', 'loadmaster')
  const { temporaryPassword } = await db.resetPassword('US-0001')
  await db.signOut()
  await expect(db.authenticate('dieuphoi@loadmaster.vn', 'loadmaster')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
  await db.authenticate('dieuphoi@loadmaster.vn', temporaryPassword)
  await expect(db.changePassword('loadmaster', 'mat-khau-moi')).rejects.toMatchObject({ code: 'PASSWORD_INCORRECT' })
  await expect(db.changePassword(temporaryPassword, 'ngan')).rejects.toMatchObject({ code: 'PASSWORD_TOO_SHORT', params: { min: 8 } })
  await db.changePassword(temporaryPassword, 'mat-khau-moi')
  await db.signOut()
  expect((await db.authenticate('dieuphoi@loadmaster.vn', 'mat-khau-moi')).id).toBe('US-0001')
  await db.signOut()
  await expect(db.changePassword('mat-khau-moi', 'khac-nua-roi')).rejects.toMatchObject({ code: 'NOT_SIGNED_IN' })
})

test('nobody locks, deletes or demotes themselves; a driver with open trips stays', async () => {
  const db = newDb()
  await db.authenticate('quantri@loadmaster.vn', 'loadmaster')
  await expect(db.setUserStatus('US-0005', 'suspended')).rejects.toMatchObject({ code: 'SELF_CHANGE_FORBIDDEN' })
  await expect(db.deleteUser('US-0005')).rejects.toMatchObject({ code: 'SELF_CHANGE_FORBIDDEN' })
  await expect(db.updateUser('US-0005', { role: 'systemManager' })).rejects.toMatchObject({ code: 'SELF_CHANGE_FORBIDDEN' })
  await db.authenticate('qtcongty@loadmaster.vn', 'loadmaster')
  await expect(db.setUserStatus('US-LB-01', 'suspended')).rejects.toMatchObject({ code: 'SELF_CHANGE_FORBIDDEN' })
  await expect(db.updateUser('US-LB-01', { role: 'companyManager' })).rejects.toMatchObject({ code: 'SELF_CHANGE_FORBIDDEN' })
  await expect(db.deleteUser('US-0004')).rejects.toMatchObject({ code: 'USER_IN_USE', params: { tripIds: ['TRIP-2026-0914', 'TRIP-010'] } })
  expect((await db.setUserStatus('US-0006', 'suspended')).status).toBe('suspended')
  await db.deleteUser('US-0009')
  await expect(db.getUser('US-0009')).rejects.toMatchObject({ code: 'NOT_FOUND', params: { collection: 'users' } })
})

/** FE-0-08 (D-65): phạm vi quản lý người dùng theo vai trò của phiên, kho kiểm như server. Mã và tên lấy từ `seed-users.ts`. */
const PLATFORM_USER = { fullName: 'Vương Thị Bích Ngọc', email: 'ngoc.vuong@loadmaster.vn', phone: '0926 971 238', role: 'systemSupporter' as const }
const COMPANY_USER = { fullName: 'Phan Thị Yến', email: 'yen.phan@loadmaster.vn', phone: '0915 678 903', role: 'driver' as const, depot: 'Kho Long Bình' }

test('the system admin creates platform accounts only, and does not edit or delete company staff (FE-0-08)', async () => {
  const db = newDb()
  await db.authenticate('quantri@loadmaster.vn', 'loadmaster')
  const before = { users: (await db.listUsers()).length, events: (await db.listEvents()).length }

  // Vai trò công ty: từ chối dù có gửi kèm công ty hay không — không còn tài khoản vai trò công ty mà thiếu công ty
  await expect(db.createUser(COMPANY_USER)).rejects.toMatchObject({ code: 'ROLE_OUT_OF_SCOPE', params: { role: 'driver' } })
  await expect(db.createUser({ ...COMPANY_USER, role: 'companyAdmin', companyId: 'LOG-001' })).rejects.toMatchObject({ code: 'ROLE_OUT_OF_SCOPE', params: { role: 'companyAdmin' } })
  // Nhân sự công ty do quản trị công ty đó quản lý: không sửa, không xoá
  await expect(db.updateUser('US-0009', { phone: '0909 000 111' })).rejects.toMatchObject({ code: 'USER_MANAGED_BY_COMPANY', params: { userId: 'US-0009' } })
  await expect(db.updateUser('US-0009', { role: 'systemSupporter' })).rejects.toMatchObject({ code: 'USER_MANAGED_BY_COMPANY' })
  await expect(db.deleteUser('US-0009')).rejects.toMatchObject({ code: 'USER_MANAGED_BY_COMPANY', params: { userId: 'US-0009' } })
  // Tài khoản nền tảng không thành tài khoản công ty
  await expect(db.updateUser('US-NT-01', { role: 'dispatcher', depot: 'Kho Sóng Thần' })).rejects.toMatchObject({ code: 'ROLE_OUT_OF_SCOPE', params: { role: 'dispatcher' } })
  expect({ users: (await db.listUsers()).length, events: (await db.listEvents()).length }).toStrictEqual(before)

  // Khoá, mở khoá, đặt lại mật khẩu: mọi người, ở công ty nào cũng được
  expect((await db.setUserStatus('US-PN-04', 'suspended')).status).toBe('suspended')
  expect((await db.setUserStatus('US-PN-04', 'active')).status).toBe('active')
  expect((await db.resetPassword('US-0009')).temporaryPassword).toMatch(/^[A-Za-z2-9]{10}$/)
  // Tài khoản nền tảng: tạo, sửa, xoá
  const { user } = await db.createUser(PLATFORM_USER)
  expect((await db.updateUser(user.id, { role: 'systemManager', phone: '0926 971 000' })).role).toBe('systemManager')
  await db.deleteUser(user.id)
  await expect(db.getUser(user.id)).rejects.toMatchObject({ code: 'NOT_FOUND' })
})

test('a company admin manages the company roles of the own company only (FE-0-08)', async () => {
  const db = newDb()
  await db.authenticate('qtcongty@loadmaster.vn', 'loadmaster')
  // Không tạo và không nâng ai lên vai trò nền tảng: người đó sẽ rời công ty
  await expect(db.createUser({ ...PLATFORM_USER, depot: '' })).rejects.toMatchObject({ code: 'ROLE_OUT_OF_SCOPE', params: { role: 'systemSupporter' } })
  await expect(db.updateUser('US-0009', { role: 'systemAdmin' })).rejects.toMatchObject({ code: 'ROLE_OUT_OF_SCOPE', params: { role: 'systemAdmin' } })
  expect((await db.getUser('US-0009')).role).toBe('dispatcher')
  // Tài khoản nền tảng và người của công ty khác: đọc không thấy, ghi bị từ chối
  for (const id of ['US-0005', 'US-PN-02']) {
    await expect(db.getUser(id), id).rejects.toMatchObject({ code: 'NOT_FOUND', params: { collection: 'users', id } })
    await expect(db.setUserStatus(id, 'suspended'), id).rejects.toMatchObject({ code: 'FORBIDDEN_COMPANY', params: { collection: 'users', id } })
    await expect(db.resetPassword(id), id).rejects.toMatchObject({ code: 'FORBIDDEN_COMPANY' })
    await expect(db.updateUser(id, { phone: '0900 000 000' }), id).rejects.toMatchObject({ code: 'FORBIDDEN_COMPANY' })
    await expect(db.deleteUser(id), id).rejects.toMatchObject({ code: 'FORBIDDEN_COMPANY' })
  }
  expect((await db.listUsers()).map((user) => user.companyId)).toStrictEqual(Array.from({ length: 12 }, () => 'LOG-001'))

  // Năm vai trò công ty, kể cả một quản trị công ty nữa: tạo, sửa, khoá, đặt lại mật khẩu, xoá
  const created = await db.createUser({ ...COMPANY_USER, role: 'companyAdmin' })
  expect([created.user.id, created.user.role, created.user.companyId]).toStrictEqual(['US-0016', 'companyAdmin', 'LOG-001'])
  expect((await db.updateUser('US-0009', { role: 'companyManager', depot: 'Trụ sở TP. Hồ Chí Minh' })).role).toBe('companyManager')
  expect((await db.setUserStatus('US-0009', 'suspended')).status).toBe('suspended')
  expect((await db.resetPassword('US-0009')).user.id).toBe('US-0009')
  await db.deleteUser('US-0009')
  expect((await db.listUsers()).map((user) => user.id)).not.toContain('US-0009')
})

test('each company keeps one active company admin and the platform one active system admin (FE-0-08)', async () => {
  const db = newDb()
  // Mỗi công ty seed chỉ có một quản trị công ty: quản trị hệ thống không khoá được — quản trị công ty của công ty kia không tính
  await db.authenticate('quantri@loadmaster.vn', 'loadmaster')
  await expect(db.setUserStatus('US-LB-01', 'suspended')).rejects.toMatchObject({ code: 'LAST_ADMIN' })
  await expect(db.setUserStatus('US-PN-01', 'suspended')).rejects.toMatchObject({ code: 'LAST_ADMIN' })

  // Có quản trị công ty thứ hai thì người thứ nhất khoá được; người còn lại thành người cuối cùng
  await db.authenticate('qtcongty@loadmaster.vn', 'loadmaster')
  const { user: second, temporaryPassword } = await db.createUser({ ...COMPANY_USER, role: 'companyAdmin' })
  await db.authenticate(second.email, temporaryPassword)
  expect((await db.setUserStatus('US-LB-01', 'suspended')).status).toBe('suspended')
  await db.authenticate('quantri@loadmaster.vn', 'loadmaster')
  await expect(db.setUserStatus(second.id, 'suspended')).rejects.toMatchObject({ code: 'LAST_ADMIN' })
  // Không có phiên (test logic kho) luật vẫn giữ: không khoá, không hạ vai trò, không xoá người cuối cùng
  await db.signOut()
  await expect(db.setUserStatus(second.id, 'suspended')).rejects.toMatchObject({ code: 'LAST_ADMIN' })
  await expect(db.updateUser(second.id, { role: 'companyManager' })).rejects.toMatchObject({ code: 'LAST_ADMIN' })
  await expect(db.deleteUser(second.id)).rejects.toMatchObject({ code: 'LAST_ADMIN' })
  // Quản trị công ty đã khoá không phải "đang hoạt động cuối cùng": xoá được
  await db.deleteUser('US-LB-01')

  // Nền tảng: quản trị hệ thống duy nhất; hai quản trị công ty đang hoạt động không thay được
  await expect(db.setUserStatus('US-0005', 'suspended')).rejects.toMatchObject({ code: 'LAST_ADMIN' })
  await expect(db.updateUser('US-0005', { role: 'systemManager' })).rejects.toMatchObject({ code: 'LAST_ADMIN' })
  await expect(db.deleteUser('US-0005')).rejects.toMatchObject({ code: 'LAST_ADMIN' })
  await db.authenticate('quantri@loadmaster.vn', 'loadmaster')
  const other = await db.createUser({ ...PLATFORM_USER, role: 'systemAdmin' })
  await db.authenticate(other.user.email, other.temporaryPassword)
  expect((await db.setUserStatus('US-0005', 'suspended')).status).toBe('suspended')
})

test('an event about an account belongs to the company of that account, whoever did it (FE-0-08)', async () => {
  const db = newDb()
  // Seed: bốn việc quản trị hệ thống làm trên tài khoản của Long Bình (mới nhất trước) thuộc Long Bình
  const seeded = (await db.listEvents({ actorId: 'US-0005' })).map((event) => [event.action, event.target.id, event.companyId])
  expect(seeded).toStrictEqual([
    ['user.created', 'US-0012', 'LOG-001'], ['user.locked', 'US-0008', 'LOG-001'], ['user.created', 'US-0011', 'LOG-001'], ['user.created', 'US-0010', 'LOG-001'],
  ])

  await db.authenticate('quantri@loadmaster.vn', 'loadmaster')
  await db.setUserStatus('US-0009', 'suspended')
  await db.resetPassword('US-PN-04')
  const { user } = await db.createUser(PLATFORM_USER)
  expect((await db.listEvents()).slice(0, 4).map((event) => [event.action, event.target.id, event.companyId])).toStrictEqual([
    ['user.created', user.id, null], ['user.passwordReset', 'US-PN-04', 'LOG-002'], ['user.locked', 'US-0009', 'LOG-001'], ['auth.signedIn', 'US-0005', null],
  ])
  // Lọc theo công ty; `null` là sự kiện của nền tảng
  expect(new Set((await db.listEvents({ company: 'LOG-002' })).map((event) => event.companyId))).toStrictEqual(new Set(['LOG-002']))
  expect((await db.listEvents({ company: null })).map((event) => [event.action, event.companyId])).toStrictEqual([['user.created', null], ['auth.signedIn', null]])

  // Quản trị công ty của Long Bình đọc được việc quản trị hệ thống làm trên người của mình — cả bốn sự kiện seed — và tên người làm
  db.restoreSession('US-LB-01')
  expect((await db.listEvents({ actorId: 'US-0005' })).map((event) => [event.action, event.target.id])).toStrictEqual([
    ['user.locked', 'US-0009'], ['user.created', 'US-0012'], ['user.locked', 'US-0008'], ['user.created', 'US-0011'], ['user.created', 'US-0010'],
  ])
  expect((await db.listAuditNames()).users.filter((item) => item.id === 'US-0005')).toStrictEqual([{ id: 'US-0005', fullName: 'Võ Minh Khoa', role: 'systemAdmin' }])
  expect((await db.listUsers()).map((item) => item.id)).not.toContain('US-0005')
  db.restoreSession('US-PN-01')
  expect((await db.listEvents({ actorId: 'US-0005' })).map((event) => [event.action, event.target.id])).toStrictEqual([['user.passwordReset', 'US-PN-04']])

  // Xoá tài khoản: sự kiện vẫn thuộc công ty của tài khoản vừa xoá (không có phiên thì không rơi về công ty mặc định)
  db.restoreSession(null)
  await db.deleteUser('US-PN-02')
  expect((await db.listEvents())[0]).toMatchObject({ action: 'user.deleted', target: { id: 'US-PN-02' }, actorId: null, companyId: 'LOG-002' })
})

test('a stored session is restored only for an active account and does not write the history', async () => {
  const db = newDb()
  const before = (await db.listEvents()).length
  expect(db.restoreSession('US-0008')).toBeNull()
  expect(db.restoreSession('US-0404')).toBeNull()
  expect(db.restoreSession('US-0002')?.id).toBe('US-0002')
  expect(db.sessionUser()?.id).toBe('US-0002')
  // Đếm lại khi kho không có phiên: phiên của Long Bình chỉ đọc nhật ký của công ty mình (FE-0-02)
  db.restoreSession(null)
  expect((await db.listEvents()).length).toBe(before)
})

test('the signed-in user edits their own name and phone', async () => {
  const db = newDb()
  await db.authenticate('taixe@loadmaster.vn', 'loadmaster')
  const updated = await db.updateProfile({ fullName: ' Phạm Quốc Dũng ', phone: '0904 000 111' })
  expect([updated.fullName, updated.phone]).toStrictEqual(['Phạm Quốc Dũng', '0904 000 111'])
  expect((await db.listEvents())[0]).toMatchObject({ action: 'user.profileUpdated', actorId: 'US-0004', params: { fields: 'phone' } })
})

test('every write adds exactly one history event, made by the session user', async () => {
  const db = newDb()
  await db.authenticate('dieuphoi@loadmaster.vn', 'loadmaster')
  const count = async () => (await db.listEvents()).length
  const start = await count()
  await db.updateTrip('TRIP-012', { name: 'Tuyến Bình Chánh – Biên Hoà (sáng)' })
  await db.createVehicle({ ...(await db.getVehicle('VEHICLE-005')), name: 'Hino XZU650 · 51D-100.01' })
  await db.setVehicleMaintenance('VEHICLE-005', 'Thay lốp')
  await db.cancelTrip('TRIP-014', 'Khách đổi ngày')
  expect(await count()).toBe(start + 4)
  const recent = (await db.listEvents()).slice(0, 4)
  expect(recent.map((event) => [event.action, event.actorId])).toStrictEqual([
    ['trip.cancelled', 'US-0001'],
    ['vehicle.maintenanceOn', 'US-0001'],
    ['vehicle.created', 'US-0001'],
    ['trip.updated', 'US-0001'],
  ])
  // saving without changes is not a write
  await db.updateTrip('TRIP-012', { name: 'Tuyến Bình Chánh – Biên Hoà (sáng)' })
  expect(await count()).toBe(start + 4)
})

test('the history filters by day (Vietnam time), actor and target', async () => {
  const db = createMockDb({ today: '2026-09-19' })
  const today = await db.listEvents({ from: '2026-09-19', to: '2026-09-19' })
  expect(today.length).toBeGreaterThan(0)
  expect(today.every((event) => new Date(Date.parse(event.at) + 7 * 3600_000).toISOString().startsWith('2026-09-19'))).toBe(true)
  expect((await db.listEvents({ actorId: 'US-0005' })).every((event) => event.actorId === 'US-0005')).toBe(true)
  const trip = await db.listEvents({ targetId: 'trip-004' })
  expect(new Set(trip.map((event) => event.target.id))).toStrictEqual(new Set(['TRIP-004']))
  expect(trip[0]?.action).toBe('trip.cancelled')
})
