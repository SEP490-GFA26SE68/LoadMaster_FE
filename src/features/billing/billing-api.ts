/**
 * Hàm → endpoint backend (FE-0-09). Bật nhóm `billing` (`usesBackend('billing')`) thì đọc ghi backend; tắt thì kho mẫu như cũ.
 *   getSubscriptionView     → GET /api/subscription/current (+ GET /api/subscription/plans/{id} khi gói còn hiệu lực)
 *   listPlansOnSale         → GET /api/subscription/plans (backend chỉ trả gói đang bán)
 *   subscribe               → POST /api/subscription/subscribe (trả URL thanh toán)
 *   cancelSubscription      → POST /api/subscription/cancel, rồi đọc lại gói
 *   getCreditBalance        → GET /api/credits/balance
 *   listCreditTransactions  → GET /api/credits/transactions (đọc hết các trang; FE phân trang trên danh sách đã đọc)
 *   topUpCredits            → POST /api/credits/topup (trả URL thanh toán)
 *   listInvoices            → GET /api/company/invoices (kho mẫu không có hoá đơn)
 *   chưa có ở BE: listPayments
 * Có backend thì đăng ký và nạp đi qua cổng thử của backend và trang xác nhận `/thanh-toan/ket-qua` (`server-payment-api.ts`); trang
 * thanh toán giả lập (`payment-api.ts`) chỉ dùng với kho mẫu.
 */

import { api, ApiError } from '@/lib/api-client'
import { usesBackend } from '@/lib/backend-config'
import {
  creditBalanceOf,
  creditTransactionOf,
  fromBackendLocalDateTime,
  getCreditBalanceDto,
  getCurrentSubscriptionDto,
  getPlanDto,
  listActivePlans,
  listCreditTransactionDtos,
  planFromDto,
  subscriptionStatusOf,
  withBusinessCode,
} from '@/lib/billing-backend-api'
import {
  BILLING_CONSTANTS,
  getMockDb,
  type CompanySubscription,
  type CreditBalance,
  type CreditTransaction,
  type CurrentSubscription,
  type PaymentTransaction,
  type SubscriptionPlan,
} from '@/lib/mock-db'
import { startServerPayment, type PaymentStart } from './server-payment-api'

const ON_BACKEND = usesBackend('billing')

/** Giá một credit backend tính khi nạp (`CreditController.PRICE_PER_CREDIT_VND`; chưa có endpoint đọc giá). */
const BACKEND_CREDIT_PRICE_VND = 5000

/**
 * Phần của màn theo nguồn dữ liệu. Backend chưa có endpoint đọc giao dịch thanh toán: không có lịch sử thanh toán, nút Trả hay banner
 * thanh toán chờ; có hoá đơn mà kho mẫu không có. Kho mẫu trả bằng trang giả lập `/thanh-toan/gia-lap` (`simulation`); backend xác
 * nhận ở trang `/thanh-toan/ket-qua` (`serverPayment`). Gói trả phí của backend không bao giờ tự gia hạn (tới hạn là hết hạn, huỷ chỉ
 * tắt cờ), nên màn không ghi dòng "Tự gia hạn" (`autoRenew`) — kho mẫu có gia hạn thật.
 */
export const BILLING_CAPABILITIES = {
  payments: !ON_BACKEND,
  invoices: ON_BACKEND,
  simulation: !ON_BACKEND,
  serverPayment: ON_BACKEND,
  autoRenew: !ON_BACKEND,
  creditPriceVnd: ON_BACKEND ? BACKEND_CREDIT_PRICE_VND : BILLING_CONSTANTS.creditPriceVnd,
} as const

/**
 * Gói của công ty. `current` là gói hiện tại kèm gói cước nó theo, `null` khi chưa có gói. Backend chỉ trả gói khi còn `ACTIVE`: gói đã
 * hết hạn không có tên hay ngày, chỉ còn `lapsed` để màn nói "đã hết hạn" thay vì "chưa có gói".
 */
export type SubscriptionView = { readonly current: CurrentSubscription | null; readonly lapsed: boolean }

/** Hoá đơn của công ty (chỉ có ở backend). */
export type InvoiceStatus = 'UNPAID' | 'PAID' | 'FAILED' | 'VOID'
export type Invoice = {
  readonly id: string
  readonly number: string
  readonly planName: string
  readonly amountVnd: number
  readonly status: InvoiceStatus
  /** Kỳ tính tiền như backend ghi (`2026-10`). */
  readonly period: string
  readonly createdAt: string
}

/** `InvoiceResponse`; `paidAt` của backend là hạn trả chứ không phải lúc trả nên không đọc. */
type InvoiceDto = {
  readonly id: number
  readonly invoiceNumber: string | null
  readonly planName: string | null
  readonly amount: number | string | null
  readonly status: InvoiceStatus | null
  readonly billingPeriod: string | null
  readonly createdAt: string | null
}

