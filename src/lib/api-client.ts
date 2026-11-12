import { backendConfig } from './backend-config'

/**
 * Nơi duy nhất của app gọi `fetch` tới backend LoadMaster. Mỗi lượt gọi: gắn token của phiên, giới hạn thời gian, mở phong bì
 * `{ success, code, message, data, errors }` của backend và đổi mọi thất bại thành `ApiError` có **mã** — màn không hiện thông điệp
 * thô của máy chủ. `-api.ts` của feature đã nối backend dùng `api()`; không nơi nào khác gọi `fetch` tới backend.
 */

/**
 * Lỗi không thuộc nghiệp vụ; mã nghiệp vụ là `code` backend trả trong phong bì. Phong bì không có `code` (backend `develop` chỉ trả mã
 * cho lỗi nhập file) thì mã suy từ HTTP: 400 `BAD_REQUEST`, 402 `PAYMENT_REQUIRED`, 404 `NOT_FOUND`, 409 `CONFLICT` — câu chung
 * nhưng vẫn đúng loại lỗi, không gộp hết vào "máy chủ gặp lỗi".
 */
export const TRANSPORT_ERROR_CODES = [
  'NETWORK_ERROR',
  'TIMEOUT',
  'UNAUTHENTICATED',
  'UNAUTHORIZED',
  'BAD_REQUEST',
  'PAYMENT_REQUIRED',
  'NOT_FOUND',
  'CONFLICT',
  'SERVER_ERROR',
] as const

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

/** Lỗi tạm thời của máy chủ: không có phản hồi (mất mạng, quá giờ — `status` 0) hoặc máy chủ lỗi 5xx. Thử lại sau có thể được. */
export function isTransientApiError(error: unknown): boolean {
  return isApiError(error) && (error.status === 0 || error.status >= 500)
}

export type ApiClientOptions = {
  readonly baseUrl: string
  /** Token truy cập của phiên hiện tại; `null` khi chưa đăng nhập. */
  readonly accessToken: () => Promise<string | null>
  /**
   * Máy chủ trả 401 cho token vừa gửi: làm mới token một lần (bỏ qua hạn còn lại) rồi gửi lại đúng lượt đó. `null` khi không còn phiên;
   * ném khi không làm mới được (mạng) — khi đó trả nguyên 401, phiên giữ nguyên.
   */
  readonly refreshToken?: () => Promise<string | null>
  /** Lượt gửi lại bằng token mới vẫn bị 401: phiên không dùng được với máy chủ này nữa. */
  readonly onUnauthorized?: () => void
  readonly fetch?: typeof fetch
  readonly timeoutMs?: number
}

export type QueryValue = string | number | boolean | null | undefined

export type RequestOptions = {
  readonly query?: Readonly<Record<string, QueryValue>>
  readonly body?: unknown
}

export type DownloadOptions = RequestOptions & { readonly method?: 'GET' | 'POST' }

export type ApiClient = {
  get<T>(path: string, options?: Omit<RequestOptions, 'body'>): Promise<T>
  post<T>(path: string, options?: RequestOptions): Promise<T>
  put<T>(path: string, options?: RequestOptions): Promise<T>
  patch<T>(path: string, options?: RequestOptions): Promise<T>
  delete<T>(path: string, options?: RequestOptions): Promise<T>
  /** GET trả nguyên thân phản hồi, không mở phong bì — để đọc số trang của danh sách phân trang (`fetchAllPages`). */
  getRaw(path: string, options?: Omit<RequestOptions, 'body'>): Promise<unknown>
  /** POST multipart (`FormData`, ví dụ file nhập): không đặt `Content-Type` để trình duyệt tự thêm boundary. */
  postForm<T>(path: string, form: FormData, options?: Omit<RequestOptions, 'body'>): Promise<T>
  /** Tải tệp (ảnh QR, PDF nhãn, mẫu Excel) về `Blob`; lỗi vẫn đọc mã từ phong bì JSON nếu máy chủ trả. */
  download(path: string, options?: DownloadOptions): Promise<Blob>
}

type Envelope = { success?: unknown; code?: unknown; data?: unknown; errors?: unknown }

/** Thân của một lượt gửi: JSON, multipart, hoặc không có. */
type Body = { readonly json: unknown } | { readonly form: FormData } | null

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

