import type { ServerPaymentPurpose } from './server-payment-api'

/** Đường dẫn trang thanh toán giả lập của một giao dịch (`?giao-dich=<mã>`, mã là mã thanh toán `PAY-NNN`). Một chỗ cho mọi nơi mở trang đó. */
export const PAYMENT_PATH = '/thanh-toan/gia-lap'
export const PAYMENT_PARAM = 'giao-dich'

export const paymentPath = (paymentId: string) => `${PAYMENT_PATH}?${PAYMENT_PARAM}=${encodeURIComponent(paymentId)}`

/**
 * Trang xác nhận thanh toán qua cổng thử của backend: `?ma=<mã giao dịch MOCK_…>&loai=goi|credit`. `loai` chỉ chọn thứ cần đọc lại
 * (gói hay sổ cái credit); kết quả cuối vẫn là thứ backend trả.
 */
export const PAYMENT_RESULT_PATH = '/thanh-toan/ket-qua'
export const PAYMENT_REFERENCE_PARAM = 'ma'
export const PAYMENT_KIND_PARAM = 'loai'

const KIND_SLUGS: Readonly<Record<ServerPaymentPurpose, string>> = { SUBSCRIBE: 'goi', TOPUP: 'credit' }

export const paymentResultPath = (reference: string, purpose: ServerPaymentPurpose) =>
  `${PAYMENT_RESULT_PATH}?${PAYMENT_REFERENCE_PARAM}=${encodeURIComponent(reference)}&${PAYMENT_KIND_PARAM}=${KIND_SLUGS[purpose]}`

/** Slug `loai` trên URL → việc của thanh toán; slug lạ là `null`. */
export function paymentPurposeOf(slug: string | null): ServerPaymentPurpose | null {
  if (slug === KIND_SLUGS.SUBSCRIBE) return 'SUBSCRIBE'
  return slug === KIND_SLUGS.TOPUP ? 'TOPUP' : null
}
