/**
 * Thanh toán qua backend (nhóm `billing`). Đăng ký gói và nạp credit trả URL thanh toán; app luôn gửi cổng `MOCK` — cổng thử của
 * backend: URL là `/api/payment/mock-checkout?txnRef=MOCK_…` (JSON, không phải trang), nên app mở trang xác nhận của mình
 * `/thanh-toan/ket-qua` thay cho trang của cổng. Kết quả cuối luôn đọc lại từ backend, không tin tham số trên URL.
 *   startServerPayment   → POST /api/subscription/subscribe · POST /api/credits/topup (nơi gọi chọn)
 *   confirmServerPayment → GET /api/payment/mock-checkout, rồi GET /api/subscription/current (đăng ký) hoặc GET /api/credits/transactions (nạp)
 */

import { api, ApiError, type TransportErrorCode } from '@/lib/api-client'
import { getCurrentSubscriptionDto, listCreditTransactionDtos, subscriptionStatusOf, withBusinessCode } from '@/lib/billing-backend-api'

/** Cổng thanh toán app gửi cho backend. Cổng mặc định của backend (VNPAY) ở chế độ thử không xác nhận được (sai chữ ký). */
export const PAYMENT_GATEWAY = 'MOCK'
export const MOCK_CHECKOUT_PATH = '/api/payment/mock-checkout'

export type ServerPaymentPurpose = 'SUBSCRIBE' | 'TOPUP'

/** Bước kế tiếp sau khi tạo thanh toán. */
export type PaymentStart =
  /** Kho mẫu: trang thanh toán giả lập của app. */
  | { readonly kind: 'simulation'; readonly paymentId: string }
  /** Cổng thử của backend: trang xác nhận của app. */
  | { readonly kind: 'confirm'; readonly reference: string; readonly purpose: ServerPaymentPurpose }
  /** Cổng thật: chuyển hẳn sang trang của cổng. */
  | { readonly kind: 'redirect'; readonly url: string }
  /** Gói miễn phí: backend kích hoạt ngay, không có thanh toán. */
  | { readonly kind: 'activated' }

/** `PaymentUrlResponse`: `id` là mã thanh toán của backend, `transactionId` là mã giao dịch gửi cổng (`MOCK_…`). */
type PaymentUrlDto = { readonly paymentUrl: string | null; readonly transactionId: string | null; readonly id: number | null; readonly status: string | null }

function referenceOf(url: string, transactionId: string | null): string {
  if (transactionId !== null && transactionId !== '') return transactionId
  return new URL(url, 'http://backend.local').searchParams.get('txnRef') ?? ''
}

export function paymentStartOf(dto: PaymentUrlDto | null, purpose: ServerPaymentPurpose): PaymentStart {
  const url = dto?.paymentUrl ?? ''
  if (url === '' && dto?.status === 'ACTIVE') return { kind: 'activated' }
  if (url.includes(MOCK_CHECKOUT_PATH)) {
    const reference = referenceOf(url, dto?.transactionId ?? null)
    if (reference !== '') return { kind: 'confirm', reference, purpose }
  } else if (/^https?:\/\//i.test(url)) {
    return { kind: 'redirect', url }
  }
  throw new ApiError('PAYMENT_FAILED')
}

/** Tạo thanh toán ở backend (`path` là endpoint đăng ký hoặc nạp) qua cổng `MOCK`; `codes` đổi mã HTTP sang mã nghiệp vụ của endpoint đó. */
// POST /api/subscription/subscribe · POST /api/credits/topup
export async function startServerPayment(
  path: string,
  body: Readonly<Record<string, unknown>>,
  purpose: ServerPaymentPurpose,
  codes: Partial<Record<TransportErrorCode, string>> = {},
): Promise<PaymentStart> {
  const dto = await withBusinessCode(api().post<PaymentUrlDto | null>(path, { body: { ...body, gateway: PAYMENT_GATEWAY } }), codes)
  return paymentStartOf(dto, purpose)
}

/** Kết quả đọc lại từ backend sau khi xác nhận. `gatewayCode` là mã cổng trả (`00` đã ghi nhận; `01` không có giao dịch). */
export type ServerPaymentResult =
  | { readonly status: 'SUCCESS'; readonly purpose: 'SUBSCRIBE'; readonly planName: string }
  | { readonly status: 'SUCCESS'; readonly purpose: 'TOPUP'; readonly credits: number }
  | { readonly status: 'NOT_CONFIRMED'; readonly purpose: ServerPaymentPurpose; readonly gatewayCode: string | null }

/** Thân `mock-checkout` trả: luôn `success: true`, kết quả thật nằm ở `callbackResult.RspCode`. */
type MockCheckoutDto = { readonly txnRef?: string; readonly callbackResult?: { readonly RspCode?: string; readonly Message?: string } | null }

/** Giao dịch nạp credit mới nhất nằm ở trang đầu (backend xếp mới nhất trước). */
const LEDGER_HEAD = { size: 50, maxPages: 1 } as const

/**
 * Xác nhận thanh toán ở cổng thử rồi đọc lại kết quả. Nạp credit: thành công khi sổ cái có lượt `PURCHASE` mang đúng mã giao dịch (backend
 * chỉ ghi lượt đó khi thanh toán thành công). Đăng ký: backend không gắn gói với giao dịch, nên thành công khi cổng báo đã ghi nhận (`00`)
 * **và** gói của công ty đang `ACTIVE`. Xác nhận lại một giao dịch đã thành công không cộng lần hai (backend bỏ qua).
 */
// GET /api/payment/mock-checkout rồi GET /api/subscription/current hoặc GET /api/credits/transactions
export async function confirmServerPayment(reference: string, purpose: ServerPaymentPurpose): Promise<ServerPaymentResult> {
  const checkout = (await api().getRaw(MOCK_CHECKOUT_PATH, { query: { txnRef: reference } })) as MockCheckoutDto | null
  const gatewayCode = checkout?.callbackResult?.RspCode ?? null
  if (purpose === 'TOPUP') {
    const entry = (await listCreditTransactionDtos(LEDGER_HEAD)).find((item) => item.type === 'PURCHASE' && item.reference === reference)
    return entry === undefined ? { status: 'NOT_CONFIRMED', purpose, gatewayCode } : { status: 'SUCCESS', purpose, credits: entry.amount ?? 0 }
  }
  const current = await getCurrentSubscriptionDto()
  const active = subscriptionStatusOf(current, new Date().toISOString()) === 'ACTIVE'
  return gatewayCode === '00' && active && current.planName !== null
    ? { status: 'SUCCESS', purpose, planName: current.planName }
    : { status: 'NOT_CONFIRMED', purpose, gatewayCode }
}
