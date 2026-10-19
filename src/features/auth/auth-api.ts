
import { keycloak } from './keycloak'
import {
  ROLE_FROM_BACKEND,
  type User,
} from '@/types/user'
import { apiFetch } from '@/lib/api-client'


// Khởi tạo Keycloak
let initPromise: Promise<boolean> | null = null

export function initAuth(): Promise<boolean> {
  if (import.meta.env.MODE === 'test') {
    const raw = sessionStorage.getItem('loadmaster.phien')
    return Promise.resolve(Boolean(raw))
  }
  if (!initPromise) {
    initPromise = keycloak.init({
      onLoad: 'check-sso',
      pkceMethod: 'S256',
      checkLoginIframe: false,
      silentCheckSsoRedirectUri:
        `${window.location.origin}/silent-check-sso.html`,
      silentCheckSsoFallback: false,
    })
  }

  return initPromise
}


// Đăng nhập qua Keycloak
export async function login(): Promise<void> {
  await keycloak.login({
    redirectUri:
      `${window.location.origin}/dang-nhap`,
  })
}

// Đăng xuất qua Keycloak
export async function logout(): Promise<void> {
  await keycloak.logout({
    redirectUri:
      `${window.location.origin}/dang-nhap`,
  })
}

// Lấy access token
export function getAccessToken(): string | undefined {
  return keycloak.token
}

// Kiểm tra xác thực
export function isAuthenticated(): boolean {
  if (import.meta.env.MODE === 'test') {
    return Boolean(sessionStorage.getItem('loadmaster.phien'))
  }
  return Boolean(keycloak.authenticated)
}

// Response từ backend
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

// Lấy thông tin người dùng từ backend thật
export async function getCurrentUser(): Promise<User> {
  if (import.meta.env.MODE === 'test') {
    const raw = sessionStorage.getItem('loadmaster.phien')
    if (raw) return JSON.parse(raw) as User
  }
  const body =
    await apiFetch<UserProfileApiResponse>(
      '/api/users/me',
    )

  return mapUser(body.data)
}

type ApiResponse<T = unknown> = {
  success: boolean
  message?: string
  data?: T
}

type VerifyOtpResponse = {
  resetToken: string
}

// Xác thực mã OTP
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
      body: JSON.stringify({ email, otp }),
    },
  )

  const body =
    (await response.json()) as ApiResponse<VerifyOtpResponse>

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

// Yêu cầu đặt lại mật khẩu
export async function requestPasswordReset(
  email: string,
): Promise<void> {
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
      body.message ??
        'Failed to request password reset',
    )
  }
}

// Đặt lại mật khẩu
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

  const body =
    (await response.json()) as ApiResponse

  if (!response.ok) {
    throw new Error(
      body.message ?? 'Không thể đặt lại mật khẩu',
    )
  }
}

// Chuyển đổi user backend sang frontend
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
