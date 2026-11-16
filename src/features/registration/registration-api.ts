/**
 * Tự đăng ký trả phí ở trang công khai `/dang-ky` (nhóm `registration`; chỉ khi nối backend — kho mẫu không gửi được OTP hay nhận thanh
 * toán, nên mọi hàm từ chối `NOT_SUPPORTED` mà không gọi mạng). Máy chủ trả thân trần, không phong bì.
 *
 * | Hàm                              | Endpoint                                          |
 * |----------------------------------|---------------------------------------------------|
 * | initRegistration                 | POST /api/guest-registration/init                 |
 * | verifyRegistrationOtp            | POST /api/guest-registration/verify-otp           |
 * | resendRegistrationOtp            | POST /api/guest-registration/resend-otp?token=    |
 * | acceptRegistrationPolicy         | POST /api/guest-registration/accept-policy        |
 * | initRegistrationPayment          | POST /api/guest-registration/init-payment         |
 * | executeMockRegistrationCheckout  | GET /api/payment/mock-checkout?txnRef=            |
 */
import { api, ApiError } from '@/lib/api-client'
import { usesBackend } from '@/lib/backend-config'

const ON_BACKEND = usesBackend('registration')

const unsupported = (): Promise<never> => Promise.reject(new ApiError('NOT_SUPPORTED'))

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

// POST /api/guest-registration/init
export async function initRegistration(data: GuestRegistrationInitRequest): Promise<GuestRegistrationSessionResponse> {
  if (!ON_BACKEND) return unsupported()
  return api().post<GuestRegistrationSessionResponse>('/api/guest-registration/init', { body: data })
}

// POST /api/guest-registration/verify-otp
export async function verifyRegistrationOtp(data: VerifyOtpRequest): Promise<GuestRegistrationSessionResponse> {
  if (!ON_BACKEND) return unsupported()
  return api().post<GuestRegistrationSessionResponse>('/api/guest-registration/verify-otp', { body: data })
}

// POST /api/guest-registration/resend-otp?token=
export async function resendRegistrationOtp(token: string): Promise<ResendOtpResponse> {
  if (!ON_BACKEND) return unsupported()
  return api().post<ResendOtpResponse>('/api/guest-registration/resend-otp', { query: { token } })
}

// POST /api/guest-registration/accept-policy
export async function acceptRegistrationPolicy(data: AcceptPolicyRequest): Promise<GuestRegistrationSessionResponse> {
  if (!ON_BACKEND) return unsupported()
  return api().post<GuestRegistrationSessionResponse>('/api/guest-registration/accept-policy', { body: data })
}

// POST /api/guest-registration/init-payment
export async function initRegistrationPayment(data: InitPaymentRequest): Promise<PaymentLinkResponse> {
  if (!ON_BACKEND) return unsupported()
  return api().post<PaymentLinkResponse>('/api/guest-registration/init-payment', { body: data })
}

// GET /api/payment/mock-checkout?txnRef=
export async function executeMockRegistrationCheckout(txnRef: string): Promise<MockCheckoutResponse | null> {
  if (!ON_BACKEND) return unsupported()
  return (await api().getRaw('/api/payment/mock-checkout', { query: { txnRef } })) as MockCheckoutResponse | null
}
