import { keycloak } from '@/features/auth/keycloak'
import { backendConfig } from './backend-config'

/**
 * Cùng một nguồn token Keycloak cho apiFetch, apiFetchBlob và api().
 * apiFetch trả response JSON nguyên gốc (tương thích auth-api.ts của bạn).
 * api() mở envelope { success, data, code, errors } (tương thích feature API mới).
 */
const DEFAULT_TIMEOUT_MS = 15_000
const FALLBACK_API_URL = 'http://localhost:8080'
const API_BASE_URL = (backendConfig.apiUrl || FALLBACK_API_URL).replace(/\/$/, '')

export const TRANSPORT_ERROR_CODES = [
  'NETWORK_ERROR', 'TIMEOUT', 'UNAUTHENTICATED', 'UNAUTHORIZED', 'SERVER_ERROR',
] as const
export type TransportErrorCode = (typeof TRANSPORT_ERROR_CODES)[number]

type ErrorResponse = {
  success?: boolean
  message?: string
  code?: string
  errors?: Record<string, unknown>
}

/** Hỗ trợ cả constructor cũ (status, message, body) và mới (code, options). */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly body?: unknown
  readonly params: Readonly<Record<string, unknown>>

  constructor(status: number, message: string, body?: unknown)
  constructor(code: string, options?: { status?: number; params?: Readonly<Record<string, unknown>>; body?: unknown })
  constructor(
    codeOrStatus: string | number,
    messageOrOptions: string | { status?: number; params?: Readonly<Record<string, unknown>>; body?: unknown } = {},
    body?: unknown,
  ) {
    const legacy = typeof codeOrStatus === 'number'
    const options = !legacy && typeof messageOrOptions !== 'string' ? messageOrOptions : {}
    const status = typeof codeOrStatus === 'number' ? codeOrStatus : (options.status ?? 0)
    const resolvedBody = legacy ? body : options.body
    const responseBody = isRecord(resolvedBody) ? resolvedBody : null
    const code: string = typeof codeOrStatus === 'number'
      ? (typeof responseBody?.code === 'string' ? responseBody.code : codeOfStatus(status))
      : codeOrStatus
    const message = legacy ? String(messageOrOptions) : code
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.body = resolvedBody
    this.params = legacy
      ? (isRecord(responseBody?.errors) ? responseBody.errors : {})
      : (options.params ?? {})
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function codeOfStatus(status: number): TransportErrorCode {
  if (status === 401) return 'UNAUTHENTICATED'
  if (status === 403) return 'UNAUTHORIZED'
  return 'SERVER_ERROR'
}


async function getValidAccessToken(): Promise<string> {
  if (!keycloak.authenticated) {
    throw new ApiError('UNAUTHENTICATED', {
      status: 401,
    })
  }

  try {
    await keycloak.updateToken(30)
  } catch (error) {
    console.error(
      '[KEYCLOAK] Refresh token failed',
      error,
    )

    throw new ApiError('UNAUTHENTICATED', {
      status: 401,
    })
  }

  if (!keycloak.token) {
    throw new ApiError('UNAUTHENTICATED', {
      status: 401,
    })
  }

  return keycloak.token
}


async function redirectOnUnauthorized(): Promise<never> {
  try {
    await keycloak.login({ redirectUri: `${window.location.origin}/dang-nhap` })
  } catch {
    // Giữ một kiểu lỗi nhất quán cho caller.
  }
  throw new ApiError('UNAUTHENTICATED', { status: 401 })
}

function urlOf(path: string, query?: Readonly<Record<string, QueryValue>>): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const url = new URL(`${API_BASE_URL}${normalizedPath}`)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value))
  }
  return url.toString()
}

async function fetchAuthorized(path: string, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const token = await getValidAccessToken()
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)
  headers.set('Accept', headers.get('Accept') ?? 'application/json')
  if (init.body != null && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const onAbort = () => controller.abort()
  init.signal?.addEventListener('abort', onAbort, { once: true })
  let response: Response
  try {
    response = await fetch(urlOf(path), { ...init, headers, signal: controller.signal })
  } catch (error) {
    if (init.signal?.aborted) throw error
    throw new ApiError(controller.signal.aborted ? 'TIMEOUT' : 'NETWORK_ERROR')
  } finally {
    clearTimeout(timer)
    init.signal?.removeEventListener('abort', onAbort)
  }
  if (response.status === 401) {
    throw new ApiError('UNAUTHENTICATED', {
      status: 401,
    })
  }
  return response
}

async function readResponse(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined
  const text = await response.text()
  if (!text.trim()) return undefined
  try { return JSON.parse(text) as unknown } catch { return undefined }
}

function errorFromResponse(response: Response, payload: unknown): ApiError {
  const body = isRecord(payload) ? payload : null
  const code = typeof body?.code === 'string' && body.code !== '' ? body.code : codeOfStatus(response.status)
  const message = typeof body?.message === 'string' ? body.message : `API request failed: ${response.status}`
  return new ApiError(response.status, message, { ...body, code })
}

/** Giữ nguyên response JSON dạng {success, data} để getCurrentUser() đang dùng body.data. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetchAuthorized(path, init)
  const payload = await readResponse(response)
  if (!response.ok || (isRecord(payload) && payload.success === false)) {
    throw errorFromResponse(response, payload)
  }
  return payload as T
}

/** Tải file với Bearer token Keycloak. */
export async function apiFetchBlob(path: string, init: RequestInit = {}): Promise<Blob> {
  const response = await fetchAuthorized(path, init)
  if (!response.ok) {
    throw errorFromResponse(response, await readResponse(response))
  }
  return response.blob()
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

/** api() trả về phần data của envelope backend, giống feature API ở nhánh bạn của bạn. */
async function requestData<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const { query, body } = options
  const search = new URLSearchParams()
  for (const [name, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) search.set(name, String(value))
  }
  const suffix = search.toString()
  const fullPath = `${path}${suffix ? `${path.includes('?') ? '&' : '?'}${suffix}` : ''}`
  const response = await fetchAuthorized(fullPath, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const payload = await readResponse(response)
  if (!response.ok || (isRecord(payload) && payload.success === false)) {
    throw errorFromResponse(response, payload)
  }
  return (isRecord(payload) && 'success' in payload ? payload.data : payload) as T
}

const client: ApiClient = {
  get: (path, options) => requestData('GET', path, options),
  post: (path, options) => requestData('POST', path, options),
  put: (path, options) => requestData('PUT', path, options),
  patch: (path, options) => requestData('PATCH', path, options),
  delete: (path, options) => requestData('DELETE', path, options),
}

/** Giữ tên hàm để code mới có thể import; token thật vẫn lấy trực tiếp từ Keycloak. */
export function connectApiAuth(_accessToken: () => Promise<string | null>): void {
  // Keycloak là nguồn token duy nhất trong phiên bản này.
}

export function api(): ApiClient {
  return client
}
