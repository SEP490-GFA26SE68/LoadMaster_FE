import { keycloak } from './keycloak'
import {
  ROLE_FROM_BACKEND,
  type User,
} from '@/types/user'

import { apiFetch } from '@/lib/api-client'

let initPromise: Promise<boolean> | null = null


export function initAuth(): Promise<boolean> {
  if (!initPromise) {
    initPromise = keycloak.init({
      onLoad: 'check-sso',
      pkceMethod: 'S256',

      checkLoginIframe: true,
      checkLoginIframeInterval: 5,
    })
  }

  return initPromise
}

export async function login(redirectUri?: string): Promise<void> {
  await keycloak.login({
    redirectUri: redirectUri ?? `${window.location.origin}/`,
  })
}

export async function logout(): Promise<void> {
  await keycloak.logout({
    redirectUri: `${window.location.origin}/dang-nhap`,
  })
}


export function getAccessToken(): string | undefined {
  return keycloak.token
}

export function isAuthenticated(): boolean {
  return Boolean(keycloak.authenticated)
}

type UserProfileApiResponse = {
  success: boolean
  data: {
    id: number
    keycloakId: string
    username: string
    email: string
    fullName: string
    phoneNumber: string | null
    companyId: number | null
    userRoleType:
      | 'SYSTEM_ADMIN'
      | 'SYSTEM_MANAGER'
      | 'SYSTEM_SUPPORTER'
      | 'ADMIN'
      | 'MANAGER'
      | 'DISPATCHER'
      | 'WAREHOUSE_WORKER'
      | 'DRIVER'
    status: 'ACTIVE' | 'LOCKED'
  }
}

export async function getCurrentUser(): Promise<User> {
  const body =
    await apiFetch<UserProfileApiResponse>(
      '/api/users/me',
    )

  return mapUser(body.data)
}

type VerifyOtpResponse = {
  resetToken: string
}

export async function verifyPasswordResetOtp(
  email: string,
  otp: string,
): Promise<string> {
  const response = await fetch(
    'http://localhost:8080/api/auth/password-reset/verify',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        otp,
      }),
    },
  )

  const body = (await response.json()) as ApiResponse<VerifyOtpResponse>

  if (!response.ok) {
    throw new Error(
      body.message ?? 'OTP không hợp lệ',
    )
  }

  if (!body.data?.resetToken) {
    throw new Error('Không nhận được reset token')
  }

  return body.data.resetToken
}

type ApiResponse<T = unknown> = {
  success: boolean
  message?: string
  data?: T
}

export async function requestPasswordReset(email: string): Promise<void> {
  const response = await fetch(
    'http://localhost:8080/api/auth/password-reset/request',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    },
  )

  const body = (await response.json()) as ApiResponse

  if (!response.ok) {
    throw new Error(
      body.message ?? 'Failed to request password reset',
    )
  }
}

export async function resetPassword(
  resetToken: string,
  newPassword: string,
): Promise<void> {
  const response = await fetch(
    'http://localhost:8080/api/auth/password-reset/reset',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        resetToken,
        newPassword,
      }),
    },
  )

  const body = await response.json()

  if (!response.ok) {
    throw new Error(
      body.message ?? 'Không thể đặt lại mật khẩu',
    )
  }
}

function mapUser(
  data: UserProfileApiResponse['data'],
): User {
  return {
    id: String(data.id),
    fullName: data.fullName,
    email: data.email,
    phone: data.phoneNumber ?? '',
    role: ROLE_FROM_BACKEND[data.userRoleType],
    status:
      data.status === 'ACTIVE'
        ? 'active'
        : 'suspended',
    companyId:
      data.companyId != null
        ? String(data.companyId)
        : undefined,
    depot: undefined,
    lastActiveAt: null,
  }
}


