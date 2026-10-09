import { backendConfig } from './backend-config'

/**
 * Nơi duy nhất của app gọi `fetch` tới backend LoadMaster. Mỗi lượt gọi: gắn token của phiên, giới hạn thời gian, mở phong bì
 * `{ success, code, message, data, errors }` của backend và đổi mọi thất bại thành `ApiError` có **mã** — màn không hiện thông điệp
 * thô của máy chủ. `-api.ts` của feature đã nối backend dùng `api()`; không nơi nào khác gọi `fetch` tới backend.
 */

/** Lỗi không thuộc nghiệp vụ; mã nghiệp vụ là `code` backend trả trong phong bì. */
export const TRANSPORT_ERROR_CODES = ['NETWORK_ERROR', 'TIMEOUT', 'UNAUTHENTICATED', 'UNAUTHORIZED', 'SERVER_ERROR'] as const

export type TransportErrorCode = (typeof TRANSPORT_ERROR_CODES)[number]

export class ApiError extends Error {
  readonly code: string
  /** Mã HTTP; 0 khi không có phản hồi (mất mạng, quá giờ). */
  readonly status: number
  readonly params: Readonly<Record<string, unknown>>

  constructor(code: TransportErrorCode | (string & {}), { status = 0, params = {} }: { status?: number; params?: Readonly<Record<string, unknown>> } = {}) {
    super(code)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.params = params
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

export type ApiClientOptions = {
  readonly baseUrl: string
  /** Token truy cập của phiên hiện tại; `null` khi chưa đăng nhập. */
  readonly accessToken: () => Promise<string | null>
  readonly fetch?: typeof fetch
  readonly timeoutMs?: number
}

export type QueryValue = string | number | boolean | null | undefined

export type RequestOptions = {
  readonly query?: Readonly<Record<string, QueryValue>>
  readonly body?: unknown
}

export type ApiClient = {
  get<T>(path: string, options?: Omit<RequestOptions, 'body'>): Promise<T>
  post<T>(path: string, options?: RequestOptions): Promise<T>
  put<T>(path: string, options?: RequestOptions): Promise<T>
  patch<T>(path: string, options?: RequestOptions): Promise<T>
  delete<T>(path: string, options?: RequestOptions): Promise<T>
}

type Envelope = { success?: unknown; code?: unknown; data?: unknown; errors?: unknown }

const DEFAULT_TIMEOUT_MS = 15_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function urlOf(baseUrl: string, path: string, query: RequestOptions['query']): string {
  const search = new URLSearchParams()
  for (const [name, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) search.set(name, String(value))
  }
  const suffix = search.toString()
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}${suffix === '' ? '' : `?${suffix}`}`
}

function codeOfStatus(status: number): TransportErrorCode {
  if (status === 401) return 'UNAUTHENTICATED'
  if (status === 403) return 'UNAUTHORIZED'
  return 'SERVER_ERROR'
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (text.trim() === '') return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

/** Gọi `fetch` hiện hành của trình duyệt ở từng lượt (không giữ tham chiếu lúc tạo client). */
const browserFetch: typeof fetch = (input, init) => fetch(input, init)

export function createApiClient({ baseUrl, accessToken, fetch: fetchImpl = browserFetch, timeoutMs = DEFAULT_TIMEOUT_MS }: ApiClientOptions): ApiClient {
  async function request<T>(method: string, path: string, { query, body }: RequestOptions = {}): Promise<T> {
    const token = await accessToken()
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (token !== null) headers.Authorization = `Bearer ${token}`

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    let response: Response
    try {
      response = await fetchImpl(urlOf(baseUrl, path, query), {
        method,
        headers,
        signal: controller.signal,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
    } catch {
      throw new ApiError(controller.signal.aborted ? 'TIMEOUT' : 'NETWORK_ERROR')
    } finally {
      clearTimeout(timer)
    }

    const payload = await readJson(response)
    const envelope: Envelope | null = isRecord(payload) && 'success' in payload ? payload : null

    if (!response.ok || envelope?.success === false) {
      const code = typeof envelope?.code === 'string' && envelope.code !== '' ? envelope.code : codeOfStatus(response.status)
      throw new ApiError(code, { status: response.status, params: isRecord(envelope?.errors) ? envelope.errors : {} })
    }
    return (envelope === null ? payload : envelope.data) as T
  }

  return {
    get: (path, options) => request('GET', path, options),
    post: (path, options) => request('POST', path, options),
    put: (path, options) => request('PUT', path, options),
    patch: (path, options) => request('PATCH', path, options),
    delete: (path, options) => request('DELETE', path, options),
  }
}

let tokenSource: () => Promise<string | null> = () => Promise.resolve(null)
let client: ApiClient | undefined

/** `AuthProvider` nối phiên đăng nhập vào client: mỗi lượt gọi hỏi lại token (phiên tự làm mới token sắp hết hạn). */
export function connectApiAuth(accessToken: () => Promise<string | null>): void {
  tokenSource = accessToken
}

/** Client của backend theo `VITE_API_URL`, dùng trong `-api.ts` của feature đã nối backend. */
export function api(): ApiClient {
  client ??= createApiClient({ baseUrl: backendConfig.apiUrl, accessToken: () => tokenSource() })
  return client
}
