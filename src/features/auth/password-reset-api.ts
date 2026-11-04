/**
 * Hàm → endpoint backend (FE-0-09). Ba endpoint công khai, không cần token; chỉ dùng khi đăng nhập bằng máy chủ
 * (`VITE_AUTH_SOURCE=keycloak`) — kho mẫu không gửi được mã qua email.
 *   requestResetCode → POST /api/auth/password-reset/request
 *   verifyResetCode  → POST /api/auth/password-reset/verify
 *   resetPassword    → POST /api/auth/password-reset/reset
 */

import { api } from '@/lib/api-client'

/** Gửi mã 6 chữ số về email. Máy chủ trả cùng một câu dù email có trong hệ thống hay không. */
// POST /api/auth/password-reset/request
export async function requestResetCode(email: string): Promise<void> {
  await api().post('/api/auth/password-reset/request', { body: { email: email.trim() } })
}

/** Đổi mã đúng lấy một vé đặt mật khẩu dùng một lần (sống 5 phút). */
// POST /api/auth/password-reset/verify
export async function verifyResetCode(email: string, otp: string): Promise<string> {
  const data = await api().post<{ resetToken: string }>('/api/auth/password-reset/verify', { body: { email: email.trim(), otp: otp.trim() } })
  return data.resetToken
}

// POST /api/auth/password-reset/reset
export async function resetPassword(resetToken: string, newPassword: string): Promise<void> {
  await api().post('/api/auth/password-reset/reset', { body: { resetToken, newPassword } })
}
