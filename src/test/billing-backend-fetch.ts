import { afterEach, beforeEach, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'

/**
 * `fetch` giả cho test các hàm gói cước, credit, thanh toán nối backend: ghi từng lượt gọi (phương thức, URL, thân, token) và trả phản
 * hồi. `routes` (khoá `"GET /api/…?query"`, không kèm gốc URL) trả cùng một phản hồi mỗi lần gọi — cho test màn, nơi thứ tự gọi do
 * React Query quyết; giá trị là JSON hoặc hàm dựng `Response`. Không khớp route thì lấy phản hồi kế tiếp của hàng đợi `replies`
 * (`Response` dùng nguyên, giá trị khác thành JSON 200). Test tự `vi.mock` cấu hình backend (nhóm `billing`, gốc `http://be.test`).
 */
export type FetchCall = { readonly method: string; readonly url: string; readonly body: unknown; readonly auth: string | null }

export type FakeBackend = { calls: FetchCall[]; replies: unknown[]; routes: Record<string, unknown>; token: string | null }

const BASE_URL = 'http://be.test'

function responseOf(reply: unknown): Response {
  if (reply instanceof Response) return reply
  if (typeof reply === 'function') return responseOf((reply as () => unknown)())
  return new Response(JSON.stringify(reply ?? null), { status: 200 })
}

export function useFakeBackend(): FakeBackend {
  const state: FakeBackend = { calls: [], replies: [], routes: {}, token: 'token-1' }
  beforeEach(() => {
    state.calls = []
    state.replies = []
    state.routes = {}
    state.token = 'token-1'
    connectApiAuth(() => Promise.resolve(state.token))
    vi.stubGlobal('fetch', (input: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>
      const method = init.method ?? 'GET'
      state.calls.push({ method, url: input, body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined, auth: headers.Authorization ?? null })
      const key = `${method} ${input.startsWith(BASE_URL) ? input.slice(BASE_URL.length) : input}`
      return Promise.resolve(responseOf(key in state.routes ? state.routes[key] : state.replies.shift()))
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })
  return state
}

/** Phong bì `ApiResponse` của backend. */
export const envelope = (data: unknown) => ({ success: true, code: null, message: 'ok', data })

/** Lỗi nghiệp vụ như `GlobalExceptionHandler` của backend `develop` trả: phong bì không có `code`. */
export const failure = (status: number) => new Response(JSON.stringify({ success: false, message: 'lỗi', data: null }), { status })

/** Phản hồi rỗng (204 của DELETE). */
export const noContent = () => new Response(null, { status: 204 })
