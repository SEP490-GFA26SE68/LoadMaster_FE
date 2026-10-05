import { keycloak } from '@/features/auth/keycloak'

const API_BASE_URL = 'http://localhost:8080'

type ErrorResponse = {
  success?: boolean
  message?: string
  code?: string
}

export class ApiError extends Error {
  readonly status: number
  readonly body?: unknown

  constructor(
    status: number,
    message: string,
    body?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

async function getValidAccessToken(): Promise<string> {
  if (!keycloak.authenticated) {
    throw new ApiError(
      401,
      'User is not authenticated',
    )
  }

  try {
    await keycloak.updateToken(30)
  } catch {
    await keycloak.login({
      redirectUri: window.location.href,
    })

    throw new ApiError(
      401,
      'Authentication session expired',
    )
  }

  if (!keycloak.token) {
    throw new ApiError(
      401,
      'Access token is unavailable',
    )
  }

  return keycloak.token
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getValidAccessToken()

  const headers = new Headers(init.headers)

  headers.set(
    'Authorization',
    `Bearer ${token}`,
  )

  if (
    init.body &&
    !(init.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set(
      'Content-Type',
      'application/json',
    )
  }

  const response = await fetch(
    `${API_BASE_URL}${path}`,
    {
      ...init,
      headers,
    },
  )

  if (response.status === 401) {
    await keycloak.login({
      redirectUri: window.location.href,
    })

    throw new ApiError(
      401,
      'Authentication session expired',
    )
  }

  if (!response.ok) {
    let body: ErrorResponse | undefined

    try {
      body =
        (await response.json()) as ErrorResponse
    } catch {
      body = undefined
    }

    throw new ApiError(
      response.status,
      body?.message ??
        `API request failed: ${response.status}`,
      body,
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}