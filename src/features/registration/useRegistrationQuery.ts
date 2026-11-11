import { useMutation } from '@tanstack/react-query'
import {
  acceptRegistrationPolicy,
  executeMockRegistrationCheckout,
  initRegistration,
  initRegistrationPayment,
  resendRegistrationOtp,
  verifyRegistrationOtp,
  type AcceptPolicyRequest,
  type GuestRegistrationInitRequest,
  type InitPaymentRequest,
  type VerifyOtpRequest,
} from './registration-api'

export { REGISTRATION_CAPABILITIES } from './registration-capabilities'

/**
 * Các bước của trang tự đăng ký `/dang-ky`. Phiên đăng ký nằm ở máy chủ theo `token` và chỉ trang này dùng, nên không có truy vấn nào
 * để làm mới — mỗi bước là một mutation.
 */
export function useInitRegistrationMutation() {
  return useMutation({ mutationFn: (data: GuestRegistrationInitRequest) => initRegistration(data) })
}

export function useVerifyRegistrationOtpMutation() {
  return useMutation({ mutationFn: (data: VerifyOtpRequest) => verifyRegistrationOtp(data) })
}

export function useResendRegistrationOtpMutation() {
  return useMutation({ mutationFn: (token: string) => resendRegistrationOtp(token) })
}

export function useAcceptRegistrationPolicyMutation() {
  return useMutation({ mutationFn: (data: AcceptPolicyRequest) => acceptRegistrationPolicy(data) })
}

export function useInitRegistrationPaymentMutation() {
  return useMutation({ mutationFn: (data: InitPaymentRequest) => initRegistrationPayment(data) })
}

export function useMockRegistrationCheckoutMutation() {
  return useMutation({ mutationFn: (txnRef: string) => executeMockRegistrationCheckout(txnRef) })
}
