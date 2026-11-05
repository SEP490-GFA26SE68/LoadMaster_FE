/**
 * Thanh toán giả lập (FE-8-04): thay cổng thanh toán thật khi chưa có backend.
 *   fetchCheckout → chưa có ở BE (BE: URL thanh toán do `subscribe` / `topUpCredits` trả về)
 *   settlePayment → chưa có ở BE (BE: cổng gọi lại webhook; hiện `GET /api/payment/mock-checkout`)
 * Có backend thì app chuyển thẳng sang URL thanh toán backend trả và không dùng trang thanh toán giả lập.
 */

import { getMockDb, type PaymentTransaction } from '@/lib/mock-db'

/** Giao dịch kèm tên gói mà nó nói tới (đăng ký, gia hạn) — trang thanh toán ghi "Đăng ký gói Pro", không chỉ mã gói. */
export type Checkout = { readonly payment: PaymentTransaction; readonly planName: string | null }

/** Giao dịch của công ty; mã không có, hoặc của công ty khác, là `NOT_FOUND`. */
// chưa có ở BE
export async function fetchCheckout(paymentId: string): Promise<Checkout> {
  const db = getMockDb()
  const payment = await db.getPayment(paymentId)
  const planName = payment.planId === undefined ? null : ((await db.listSubscriptionPlans()).find((plan) => plan.id === payment.planId)?.name ?? null)
  return { payment, planName }
}

/**
 * Xử lý giao dịch **đúng một lần**: kho trả nguyên trạng thái cuối nếu giao dịch đã xử lý, nên bấm lại, quay lại hay mở lại trang không
 * cộng lần hai. `SUCCESS` kích hoạt gói hoặc cộng credit; `FAILED` giữ nguyên số dư.
 */
// chưa có ở BE
export function settlePayment(paymentId: string, outcome: 'SUCCESS' | 'FAILED'): Promise<PaymentTransaction> {
  return getMockDb().settlePayment(paymentId, outcome)
}