/** Mã theo HTTP khi phong bì không có `code`; `dataErrorMessage` cũng dùng nó cho mã nghiệp vụ app chưa có câu. */
export function codeOfStatus(status: number): TransportErrorCode {
  if (status === 401) return 'UNAUTHENTICATED'
  if (status === 403) return 'UNAUTHORIZED'
  if (status === 400 || status === 422) return 'BAD_REQUEST'
  if (status === 402) return 'PAYMENT_REQUIRED'
  if (status === 404) return 'NOT_FOUND'
  if (status === 409) return 'CONFLICT'
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

function envelopeOf(payload: unknown): Envelope | null {
  return isRecord(payload) && 'success' in payload ? payload : null
}

function failureOf(status: number, envelope: Envelope | null): ApiError {
  const code = typeof envelope?.code === 'string' && envelope.code !== '' ? envelope.code : codeOfStatus(status)
  return new ApiError(code, { status, params: isRecord(envelope?.errors) ? envelope.errors : {} })
}

/** Gọi `fetch` hiện hành của trình duyệt ở từng lượt (không giữ tham chiếu lúc tạo client). */
const browserFetch: typeof fetch = (input, init) => fetch(input, init)

/**
 * Gửi bằng token của phiên; 401 với token đã gửi thì làm mới token một lần và gửi lại. Vẫn 401 thì báo `onUnauthorized` (phiên kết thúc)
 * và trả phản hồi đó cho nơi gọi đổi thành lỗi như mọi lần. Không làm mới được vì mạng thì trả nguyên 401, giữ phiên.
 */
async function sendWithRetry(
  accessToken: () => Promise<string | null>,
  refreshToken: (() => Promise<string | null>) | undefined,
  onUnauthorized: (() => void) | undefined,
  sendWith: (token: string | null) => Promise<Response>,
): Promise<Response> {
  const token = await accessToken()
  const response = await sendWith(token)
  if (response.status !== 401 || token === null || refreshToken === undefined) return response
  let fresh: string | null
  try {
    fresh = await refreshToken()
  } catch {
    return response
  }
  // Keycloak đã đóng phiên: phiên tự báo kết thúc
  if (fresh === null) return response
  const retried = await sendWith(fresh)
  if (retried.status === 401) onUnauthorized?.()
  return retried
}

export function createApiClient({ baseUrl, accessToken, refreshToken, onUnauthorized, fetch: fetchImpl = browserFetch, timeoutMs = DEFAULT_TIMEOUT_MS }: ApiClientOptions): ApiClient {
  function send(method: string, path: string, query: RequestOptions['query'], body: Body, accept: string): Promise<Response> {
    return sendWithRetry(accessToken, refreshToken, onUnauthorized, (token) => sendOnce(method, path, query, body, accept, token))
  }

  async function sendOnce(method: string, path: string, query: RequestOptions['query'], body: Body, accept: string, token: string | null): Promise<Response> {
    const headers: Record<string, string> = { Accept: accept }
    if (body !== null && 'json' in body) headers['Content-Type'] = 'application/json'
    if (token !== null) headers.Authorization = `Bearer ${token}`

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fetchImpl(urlOf(baseUrl, path, query), {
        method,
        headers,
        signal: controller.signal,
        ...(body === null ? {} : { body: 'json' in body ? JSON.stringify(body.json) : body.form }),
      })
    } catch {
      throw new ApiError(controller.signal.aborted ? 'TIMEOUT' : 'NETWORK_ERROR')
    } finally {
      clearTimeout(timer)
    }
  }

  /** Gửi rồi kiểm thất bại; trả nguyên thân và phong bì (nếu có). */
  async function exchange(method: string, path: string, query: RequestOptions['query'], body: Body) {
    const response = await send(method, path, query, body, 'application/json')
    const payload = await readJson(response)
    const envelope = envelopeOf(payload)
    if (!response.ok || envelope?.success === false) throw failureOf(response.status, envelope)
    return { payload, envelope }
  }

  async function request<T>(method: string, path: string, { query, body }: RequestOptions = {}): Promise<T> {
    const { payload, envelope } = await exchange(method, path, query, body === undefined ? null : { json: body })
    return (envelope === null ? payload : envelope.data) as T
  }

  async function postForm<T>(path: string, form: FormData, { query }: Omit<RequestOptions, 'body'> = {}): Promise<T> {
    const { payload, envelope } = await exchange('POST', path, query, { form })
    return (envelope === null ? payload : envelope.data) as T
  }

  async function download(path: string, { method = 'GET', query, body }: DownloadOptions = {}): Promise<Blob> {
    const response = await send(method, path, query, body === undefined ? null : { json: body }, '*/*')
    if (!response.ok) throw failureOf(response.status, envelopeOf(await readJson(response)))
    return response.blob()
  }

  return {
    get: (path, options) => request('GET', path, options),
    post: (path, options) => request('POST', path, options),
    put: (path, options) => request('PUT', path, options),
    patch: (path, options) => request('PATCH', path, options),
    delete: (path, options) => request('DELETE', path, options),
    getRaw: async (path, options) => (await exchange('GET', path, options?.query, null)).payload,
    postForm,
    download,
  }
}

