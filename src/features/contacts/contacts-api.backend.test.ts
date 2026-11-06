import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { listContactHandlers, listContactPlanNames, listGuestContacts, updateGuestContact } from './contacts-api'

/**
 * Lớp dữ liệu của `/lien-he-khach` khi nhóm `contacts` nối backend. `/api/contact-guests` trả DTO trần (không phong bì), `/api/users`
 * trả `PageResponse`; `fetch` giả theo đúng hai dạng đó.
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['contacts']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'contacts',
}))

let routes: Record<string, unknown> = {}
let requested: string[] = []

beforeEach(() => {
  requested = []
  connectApiAuth(() => Promise.resolve('token-1'))
  vi.stubGlobal('fetch', (input: string, init: RequestInit) => {
    const key = `${init.method ?? 'GET'} ${input.replace('http://be.test', '')}`
    requested.push(key)
    return Promise.resolve(key in routes ? new Response(JSON.stringify(routes[key]), { status: 200 }) : new Response('{}', { status: 404 }))
  })
})

afterEach(() => vi.unstubAllGlobals())

const DTO = {
  id: 5, fullName: 'Phạm Thị Thu', email: 'thu@example.com', phoneNumber: '', companyName: null, interestedPlanId: null,
  interestedPlanName: null, assignedToId: 4, assignedToName: 'Tạ Thị Ngọc Ánh', message: 'Hỏi thông tin', requestType: 'INQUIRY',
  status: 'RESOLVED', note: 'Đã gọi lại', createdAt: '2026-10-15T03:00:00.5Z', resolvedAt: '2026-10-16T01:02:03.123456Z',
}

const me = (id: number, fullName: string, userRoleType: string) => ({ success: true, data: { id, fullName, userRoleType, status: 'ACTIVE' } })

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

test('clearing the note sends an empty note; taking a request away from everyone is refused before any request', async () => {
  routes = { 'PATCH /api/contact-guests/5': { ...DTO, note: '' } }
  expect(await updateGuestContact('5', { note: '' })).not.toHaveProperty('note')
  await expect(updateGuestContact('5', { assignedToId: null })).rejects.toThrow()
  expect(requested).toStrictEqual(['PATCH /api/contact-guests/5'])
})

test('a system admin may give a request to any active platform account; company staff and locked accounts are left out', async () => {
  routes = {
    'GET /api/users/me': me(2, 'Võ Minh Khoa', 'SYSTEM_ADMIN'),
    'GET /api/users?page=0&size=200': {
      success: true, page: 0, size: 200, totalPages: 1, last: true,
      data: [
        { id: 7, fullName: 'Nguyễn Thanh Tùng', userRoleType: 'DISPATCHER', status: 'ACTIVE' },
        { id: 4, fullName: 'Tạ Thị Ngọc Ánh', userRoleType: 'SYSTEM_SUPPORTER', status: 'ACTIVE' },
        { id: 3, fullName: 'Đinh Quang Huy', userRoleType: 'SYSTEM_MANAGER', status: 'LOCKED' },
        { id: 2, fullName: 'Võ Minh Khoa', userRoleType: 'SYSTEM_ADMIN', status: 'ACTIVE' },
      ],
    },
  }
  expect(await listContactHandlers()).toStrictEqual([
    { id: '4', name: 'Tạ Thị Ngọc Ánh', role: 'systemSupporter' },
    { id: '2', name: 'Võ Minh Khoa', role: 'systemAdmin' },
  ])
})

test('a supporter cannot read the user list of the backend: the only person to give a request to is themself', async () => {
  routes = { 'GET /api/users/me': me(4, 'Tạ Thị Ngọc Ánh', 'SYSTEM_SUPPORTER') }
  expect(await listContactHandlers()).toStrictEqual([{ id: '4', name: 'Tạ Thị Ngọc Ánh', role: 'systemSupporter' }])
  expect(requested).toStrictEqual(['GET /api/users/me'])
})
