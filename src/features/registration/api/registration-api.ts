import { api } from '@/lib/api-client'

export type GuestRegistrationInitRequest = {
  companyName: string
  companyCode?: string
  taxCode: string
  companyAddress?: string
  fullName: string
  email: string
  phoneNumber?: string
}

export type GuestRegistrationSessionResponse = {
  token: string
  status: 'PENDING_OTP' | 'OTP_VERIFIED' | 'POLICY_ACCEPTED' | 'PAYMENT_PENDING' | 'COMPLETED'
  companyName: string
  taxCode: string
  companyAddress?: string
  fullName: string
  email: string
  phoneNumber?: string
  maskedEmail?: string
  selectedPlanId?: number
  selectedPlanName?: string
  amountVnd?: number
  otpExpiresAt?: string
  otpResendAllowedAt?: string
}

export type VerifyOtpRequest = {
  token: string
  otp: string
}

export type ResendOtpResponse = {
  message: string
  otpExpiresAt: string
  otpResendAllowedAt: string
}

export type AcceptPolicyRequest = {
  token: string
  accepted: boolean
}

export type InitPaymentRequest = {
  token: string
  planId: number
  billingCycleMonths?: number
}

export type PaymentLinkResponse = {
  paymentUrl: string
  orderCode: string
  amount: number
}

export async function initRegistration(data: GuestRegistrationInitRequest): Promise<GuestRegistrationSessionResponse> {
  return api().post<GuestRegistrationSessionResponse>('/api/guest-registration/init', { body: data })
}

export async function verifyRegistrationOtp(data: VerifyOtpRequest): Promise<GuestRegistrationSessionResponse> {
  return api().post<GuestRegistrationSessionResponse>('/api/guest-registration/verify-otp', { body: data })
}

export async function resendRegistrationOtp(token: string): Promise<ResendOtpResponse> {
  return api().post<ResendOtpResponse>(`/api/guest-registration/resend-otp?token=${encodeURIComponent(token)}`)
}

export async function acceptRegistrationPolicy(data: AcceptPolicyRequest): Promise<GuestRegistrationSessionResponse> {
  return api().post<GuestRegistrationSessionResponse>('/api/guest-registration/accept-policy', { body: data })
}

export async function initRegistrationPayment(data: InitPaymentRequest): Promise<PaymentLinkResponse> {
  return api().post<PaymentLinkResponse>('/api/guest-registration/init-payment', { body: data })
}