// GET /api/subscription/current, rồi GET /api/subscription/plans/{id}
export async function getSubscriptionView(): Promise<SubscriptionView> {
  if (!ON_BACKEND) return { current: await getMockDb().getCurrentSubscription(), lapsed: false }
  const dto = await getCurrentSubscriptionDto()
  const status = subscriptionStatusOf(dto, new Date().toISOString())
  if (status === null || dto.planId === null) return { current: null, lapsed: status === 'EXPIRED' }
  const planId = String(dto.planId)
  const subscription: CompanySubscription = {
    id: String(dto.subscriptionId ?? ''),
    companyId: '',
    planId,
    status,
    startedAt: fromBackendLocalDateTime(dto.startedAt) ?? '',
    expiresAt: fromBackendLocalDateTime(dto.expiresAt) ?? '',
    autoRenew: dto.autoRenew === true,
  }
  return { current: { subscription, plan: planFromDto(await getPlanDto(planId)) }, lapsed: false }
}

/** Gói đang bán, theo thứ tự hạng — các gói công ty chọn khi chưa có gói hoặc gói đã hết hạn. */
// GET /api/subscription/plans
export async function listPlansOnSale(): Promise<SubscriptionPlan[]> {
  if (ON_BACKEND) return listActivePlans()
  return (await getMockDb().listSubscriptionPlans()).filter((plan) => plan.active)
}

/**
 * Đăng ký một gói: chỉ khi chưa có gói hoặc gói đã hết hạn (`SUBSCRIPTION_ACTIVE`; backend: `ACTIVE_SUBSCRIPTION_ALREADY_EXISTS`), gói
 * đang bán. Gói chỉ được kích hoạt khi thanh toán thành công; gói miễn phí của backend kích hoạt ngay.
 */
// POST /api/subscription/subscribe
export async function subscribe(planId: string): Promise<PaymentStart> {
  if (!ON_BACKEND) return { kind: 'simulation', paymentId: (await getMockDb().subscribeToPlan(planId)).id }
  return startServerPayment('/api/subscription/subscribe', { planId: Number(planId) }, 'SUBSCRIBE', {
    CONFLICT: 'ACTIVE_SUBSCRIPTION_ALREADY_EXISTS',
    NOT_FOUND: 'SUBSCRIPTION_PLAN_NOT_FOUND',
  })
}

/** Huỷ gói: còn hiệu lực tới hết kỳ, không tự gia hạn. Gói không còn đang dùng: `SUBSCRIPTION_STATUS_INVALID` (backend: `NO_ACTIVE_SUBSCRIPTION`). */
// POST /api/subscription/cancel, rồi GET /api/subscription/current
export async function cancelSubscription(): Promise<CompanySubscription> {
  if (!ON_BACKEND) return getMockDb().cancelSubscription()
  await withBusinessCode(api().post<null>('/api/subscription/cancel'), { NOT_FOUND: 'NO_ACTIVE_SUBSCRIPTION' })
  const { current } = await getSubscriptionView()
  if (current === null) throw new ApiError('NO_ACTIVE_SUBSCRIPTION')
  return current.subscription
}

// GET /api/credits/balance
export async function getCreditBalance(): Promise<CreditBalance> {
  return ON_BACKEND ? creditBalanceOf(await getCreditBalanceDto()) : getMockDb().getCreditBalance()
}

/** Mới nhất trước, cùng lúc thì mã lớn hơn trước. */
function newestFirst(a: CreditTransaction, b: CreditTransaction): number {
  return Date.parse(b.createdAt) - Date.parse(a.createdAt) || Number(b.id) - Number(a.id)
}

/** Sổ cái credit của công ty, mới nhất trước. */
// GET /api/credits/transactions
export async function listCreditTransactions(): Promise<CreditTransaction[]> {
  if (!ON_BACKEND) return getMockDb().listCreditTransactions()
  return (await listCreditTransactionDtos()).map(creditTransactionOf).sort(newestFirst)
}

/** Nạp 50 hoặc 500 credit (`TOPUP_INVALID`), theo giá ở `BILLING_CAPABILITIES`. Credit chỉ được cộng khi thanh toán thành công. */
// POST /api/credits/topup
export async function topUpCredits(credits: number): Promise<PaymentStart> {
  if (!ON_BACKEND) return { kind: 'simulation', paymentId: (await getMockDb().topUpCredits(credits)).id }
  return startServerPayment('/api/credits/topup', { credits }, 'TOPUP')
}

/** Thanh toán của công ty, mới nhất trước. */
// chưa có ở BE
export function listPayments(): Promise<PaymentTransaction[]> {
  return getMockDb().listPayments()
}

function invoiceOf(dto: InvoiceDto): Invoice {
  return {
    id: String(dto.id),
    number: dto.invoiceNumber ?? String(dto.id),
    planName: dto.planName ?? '',
    amountVnd: Math.round(Number(dto.amount ?? 0)),
    status: dto.status ?? 'UNPAID',
    period: dto.billingPeriod ?? '',
    createdAt: fromBackendLocalDateTime(dto.createdAt) ?? '',
  }
}

/** Hoá đơn của công ty, mới nhất trước; kho mẫu không có hoá đơn. */
// GET /api/company/invoices
export async function listInvoices(): Promise<Invoice[]> {
  if (!ON_BACKEND) return []
  const rows = await api().get<InvoiceDto[] | null>('/api/company/invoices')
  return (rows ?? []).map(invoiceOf).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || Number(b.id) - Number(a.id))
}