/** Hai việc của phiên khi máy chủ trả 401: làm mới token ngay, và đóng phiên khi token mới vẫn bị từ chối. */
export type ApiAuthRecovery = {
  readonly refreshToken: () => Promise<string | null>
  readonly onUnauthorized: () => void
}

let tokenSource: () => Promise<string | null> = () => Promise.resolve(null)
let recovery: ApiAuthRecovery | null = null
let client: ApiClient | undefined

/**
 * `AuthProvider` nối phiên đăng nhập vào client: mỗi lượt gọi hỏi lại token (phiên tự làm mới token sắp hết hạn); có `onRejected` thì
 * 401 được làm mới token một lần rồi gửi lại, vẫn 401 thì đóng phiên.
 */
export function connectApiAuth(accessToken: () => Promise<string | null>, onRejected: ApiAuthRecovery | null = null): void {
  tokenSource = accessToken
  recovery = onRejected
}

const refreshFromSession = () => recovery?.refreshToken() ?? Promise.resolve(null)
const rejectSession = () => recovery?.onUnauthorized()

/** Client của backend theo `VITE_API_URL`, dùng trong `-api.ts` của feature đã nối backend. */
export function api(): ApiClient {
  client ??= createApiClient({ baseUrl: backendConfig.apiUrl, accessToken: () => tokenSource(), refreshToken: refreshFromSession, onUnauthorized: rejectSession })
  return client
}

/**
 * Lối gọi của các `-api.ts` viết theo `fetch` (nhánh nối backend của nhóm): nhận `RequestInit`, trả **nguyên thân** JSON (không mở phong
 * bì), cùng token, giới hạn thời gian và cách đổi lỗi thành `ApiError` như `api()`. Code mới dùng `api()`.
 */
function rawFetch(path: string, init: RequestInit, accept: string): Promise<Response> {
  return sendWithRetry(() => tokenSource(), refreshFromSession, rejectSession, (token) => rawFetchOnce(path, init, accept, token))
}

async function rawFetchOnce(path: string, init: RequestInit, accept: string, token: string | null): Promise<Response> {
  const headers = new Headers(init.headers)
  if (token !== null) headers.set('Authorization', `Bearer ${token}`)
  if (!headers.has('Accept')) headers.set('Accept', accept)
  if (init.body != null && !(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)
  const onAbort = () => controller.abort()
  init.signal?.addEventListener('abort', onAbort, { once: true })
  try {
    return await browserFetch(urlOf(backendConfig.apiUrl, path, undefined), { ...init, headers, signal: controller.signal })
  } catch (error) {
    if (init.signal?.aborted) throw error
    throw new ApiError(controller.signal.aborted ? 'TIMEOUT' : 'NETWORK_ERROR')
  } finally {
    clearTimeout(timer)
    init.signal?.removeEventListener('abort', onAbort)
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await rawFetch(path, init, 'application/json')
  const payload = response.status === 204 ? null : await readJson(response)
  const envelope = envelopeOf(payload)
  if (!response.ok || envelope?.success === false) throw failureOf(response.status, envelope)
  return payload as T
}

export async function apiFetchBlob(path: string, init: RequestInit = {}): Promise<Blob> {
  const response = await rawFetch(path, init, '*/*')
  if (!response.ok) throw failureOf(response.status, envelopeOf(await readJson(response)))
  return response.blob()
}
