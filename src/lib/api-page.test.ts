import { expect, test, vi } from 'vitest'
import { createApiClient } from './api-client'
import { fetchAllPages } from './api-page'

/** Client với `fetch` giả: trả lần lượt các thân phản hồi, ghi lại địa chỉ đã gọi. */
function clientReturning(...bodies: unknown[]) {
  const urls: string[] = []
  const fetchImpl = vi.fn((url: string) => {
    urls.push(url)
    const body = bodies[urls.length - 1]
    return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(body)) } as Response)
  })
  const client = createApiClient({ baseUrl: 'http://api.test', accessToken: () => Promise.resolve('T'), fetch: fetchImpl as unknown as typeof fetch })
  return { client, urls }
}

test('PageResponse: reads every page until the last one, keeping the caller query', async () => {
  const { client, urls } = clientReturning(
    { success: true, data: [{ id: 1 }, { id: 2 }], page: 0, size: 2, totalPages: 2, last: false },
    { success: true, data: [{ id: 3 }], page: 1, size: 2, totalPages: 2, last: true },
  )
  await expect(fetchAllPages('/api/packages', { query: { status: 'IMPORTED' }, size: 2 }, client)).resolves.toStrictEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
  expect(urls).toStrictEqual(['http://api.test/api/packages?status=IMPORTED&page=0&size=2', 'http://api.test/api/packages?status=IMPORTED&page=1&size=2'])
})

test('a Spring page inside the envelope: content plus last, or the newer page block', async () => {
  const classic = clientReturning({ success: true, data: { content: [{ id: 1 }], last: false } }, { success: true, data: { content: [{ id: 2 }], last: true } })
  await expect(fetchAllPages('/api/companies', {}, classic.client)).resolves.toStrictEqual([{ id: 1 }, { id: 2 }])
  const modern = clientReturning({ success: true, data: { content: [{ id: 1 }], page: { number: 0, totalPages: 1 } } })
  await expect(fetchAllPages('/api/companies', {}, modern.client)).resolves.toStrictEqual([{ id: 1 }])
  expect(modern.urls).toHaveLength(1)
})

test('a plain list (bare or enveloped) is read once, never paged again', async () => {
  const bare = clientReturning([{ id: 1 }, { id: 2 }])
  await expect(fetchAllPages('/api/subscription/plans', { size: 1 }, bare.client)).resolves.toStrictEqual([{ id: 1 }, { id: 2 }])
  expect(bare.urls).toHaveLength(1)
  const enveloped = clientReturning({ success: true, data: [{ id: 1 }] })
  await expect(fetchAllPages('/api/users', { size: 1 }, enveloped.client)).resolves.toStrictEqual([{ id: 1 }])
  expect(enveloped.urls).toHaveLength(1)
})

test('stops after maxPages so a backend that never says "last" cannot loop forever', async () => {
  const endless = clientReturning(
    { success: true, data: [{ id: 1 }], last: false },
    { success: true, data: [{ id: 2 }], last: false },
    { success: true, data: [{ id: 3 }], last: false },
  )
  await expect(fetchAllPages('/api/x', { maxPages: 2 }, endless.client)).resolves.toStrictEqual([{ id: 1 }, { id: 2 }])
})
