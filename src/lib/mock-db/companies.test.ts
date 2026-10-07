import { expect, test } from 'vitest'
import { createMockDb, type NewCompany } from '@/lib/mock-db'

/**
 * Công ty do quản trị hệ thống quản lý (FE-8-06, D-65): tạo cùng Quản trị công ty đầu tiên, sửa, danh sách kèm gói. Cách ly dữ liệu
 * giữa hai công ty seed nằm ở `tenancy.test.ts`; ở đây là luật riêng của việc tạo và sửa công ty.
 */

const NOW = new Date('2026-09-14T03:00:00.000Z')
const SYSTEM_ADMIN = 'US-0005'

const NEW_COMPANY: NewCompany = {
  name: 'Công ty TNHH Vận tải Biển Hồ',
  address: '25 Quốc lộ 1A, P. Tân Thới Hiệp, Quận 12, TP. Hồ Chí Minh',
  phone: '0283 812 3456',
  depot: { name: 'Kho Tân Thới Hiệp', address: '25 Quốc lộ 1A, Quận 12', lat: 10.8631, lng: 106.6372 },
  admin: { fullName: 'Hồ Thị Thu Hà', email: 'ha.ho@bienho.vn', phone: '0931 245 678' },
}

function adminDb() {
  const db = createMockDb({ now: () => NOW })
  db.restoreSession(SYSTEM_ADMIN)
  return db
}

test('the overview lists both seed companies with their plan, the plan status and the number of users', async () => {
  const rows = await adminDb().listCompanyOverview()
  expect(rows.map((row) => [row.company.id, row.current?.plan.name, row.planStatus, row.userCount])).toStrictEqual([
    ['LOG-001', 'Pro', 'ACTIVE', 12],
    ['LOG-002', 'Basic', 'ACTIVE', 5],
  ])
})

test('creating a company also creates its first company admin, with a temporary password shown once; the company has no plan', async () => {
  const db = adminDb()
  const { company, user, temporaryPassword } = await db.createCompany(NEW_COMPANY)
  expect(company).toStrictEqual({ id: 'LOG-003', name: NEW_COMPANY.name, address: NEW_COMPANY.address, phone: NEW_COMPANY.phone, depot: NEW_COMPANY.depot })
  expect(user).toStrictEqual({
    id: 'US-0016', fullName: 'Hồ Thị Thu Hà', email: 'ha.ho@bienho.vn', phone: '0931 245 678', role: 'companyAdmin', status: 'active',
    depot: 'Kho Tân Thới Hiệp', companyId: 'LOG-003', lastActiveAt: null,
  })
  expect(temporaryPassword).toMatch(/^[A-Za-z2-9]{10}$/)
  const created = (await db.listCompanyOverview()).find((row) => row.company.id === 'LOG-003')
  expect([created?.current, created?.planStatus, created?.userCount]).toStrictEqual([null, null, 1])
  expect((await db.listEvents()).slice(0, 2).map((event) => [event.action, event.actorId, event.companyId, event.target.id])).toStrictEqual([
    ['user.created', SYSTEM_ADMIN, 'LOG-003', 'US-0016'],
    ['company.created', SYSTEM_ADMIN, null, 'LOG-003'],
  ])

  // Người quản trị đầu tiên đăng nhập bằng mật khẩu tạm, chỉ thấy công ty của mình và chưa có gói
  await db.signOut()
  expect((await db.authenticate('ha.ho@bienho.vn', temporaryPassword)).role).toBe('companyAdmin')
  expect((await db.listCompanies()).map((item) => item.id)).toStrictEqual(['LOG-003'])
  expect(await db.getCurrentSubscription()).toBeNull()
  expect((await db.listUsers()).map((item) => item.id)).toStrictEqual(['US-0016'])
})

test.each([
  ['name', { name: '  ' }],
  ['address', { address: '' }],
  ['phone', { phone: ' ' }],
  ['depot.name', { depot: { ...NEW_COMPANY.depot, name: '' } }],
  ['depot.coordinates', { depot: { ...NEW_COMPANY.depot, lat: 91 } }],
  ['admin.fullName', { admin: { ...NEW_COMPANY.admin, fullName: '' } }],
  ['admin.email', { admin: { ...NEW_COMPANY.admin, email: 'khong-phai-email' } }],
  ['admin.phone', { admin: { ...NEW_COMPANY.admin, phone: '' } }],
])('a company with a bad %s is refused and nothing is written', async (field, change) => {
  const db = adminDb()
  const eventsBefore = (await db.listEvents()).length
  await expect(db.createCompany({ ...NEW_COMPANY, ...change })).rejects.toMatchObject({ code: 'COMPANY_INVALID', params: { field } })
  expect([(await db.listCompanyOverview()).length, (await db.listEvents()).length]).toStrictEqual([2, eventsBefore])
})

test('the first admin needs a free email, whatever its case', async () => {
  const db = adminDb()
  const taken = { ...NEW_COMPANY, admin: { ...NEW_COMPANY.admin, email: 'QTCongTy@LoadMaster.vn' } }
  await expect(db.createCompany(taken)).rejects.toMatchObject({ code: 'EMAIL_TAKEN' })
  expect((await db.listCompanyOverview()).length).toBe(2)
})

test.each([
  ['the platform manager', 'US-NT-01'],
  ['customer support', 'US-NT-02'],
  ['a company admin', 'US-LB-01'],
  ['a dispatcher', 'US-0001'],
])('%s may not list, create or edit companies', async (_who, userId) => {
  const db = createMockDb({ now: () => NOW })
  db.restoreSession(userId)
  await expect(db.listCompanyOverview()).rejects.toMatchObject({ code: 'ROLE_NOT_ALLOWED' })
  await expect(db.createCompany(NEW_COMPANY)).rejects.toMatchObject({ code: 'ROLE_NOT_ALLOWED' })
  await expect(db.updateCompany('LOG-001', NEW_COMPANY)).rejects.toMatchObject({ code: 'ROLE_NOT_ALLOWED' })
})

test('editing a company changes its information and depot and logs only what changed; saving the same data logs nothing', async () => {
  const db = adminDb()
  const [first] = await db.listCompanyOverview()
  const current = first?.company
  expect(current?.id).toBe('LOG-001')
  const base = { name: current?.name ?? '', address: current?.address ?? '', phone: current?.phone ?? '', depot: current?.depot ?? NEW_COMPANY.depot }

  const eventsBefore = (await db.listEvents()).length
  await db.updateCompany('LOG-001', base)
  expect((await db.listEvents()).length).toBe(eventsBefore)

  const depot = { ...base.depot, name: 'Kho Long Bình 2', lat: 10.95 }
  const saved = await db.updateCompany('LOG-001', { ...base, name: ' Công ty TNHH Vận tải Long Bình Mới ', depot })
  expect([saved.name, saved.depot]).toStrictEqual(['Công ty TNHH Vận tải Long Bình Mới', depot])
  expect((await db.listCompanies())[0]).toStrictEqual(saved)
  expect((await db.listEvents())[0]).toMatchObject({ action: 'company.updated', actorId: SYSTEM_ADMIN, params: { fields: 'companyName,departureDepot' } })
  await expect(db.updateCompany('LOG-001', { ...base, phone: '' })).rejects.toMatchObject({ code: 'COMPANY_INVALID', params: { field: 'phone' } })
  await expect(db.updateCompany('LOG-404', base)).rejects.toMatchObject({ code: 'NOT_FOUND' })
})
