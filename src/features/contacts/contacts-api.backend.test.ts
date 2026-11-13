import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { listContactHandlers, listContactPlanNames, listGuestContacts, updateGuestContact } from './contacts-api'

/** Lớp dữ liệu của `/lien-he-khach` khi nhóm `contacts` nối backend. `/api/contact-guests…` trả DTO trần (không phong bì). */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['contacts']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'contacts',
}))

let routes: Record<string, unknown> = {}
let requested: string[] = []
let bodies: unknown[] = []

beforeEach(() => {
  requested = []
  bodies = []
  connectApiAuth(() => Promise.resolve('token-1'))
  vi.stubGlobal('fetch', (input: string, init: RequestInit) => {
    const key = `${init.method ?? 'GET'} ${input.replace('http://be.test', '')}`
    requested.push(key)
    if (typeof init.body === 'string') bodies.push(JSON.parse(init.body))
    return Promise.resolve(key in routes ? new Response(JSON.stringify(routes[key]), { status: 200 }) : new Response('{}', { status: 404 }))
  })
})

afterEach(() => vi.unstubAllGlobals())

const DTO = {
  id: 5, fullName: 'Phạm Thị Thu', email: 'thu@example.com', phoneNumber: '', companyName: null, interestedPlanId: null,
  interestedPlanName: null, assignedToId: 4, assignedToName: 'Tạ Thị Ngọc Ánh', message: 'Hỏi thông tin', requestType: 'INQUIRY',
  status: 'RESOLVED', note: 'Đã gọi lại', createdAt: '2026-10-15T03:00:00.5Z', resolvedAt: '2026-10-16T01:02:03.123456Z',
}

test('the list keeps the order of the backend, turns ids into strings and skips a status the screen does not know', async () => {
  routes = { 'GET /api/contact-guests': [DTO, { ...DTO, id: 9, status: 'SPAM' }] }
  expect(await listGuestContacts()).toStrictEqual([{
    id: '5', fullName: 'Phạm Thị Thu', email: 'thu@example.com', message: 'Hỏi thông tin', requestType: 'INQUIRY', status: 'RESOLVED',
    assignedToId: '4', assignedToName: 'Tạ Thị Ngọc Ánh', note: 'Đã gọi lại', createdAt: '2026-10-15T03:00:00.500Z',
    resolvedAt: '2026-10-16T01:02:03.123Z',
  }])
  // Tên gói đi kèm từng yêu cầu: không đọc danh mục gói
  expect(await listContactPlanNames()).toStrictEqual(new Map())
})

test('clearing the note sends an empty note; taking a request away from everyone sends the unassign flag, not a null', async () => {
  routes = { 'PATCH /api/contact-guests/5': { ...DTO, note: '' } }
  expect(await updateGuestContact('5', { note: '' })).not.toHaveProperty('note')
  routes = { 'PATCH /api/contact-guests/5': { ...DTO, assignedToId: null, assignedToName: null } }
  const unassigned = await updateGuestContact('5', { assignedToId: null })
  expect(unassigned).not.toHaveProperty('assignedToId')
  await updateGuestContact('5', { status: 'IN_PROGRESS', assignedToId: '2' })
  expect(bodies).toStrictEqual([{ note: '' }, { unassign: true }, { status: 'IN_PROGRESS', assignedToId: 2 }])
})

test('the people a request can go to come from the server, by name; a role the app does not know is left out', async () => {
  routes = {
    'GET /api/contact-guests/handlers': [
      { id: 4, fullName: 'Tạ Thị Ngọc Ánh', email: 'hotro@loadmaster.vn', role: 'SYSTEM_SUPPORTER' },
      { id: 2, fullName: 'Võ Minh Khoa', email: 'quantri@loadmaster.vn', role: 'SYSTEM_ADMIN' },
      { id: 9, fullName: 'Bùi Lạ', email: 'la@loadmaster.vn', role: 'AUDITOR' },
    ],
  }
  expect(await listContactHandlers()).toStrictEqual([
    { id: '4', name: 'Tạ Thị Ngọc Ánh', role: 'systemSupporter' },
    { id: '2', name: 'Võ Minh Khoa', role: 'systemAdmin' },
  ])
  expect(requested).toStrictEqual(['GET /api/contact-guests/handlers'])
})
