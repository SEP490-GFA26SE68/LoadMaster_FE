import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import type { User } from '@/types/user'
import { createUser, deleteUser, fetchUserCompanies, fetchUsers, resetPassword, setUserStatus, updateUser } from './users-api'

/**
 * Màn Người dùng nối backend (`VITE_AUTH_SOURCE=keycloak`): mỗi hàm gọi đúng endpoint, gửi đúng thân, đổi DTO của backend sang `User`.
 * `fetch` giả trả phong bì như backend thật (nhánh `feat/contract-and-support-ticket`).
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', keycloak: { url: '', realm: '', clientId: '' } },
}))

type Call = { readonly method: string; readonly url: string; readonly body: unknown; readonly auth: string | null }

let calls: Call[] = []
let reply: unknown = null

beforeEach(() => {
  calls = []
  connectApiAuth(() => Promise.resolve('token-1'))
  vi.stubGlobal('fetch', (input: string, init: RequestInit) => {
    const headers = init.headers as Record<string, string>
    calls.push({
      method: init.method ?? 'GET',
      url: input,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
      auth: headers.Authorization ?? null,
    })
    const body = reply instanceof Response ? reply : new Response(JSON.stringify(reply), { status: 200 })
    return Promise.resolve(body)
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const envelope = (data: unknown) => ({ success: true, code: null, message: 'ok', data })

const DISPATCHER = {
  id: 11, keycloakId: 'kc-11', email: 'thu.contract2@loadmaster.local', fullName: 'Điều phối hợp đồng', phoneNumber: '0900000003',
  userRoleType: 'DISPATCHER', status: 'ACTIVE', companyId: 2, companyName: 'FastMove Transport',
}

const AS_USER: User = {
  id: '11', fullName: 'Điều phối hợp đồng', email: 'thu.contract2@loadmaster.local', phone: '0900 000 003', role: 'dispatcher',
  status: 'active', lastActiveAt: null, companyId: '2',
}

test('danh sách: một trang lớn, kèm token; vai trò và trạng thái của backend đổi sang của FE', async () => {
  reply = envelope([
    DISPATCHER,
    { ...DISPATCHER, id: 3, email: 'thu.admin@loadmaster.local', userRoleType: 'ADMIN', status: 'LOCKED', phoneNumber: null },
    { ...DISPATCHER, id: 1, email: 'admin@loadmaster.local', userRoleType: 'SYSTEM_ADMIN', companyId: null },
    { ...DISPATCHER, id: 99, userRoleType: 'AUDITOR' },
  ])
  const users = await fetchUsers()
  expect(calls).toStrictEqual([{ method: 'GET', url: 'http://be.test/api/users?page=0&size=500', body: undefined, auth: 'Bearer token-1' }])
  expect(users[0]).toStrictEqual(AS_USER)
  expect(users[1]).toMatchObject({ id: '3', role: 'companyAdmin', status: 'suspended', phone: '' })
  expect(users[2]).toMatchObject({ id: '1', role: 'systemAdmin' })
  expect(users[2]).not.toHaveProperty('companyId')
  // Vai trò backend chưa có ở FE không vào danh sách
  expect(users).toHaveLength(3)
})

test('tên công ty: trang của Spring, không có phong bì', async () => {
  reply = { content: [{ id: 2, companyCode: 'FAST-MOVE', companyName: 'FastMove Transport' }], totalElements: 1 }
  expect(await fetchUserCompanies()).toStrictEqual([{ id: '2', name: 'FastMove Transport' }])
  expect(calls[0]?.url).toBe('http://be.test/api/companies?page=0&size=500')
})

test('tạo: gửi số điện thoại không khoảng trắng và tên vai trò hiện tại của backend; trả mật khẩu tạm', async () => {
  reply = envelope({ user: DISPATCHER, temporaryPassword: 'Tmp#12345' })
  const result = await createUser({ fullName: 'Điều phối hợp đồng', email: 'thu.contract2@loadmaster.local', phone: '0900 000 003', role: 'manager', depot: '' })
  expect(calls[0]).toMatchObject({
    method: 'POST',
    url: 'http://be.test/api/users',
    body: { email: 'thu.contract2@loadmaster.local', fullName: 'Điều phối hợp đồng', phoneNumber: '0900000003', role: 'MANAGER' },
  })
  expect(result).toStrictEqual({ user: AS_USER, temporaryPassword: 'Tmp#12345' })
})

test('sửa: gửi đủ tên, số điện thoại, vai trò; đổi email bị từ chối trước khi gọi', async () => {
  reply = envelope({ ...DISPATCHER, fullName: 'Tên mới', userRoleType: 'WAREHOUSE_WORKER' })
  const updated = await updateUser('11', { fullName: 'Tên mới', role: 'warehouse' }, AS_USER)
  expect(calls[0]).toMatchObject({
    method: 'PUT',
    url: 'http://be.test/api/users/11',
    body: { fullName: 'Tên mới', phoneNumber: '0900000003', role: 'WAREHOUSE_WORKER' },
  })
  expect(updated).toMatchObject({ fullName: 'Tên mới', role: 'warehouse' })

  await expect(updateUser('11', { email: 'khac@loadmaster.local' }, AS_USER)).rejects.toMatchObject({ code: 'EMAIL_CHANGE_UNSUPPORTED' })
  expect(calls).toHaveLength(1)
})

test('khoá, mở khoá, xoá, đặt lại mật khẩu', async () => {
  reply = envelope({ ...DISPATCHER, status: 'LOCKED' })
  expect(await setUserStatus('11', 'suspended')).toMatchObject({ status: 'suspended' })
  reply = envelope(DISPATCHER)
  await setUserStatus('11', 'active')
  reply = envelope(null)
  await deleteUser('11')
  reply = envelope({ userId: 11, user: DISPATCHER, temporaryPassword: 'Tmp#67890' })
  expect(await resetPassword('11')).toStrictEqual({ user: AS_USER, temporaryPassword: 'Tmp#67890' })
  expect(calls.map(({ method, url, body }) => [method, url, body])).toStrictEqual([
    ['PATCH', 'http://be.test/api/users/11/status', { status: 'LOCKED' }],
    ['PATCH', 'http://be.test/api/users/11/status', { status: 'ACTIVE' }],
    ['DELETE', 'http://be.test/api/users/11', undefined],
    ['POST', 'http://be.test/api/users/11/reset-password', undefined],
  ])
})

test('backend từ chối: lỗi mang mã nghiệp vụ của phong bì', async () => {
  reply = new Response(JSON.stringify({ success: false, code: 'EMAIL_ALREADY_EXISTS', message: 'Email đã được sử dụng' }), { status: 409 })
  await expect(createUser({ fullName: 'A', email: 'a@b.vn', phone: '0900000000', role: 'driver', depot: '' }))
    .rejects.toMatchObject({ name: 'ApiError', code: 'EMAIL_ALREADY_EXISTS', status: 409 })
})
