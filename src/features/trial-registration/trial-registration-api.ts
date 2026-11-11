/**
 * Đăng ký trải nghiệm ở trang công khai `/dang-ky-trai-nghiem` (nhóm `registration`; chỉ khi nối backend — kho mẫu không gửi được OTP,
 * nên mọi hàm từ chối `NOT_SUPPORTED` mà không gọi mạng). Máy chủ trả thân trần, không phong bì.
 *
 * | Hàm                  | Endpoint                                  |
 * |----------------------|-------------------------------------------|
 * | initGuestTrial       | POST /api/trial-registration/init         |
 * | verifyGuestTrialOtp  | POST /api/trial-registration/verify-otp   |
 * | resendGuestTrialOtp  | POST /api/trial-registration/resend-otp   |
 */
import { api, ApiError } from '@/lib/api-client'
import { usesBackend } from '@/lib/backend-config'

const ON_BACKEND = usesBackend('registration')

const unsupported = (): Promise<never> => Promise.reject(new ApiError('NOT_SUPPORTED'))

export type GuestTrialInitRequest = {
  companyName: string
  taxCode: string
  companyAddress?: string
  fullName: string
  email: string
  phoneCountry?: string
  phoneNumber?: string
  interestedPlanId?: number
  note?: string
}

export type GuestTrialInitResponse = {
  token: string
  email: string
  maskedEmail: string
  otpExpiresAt: string
  otpResendAllowedAt: string
  message: string
}

export type GuestTrialVerifyOtpRequest = {
  token: string
  otp: string
}

export type GuestTrialVerifyResponse = {
  requestId: number
  status: 'PENDING' | 'PENDING_ADMIN_CREATION' | 'APPROVED' | 'REJECTED'
  aiPrecheckStatus?: 'PASSED' | 'FAILED' | null
  aiPrecheckReason?: string | null
  message: string
}

export type GuestTrialResendOtpRequest = {
  token: string
}

// POST /api/trial-registration/init
export async function initGuestTrial(data: GuestTrialInitRequest): Promise<GuestTrialInitResponse> {
  if (!ON_BACKEND) return unsupported()
  return api().post<GuestTrialInitResponse>('/api/trial-registration/init', { body: data })
}

// POST /api/trial-registration/verify-otp
export async function verifyGuestTrialOtp(data: GuestTrialVerifyOtpRequest): Promise<GuestTrialVerifyResponse> {
  if (!ON_BACKEND) return unsupported()
  return api().post<GuestTrialVerifyResponse>('/api/trial-registration/verify-otp', { body: data })
}

// POST /api/trial-registration/resend-otp
export async function resendGuestTrialOtp(data: GuestTrialResendOtpRequest): Promise<GuestTrialInitResponse> {
  if (!ON_BACKEND) return unsupported()
  return api().post<GuestTrialInitResponse>('/api/trial-registration/resend-otp', { body: data })
}

