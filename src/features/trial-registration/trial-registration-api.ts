import { api } from '@/lib/api-client'

export type GuestTrialInitRequest = {
  companyName: string
  taxCode: string
  companyAddress?: string
  fullName: string
  email: string
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

export async function initGuestTrial(data: GuestTrialInitRequest): Promise<GuestTrialInitResponse> {
  return api().post<GuestTrialInitResponse>('/api/trial-registration/init', { body: data })
}

export async function verifyGuestTrialOtp(data: GuestTrialVerifyOtpRequest): Promise<GuestTrialVerifyResponse> {
  return api().post<GuestTrialVerifyResponse>('/api/trial-registration/verify-otp', { body: data })
}

export async function resendGuestTrialOtp(data: GuestTrialResendOtpRequest): Promise<GuestTrialInitResponse> {
  return api().post<GuestTrialInitResponse>('/api/trial-registration/resend-otp', { body: data })
}

