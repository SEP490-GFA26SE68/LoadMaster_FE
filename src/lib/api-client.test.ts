import { expect, test, vi } from 'vitest'
import { ApiError, createApiClient } from './api-client'

type Call = { url: string; init: RequestInit }

function respond(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, text: () => Promise.resolve(body === undefined ? '' : JSON.stringify(body)) } as Response
}

function clientWith(response: Response | (() => Promise<Response>), token: string | null = 'TOKEN') {
  const calls: Call[] = []
  const fetchImpl = vi.fn((url: string, init: RequestInit) => {
    calls.push({ url, init })
    return typeof response === 'function' ? response() : Promise.resolve(response)
  })
  const client = createApiClient({ baseUrl: 'http://api.test', accessToken: () => Promise.resolve(token), fetch: fetchImpl as unknown as typeof fetch, timeoutMs: 20 })
  return { client, calls }
}

async function failure(run: () => Promise<unknown>): Promise<ApiError> {
  try {
    await run()
  } catch (error) {
    if (error instanceof ApiError) return error
    throw error
  }
  throw new Error('lượt gọi không ném lỗi')
}

test('opens the backend envelope and returns its data, sending the session token', async () => {
  const { client, calls } = clientWith(respond(200, { success: true, data: { id: 7 } }))
  await expect(client.get('/api/users/me', { query: { page: 0, q: 'biên hoà', skip: undefined } })).resolves.toStrictEqual({ id: 7 })
  expect(calls[0]?.url).toBe('http://api.test/api/users/me?page=0&q=bi%C3%AAn+ho%C3%A0')
  expect(calls[0]?.init.headers).toMatchObject({ Authorization: 'Bearer TOKEN', Accept: 'application/json' })
})

test('sends a JSON body; without a session there is no Authorization header', async () => {
  const { client, calls } = clientWith(respond(200, { success: true, data: null }), null)
  await client.post('/api/users', { body: { email: 'a@b.vn' } })
  expect(calls[0]?.init).toMatchObject({ method: 'POST', body: '{"email":"a@b.vn"}' })
  expect(calls[0]?.init.headers).toMatchObject({ 'Content-Type': 'application/json' })
  expect(calls[0]?.init.headers).not.toHaveProperty('Authorization')
})

test('a business error keeps the backend code, the HTTP status and the parameters', async () => {
  const { client } = clientWith(respond(409, { success: false, code: 'USER_ALREADY_EXISTS', message: 'không hiện ra màn', errors: { email: 'a@b.vn' } }))
  expect(await failure(() => client.post('/api/users'))).toMatchObject({ code: 'USER_ALREADY_EXISTS', status: 409, params: { email: 'a@b.vn' } })
})

test('statuses without a code map to transport codes', async () => {
  expect((await failure(() => clientWith(respond(401, undefined)).client.get('/x'))).code).toBe('UNAUTHENTICATED')
  expect((await failure(() => clientWith(respond(403, undefined)).client.get('/x'))).code).toBe('UNAUTHORIZED')
  const broken = { ok: false, status: 500, text: () => Promise.resolve('<html>') } as Response
  expect((await failure(() => clientWith(broken).client.get('/x'))).code).toBe('SERVER_ERROR')
})

test('no response at all is NETWORK_ERROR; a request that outlives the limit is TIMEOUT', async () => {
  const offline = clientWith(() => Promise.reject(new TypeError('Failed to fetch')))
  expect(await failure(() => offline.client.get('/x'))).toMatchObject({ code: 'NETWORK_ERROR', status: 0 })

  const slow = createApiClient({
    baseUrl: 'http://api.test',
    accessToken: () => Promise.resolve(null),
    timeoutMs: 10,
    fetch: ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('aborted')))
      })) as unknown as typeof fetch,
  })
  expect((await failure(() => slow.get('/x'))).code).toBe('TIMEOUT')
})
