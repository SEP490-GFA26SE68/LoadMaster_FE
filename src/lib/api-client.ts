import { keycloak } from '@/features/auth/keycloak'

const API_BASE_URL = 'http://localhost:8080'

async function getValidAccessToken(): Promise<string> {
  if (!keycloak.authenticated) {
    throw new Error('User is not authenticated')
  }

  try {
    await keycloak.updateToken(30)
  } catch {
    await keycloak.login({
      redirectUri: window.location.href,
    })

    throw new Error('Authentication session expired')
  }

  if (!keycloak.token) {
    throw new Error('Access token is unavailable')
  }

  return keycloak.token
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getValidAccessToken()

  const headers = new Headers(init.headers)

  headers.set('Authorization', `Bearer ${token}`)

  if (
    init.body &&
    !(init.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  })

  if (response.status === 401) {
    await keycloak.login({
      redirectUri: window.location.href,
    })

    throw new Error('Authentication session expired')
  }

  return response
}