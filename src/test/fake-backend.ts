import { vi } from 'vitest'

/**
 * Backend giả cho test của nhóm chức năng đã nối backend (FE-0-09): thay `fetch` toàn cục bằng bảng `"METHOD /đường"` → phản hồi,
 * ghi lại mọi lượt gọi để test kiểm app gọi gì — và không gọi gì. Đường không khai báo trả 404 như backend. Test tự `vi.mock`
 * `@/lib/backend-config` để bật nhóm của mình (mock phải nằm trong chính file test mới được đưa lên đầu).
 */
export type FakeCall = {
  readonly method: string
  readonly path: string
  readonly query: Readonly<Record<string, string>>
  readonly body: unknown
  readonly form: FormData | undefined
}

/** `text`: thân không phải JSON (file tải về). */
export type FakeReply = { readonly status?: number; readonly body?: unknown; readonly text?: string }
export type FakeRoutes = Record<string, FakeReply | ((call: FakeCall) => FakeReply)>

export function stubBackend(routes: FakeRoutes): { readonly calls: FakeCall[] } {
  const calls: FakeCall[] = []
  vi.stubGlobal('fetch', (input: string, init: RequestInit = {}) => {
    const url = new URL(input)
    const call: FakeCall = {
      method: init.method ?? 'GET',
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
      form: init.body instanceof FormData ? init.body : undefined,
    }
    calls.push(call)
    const route = routes[`${call.method} ${call.path}`]
    const reply = route === undefined ? { status: 404, body: { success: false, message: 'Not found' } } : typeof route === 'function' ? route(call) : route
    const payload = reply.text ?? (reply.body === undefined ? null : JSON.stringify(reply.body))
    return Promise.resolve(new Response(payload, { status: reply.status ?? 200 }))
  })
  return { calls }
}

/** Phong bì thành công của backend. */
export const envelope = (data: unknown) => ({ success: true, message: 'ok', data })

/** Một trang (trang cuối) của danh sách phân trang. */
export const page = (content: readonly unknown[]) => ({ content, last: true, number: 0, totalPages: 1 })
