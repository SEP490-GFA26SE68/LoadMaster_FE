import { usesBackend } from '@/lib/backend-config'

/**
 * Hai luồng đăng ký công khai — dùng thử `/dang-ky-trai-nghiem`, tự đăng ký trả phí `/dang-ky` và trang `/dang-ky-thanh-cong` — chỉ chạy
 * khi nhóm `registration` nối backend. Kho mẫu không gửi được mã OTP qua email, không nhận thanh toán và không tạo được tài khoản, nên
 * (D-20) lối vào ở đầu trang và thẻ gói ẩn đi, còn ba route chuyển về trang giới thiệu.
 */
export const REGISTRATION_CAPABILITIES = {
  publicSignUp: usesBackend('registration'),
} as const
