import { useMutation } from '@tanstack/react-query'
import {
  initGuestTrial,
  resendGuestTrialOtp,
  verifyGuestTrialOtp,
  type GuestTrialInitRequest,
  type GuestTrialResendOtpRequest,
  type GuestTrialVerifyOtpRequest,
} from './trial-registration-api'

/** Các bước của trang đăng ký trải nghiệm `/dang-ky-trai-nghiem`: gửi thông tin, xác thực OTP, gửi lại OTP — mỗi bước một mutation. */
export function useInitGuestTrialMutation() {
  return useMutation({ mutationFn: (data: GuestTrialInitRequest) => initGuestTrial(data) })
}

export function useVerifyGuestTrialOtpMutation() {
  return useMutation({ mutationFn: (data: GuestTrialVerifyOtpRequest) => verifyGuestTrialOtp(data) })
}

export function useResendGuestTrialOtpMutation() {
  return useMutation({ mutationFn: (data: GuestTrialResendOtpRequest) => resendGuestTrialOtp(data) })
}
