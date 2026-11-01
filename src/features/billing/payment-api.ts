import { isAuthenticated } from '@/features/auth/auth-api'
import { apiFetch } from '@/lib/api-client'
import { getMockDb, MockDbError, type PaymentTransaction } from '@/lib/mock-db'
import { findStoredPayment, upsertStoredPayment } from './billing-api'

/** Giao dịch kèm tên gói mà nó nói tới (đăng ký, gia hạn) — trang thanh toán ghi "Đăng ký gói Pro", không chỉ mã gói. */
export type Checkout = {
  readonly payment: PaymentTransaction
  readonly planName: string | null
  readonly paymentUrl?: string | null
}

/** Giao dịch của công ty; mã không có, hoặc của công ty khác, là `NOT_FOUND`. */
export async function fetchCheckout(paymentId: string): Promise<Checkout> {
  if (!isAuthenticated()) {
    const db = getMockDb()
    const payment = await db.getPayment(paymentId)
    const planName =
      payment.planId === undefined
        ? null
        : ((await db.listSubscriptionPlans()).find((plan) => plan.id === payment.planId)?.name ?? null)
    return { payment, planName }
  }

  const stored = findStoredPayment(paymentId)
  if (!stored) {
    throw new MockDbError('NOT_FOUND', { collection: 'payments', id: paymentId })
  }
  return {
    payment: stored.payment,
    planName: stored.planName,
    paymentUrl: stored.paymentUrl,
  }
}

/**
 * Xử lý giao dịch **đúng một lần**: kho trả nguyên trạng thái cuối nếu giao dịch đã xử lý, nên bấm lại, quay lại hay mở lại trang không
 * cộng lần hai. `SUCCESS` kích hoạt gói hoặc cộng credit; `FAILED` giữ nguyên số dư.
 */
export async function settlePayment(
  paymentId: string,
  outcome: 'SUCCESS' | 'FAILED',
): Promise<PaymentTransaction> {
  if (!isAuthenticated()) {
    return getMockDb().settlePayment(paymentId, outcome)
  }

  const stored = findStoredPayment(paymentId)
  if (!stored) {
    throw new MockDbError('NOT_FOUND', { collection: 'payments', id: paymentId })
  }
  if (stored.payment.status !== 'PENDING') {
    return stored.payment
  }

  if (outcome === 'SUCCESS') {
    await apiFetch(`/api/payment/mock-checkout?txnRef=${encodeURIComponent(paymentId)}`)
  } else {
    await apiFetch(
      `/webhook/vnpay?vnp_TxnRef=${encodeURIComponent(paymentId)}&vnp_ResponseCode=24&vnp_Mock=true`,
    )
  }

  const updated: PaymentTransaction = {
    ...stored.payment,
    status: outcome,
    updatedAt: new Date().toISOString(),
  }
  return upsertStoredPayment({
    ...stored,
    payment: updated,
  })
}
