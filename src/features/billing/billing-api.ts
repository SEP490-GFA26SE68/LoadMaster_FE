/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm.
 *   getCurrentSubscription  → GET /api/subscription/current
 *   subscribe               → POST /api/subscription/subscribe (trả URL thanh toán)
 *   cancelSubscription      → POST /api/subscription/cancel
 *   getCreditBalance        → GET /api/credits/balance
 *   listCreditTransactions  → GET /api/credits/transactions (BE phân trang; FE phân trang trên danh sách đã đọc)
 *   topUpCredits            → POST /api/credits/topup (trả URL thanh toán)
 *   listPlansOnSale         → GET /api/subscription/plans (lọc gói đang bán)
 *   chưa có ở BE: listPayments
 * Có backend thì `subscribe` và `topUpCredits` trả URL thanh toán và app chuyển thẳng sang đó (hiện `GET /api/payment/mock-checkout`);
 * trang thanh toán giả lập (`payment-api.ts`) không dùng nữa.
 */

import {
  getMockDb,
  type CompanySubscription,
  type CreditBalance,
  type CreditTransaction,
  type CurrentSubscription,
  type PaymentTransaction,
  type SubscriptionPlan,
} from '@/lib/mock-db'

/** Gói hiện tại của công ty và gói cước nó theo; `null` khi công ty chưa từng đăng ký. */
// GET /api/subscription/current
export function getCurrentSubscription(): Promise<CurrentSubscription | null> {
  return getMockDb().getCurrentSubscription()
}

/** Gói đang bán, theo thứ tự hạng — các gói công ty chọn khi chưa có gói hoặc gói đã hết hạn. */
// GET /api/subscription/plans
export async function listPlansOnSale(): Promise<SubscriptionPlan[]> {
  return (await getMockDb().listSubscriptionPlans()).filter((plan) => plan.active)
}

/**
 * Đăng ký một gói: chỉ khi chưa có gói hoặc gói đã hết hạn (`SUBSCRIPTION_ACTIVE`), gói đang bán (`PLAN_INACTIVE`). Trả thanh toán
 * `PENDING` — gói chỉ được kích hoạt khi thanh toán thành công.
 */
// POST /api/subscription/subscribe
export function subscribe(planId: string): Promise<PaymentTransaction> {
  return getMockDb().subscribeToPlan(planId)
}

/** Huỷ gói: còn hiệu lực tới hết kỳ, không tự gia hạn. Gói không còn đang dùng: `SUBSCRIPTION_STATUS_INVALID`. */
// POST /api/subscription/cancel
export function cancelSubscription(): Promise<CompanySubscription> {
  return getMockDb().cancelSubscription()
}

// GET /api/credits/balance
export function getCreditBalance(): Promise<CreditBalance> {
  return getMockDb().getCreditBalance()
}

/** Sổ cái credit của công ty, mới nhất trước. */
// GET /api/credits/transactions
export function listCreditTransactions(): Promise<CreditTransaction[]> {
  return getMockDb().listCreditTransactions()
}

/** Nạp 50 hoặc 500 credit (`TOPUP_INVALID`), 1.000 đ mỗi credit. Trả thanh toán `PENDING`; credit chỉ được cộng khi thanh toán thành công. */
// POST /api/credits/topup
export function topUpCredits(credits: number): Promise<PaymentTransaction> {
  return getMockDb().topUpCredits(credits)
}

/** Thanh toán của công ty, mới nhất trước. */
// chưa có ở BE
export function listPayments(): Promise<PaymentTransaction[]> {
  return getMockDb().listPayments()
}
