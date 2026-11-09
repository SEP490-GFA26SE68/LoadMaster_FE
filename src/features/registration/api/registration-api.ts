import { api } from '@/lib/api-client'

export type BillingCycle = 'MONTHLY' | 'YEARLY'

export type GuestRegistrationInitRequest = {
  companyName: string
  companyCode: string
  taxCode: string
  companyAddress?: string
  fullName: string
  email: string
  phoneCountry?: string
  phoneNumber: string
}

export type GuestRegistrationSessionResponse = {
  token: string
  status:
    | 'PENDING_OTP'
    | 'PENDING_EMAIL_VERIFY'
    | 'OTP_VERIFIED'
    | 'EMAIL_VERIFIED'
    | 'POLICY_ACCEPTED'
    | 'PAYMENT_PENDING'
    | 'PAYMENT_FAILED'
    | 'COMPLETED'
    | 'EXPIRED'
  companyName: string
  companyCode?: string
  taxCode: string
  companyAddress?: string
  fullName: string
  email: string
  phoneNumber?: string
  maskedEmail?: string
  planId?: number
  planName?: string
  billingCycle?: BillingCycle
  selectedPlanId?: number
  selectedPlanName?: string
  amountVnd?: number
  otpExpiresAt?: string
  otpResendAllowedAt?: string
  expiresAt?: string
  paymentRef?: string
  message?: string
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
  accepted?: boolean
}

export type InitPaymentRequest = {
  token: string
  planId: number
  billingCycle: BillingCycle
}

export type PaymentLinkResponse = {
  paymentUrl: string
  paymentRef: string
  amountVnd: number
  expiresAt?: string
}

export type MockCheckoutResponse = {
  success?: boolean
  message?: string
  txnRef?: string
  callbackResult?: {
    RspCode?: string
    Message?: string
  } | null
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

export async function executeMockRegistrationCheckout(txnRef: string): Promise<MockCheckoutResponse | null> {
  return (await api().getRaw('/api/payment/mock-checkout', { query: { txnRef } })) as MockCheckoutResponse | null
}
