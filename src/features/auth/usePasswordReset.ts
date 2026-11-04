import { useMutation } from '@tanstack/react-query'
import { isApiError } from '@/lib/api-client'
import type { MessageKey } from '@/lib/i18n'
import { requestResetCode, resetPassword, verifyResetCode } from './password-reset-api'

/** Ba bước đặt mật khẩu mới. Không ghi dữ liệu nào màn khác đọc nên không vô hiệu truy vấn nào. */
export const useRequestResetCode = () => useMutation({ mutationFn: (email: string) => requestResetCode(email) })

export const useVerifyResetCode = () =>
  useMutation({ mutationFn: ({ email, otp }: { email: string; otp: string }) => verifyResetCode(email, otp) })

export const useResetPassword = () =>
  useMutation({ mutationFn: ({ resetToken, password }: { resetToken: string; password: string }) => resetPassword(resetToken, password) })

export type ResetStep = 'request' | 'verify' | 'reset'

/** Mã máy chủ trả cho từng lý do từ chối (vẫn HTTP 400). Vé hết hạn dùng chung câu với `onExpired` của bước đặt mật khẩu. */
const RESET_REASONS: Readonly<Record<string, MessageKey>> = {
  OTP_RESEND_COOLDOWN: 'auth.reset.errors.cooldown',
  OTP_REQUEST_LIMIT_EXCEEDED: 'auth.reset.errors.requestLimit',
  OTP_EXPIRED: 'auth.reset.errors.codeExpired',
  OTP_INCORRECT: 'auth.reset.errors.codeIncorrect',
  OTP_ATTEMPTS_EXCEEDED: 'auth.reset.errors.attemptsExceeded',
  RESET_TOKEN_INVALID: 'auth.reset.errors.expired',
}

/**
 * Câu cho lần từ chối của một bước. Máy chủ có mã thì nói đúng lý do của mã. Máy chủ cũ từ chối mọi lý do của một bước bằng cùng một
 * 400 không mã (chỉ có câu tiếng Việt), nên khi đó màn nói lý do theo bước, không hiện câu thô của máy chủ: gửi mã — vừa gửi hoặc gửi
 * quá nhiều lần; nhập mã — mã sai, hết hạn hoặc nhập sai quá nhiều lần; đặt mật khẩu — vé đặt mật khẩu đã hết hạn. Lỗi khác (mạng,
 * máy chủ) là câu chung.
 */
export function resetErrorKey(step: ResetStep, error: unknown): MessageKey {
  const reason = isApiError(error) ? RESET_REASONS[error.code] : undefined
  if (reason !== undefined) return reason
  if (isApiError(error) && error.code === 'BAD_REQUEST') {
    if (step === 'request') return 'auth.reset.errors.tooManyRequests'
    if (step === 'verify') return 'auth.reset.errors.codeInvalid'
    return 'auth.reset.errors.expired'
  }
  return 'auth.reset.errors.failed'
}
