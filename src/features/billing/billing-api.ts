/**
 * Hàm → endpoint backend (FE-0-09). Bật nhóm `billing` (`usesBackend('billing')`) thì đọc ghi backend; tắt thì kho mẫu như cũ.
 *   getSubscriptionView     → GET /api/subscription/current (+ GET /api/subscription/plans/{id} khi gói còn hiệu lực)
 *   listPlansOnSale         → GET /api/subscription/plans (backend chỉ trả gói đang bán)
 *   subscribe               → POST /api/subscription/subscribe (trả URL thanh toán)
 *   cancelSubscription      → POST /api/subscription/cancel, rồi đọc lại gói
 *   getCreditBalance        → GET /api/credits/balance
 *   listCreditTransactions  → GET /api/credits/transactions (đọc hết các trang; FE phân trang trên danh sách đã đọc)
 *   topUpCredits            → POST /api/credits/topup (trả URL thanh toán)
 *   getTopUpTerms           → GET /api/credits/pricing (giá một credit theo hạng gói; kho mẫu một giá)
 *   getRenewal              → GET /api/subscription/renewal (gói gia hạn được không, thanh toán gói còn chờ; chỉ backend)
 *   renewSubscription       → POST /api/subscription/renew (gia hạn đúng gói đang hoặc vừa dùng; trả URL thanh toán; chỉ backend)
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
  getCreditPricing,
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
  type PlanTier,
  type SubscriptionPlan,
} from '@/lib/mock-db'
import { startServerPayment, type PaymentStart } from './server-payment-api'

const ON_BACKEND = usesBackend('billing')

/**
 * Phần của màn theo nguồn dữ liệu. Backend chưa có endpoint đọc giao dịch thanh toán: không có lịch sử thanh toán, nút Trả hay banner
 * thanh toán chờ; có hoá đơn mà kho mẫu không có. Kho mẫu trả bằng trang giả lập `/thanh-toan/gia-lap` (`simulation`); backend xác
 * nhận ở trang `/thanh-toan/ket-qua` (`serverPayment`). Gói trả phí của backend không bao giờ tự gia hạn (tới hạn là hết hạn, huỷ chỉ
 * tắt cờ), nên màn không ghi dòng "Tự gia hạn" (`autoRenew`) — kho mẫu có gia hạn thật. Backend tính theo hợp đồng
 * (`contractRenewal`): công ty tự gia hạn đúng gói đang dùng thêm một kỳ, muốn lên hạng cao hơn thì gửi yêu cầu hỗ trợ; nạp được số
 * credit tuỳ ý (`customTopUp`; kho mẫu chỉ có gói 50 / 500); quản trị công ty dùng thử ký thoả thuận dịch vụ
 * (`agreements`). Gói đã hết hạn (kể cả gói đã ngừng bán) gia hạn đúng gói đó, và thanh toán gói còn chờ có banner kèm nút Trả
 * (`renewal`; kho mẫu: banner từ lịch sử thanh toán, gia hạn tự tạo thanh toán).
 */
export const BILLING_CAPABILITIES = {
  payments: !ON_BACKEND,
  invoices: ON_BACKEND,
  simulation: !ON_BACKEND,
  serverPayment: ON_BACKEND,
  autoRenew: !ON_BACKEND,
  contractRenewal: ON_BACKEND,
  renewal: ON_BACKEND,
  customTopUp: ON_BACKEND,
  agreements: ON_BACKEND,
} as const

/**
 * Điều kiện nạp credit: giá một credit, hạng tính giá (`null`: theo gói trên màn), số credit nạp ít nhất, trần số dư (`null`: không
 * trần) và nạp được không. Kho mẫu: một giá, không trần, luôn nạp được. Backend: bảng giá của máy chủ theo hạng gói đang dùng (chưa có
 * gói tính như Basic); gói đã hết hạn thì không nạp được (`topUpAllowed`) — gia hạn trước.
 */
export type TopUpTerms = {
  readonly tier: PlanTier | null
  readonly priceVnd: number
  readonly minCredits: number
  readonly maxBalance: number | null
  readonly allowed: boolean
}

// GET /api/credits/pricing
export async function getTopUpTerms(): Promise<TopUpTerms> {
  if (!ON_BACKEND) return { tier: null, priceVnd: BILLING_CONSTANTS.creditPriceVnd, minCredits: 1, maxBalance: null, allowed: true }
  const pricing = await getCreditPricing()
  return { tier: pricing.tier, priceVnd: pricing.priceVnd, minCredits: pricing.minTopUpCredits, maxBalance: null, allowed: pricing.topUpAllowed }
}

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
 * Đăng ký một gói đang bán. Kho mẫu: chỉ khi chưa có gói hoặc gói đã hết hạn (`SUBSCRIPTION_ACTIVE`). Backend: thêm cả gia hạn đúng gói
 * đang dùng; đổi sang gói khác khi còn hiệu lực, hay lên hạng cao hơn sau khi hết hạn, là `ACTIVE_SUBSCRIPTION_ALREADY_EXISTS` (phải gửi
 * yêu cầu hỗ trợ). Gói chỉ được kích hoạt khi thanh toán thành công; gói miễn phí của backend kích hoạt ngay.
 */
// POST /api/subscription/subscribe
export async function subscribe(planId: string, billingCycle?: 'MONTHLY' | 'YEARLY'): Promise<PaymentStart> {
  if (!ON_BACKEND) return { kind: 'simulation', paymentId: (await getMockDb().subscribeToPlan(planId)).id }
  const body = billingCycle === 'YEARLY' ? { planId: Number(planId), billingCycle: 'YEARLY' } : { planId: Number(planId) }
  return startServerPayment('/api/subscription/subscribe', body, 'SUBSCRIBE', {
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

/**
 * Nạp credit theo giá của `getTopUpTerms`. Kho mẫu: gói 50 hoặc 500 (`TOPUP_INVALID`). Backend: số nguyên từ 1, không trần số dư. Credit
 * chỉ được cộng khi thanh toán thành công.
 */
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

/** Vì sao chưa gia hạn được (`null`: gia hạn được): chưa từng có gói, hợp đồng đã huỷ, gói dùng thử, gói còn hạn ngoài mấy ngày cuối. */
export type RenewalBlock = 'NO_SUBSCRIPTION' | 'CANCELLED' | 'TRIAL' | 'NOT_DUE'

/** Thanh toán gói (đăng ký hay gia hạn) còn chờ trả: `reference` là mã giao dịch gửi cổng thử (`MOCK_…`). */
export type PendingPlanPayment = { readonly reference: string; readonly renewal: boolean; readonly amountVnd: number }

/** Gia hạn gói của công ty theo máy chủ. `planName` là gói đang hoặc vừa dùng (`null` khi chưa từng có gói). */
export type Renewal = {
  readonly planName: string | null
  readonly planOnSale: boolean
  readonly expiresAt: string | null
  readonly amountVnd: number
  readonly renewable: boolean
  readonly block: RenewalBlock | null
  readonly windowDays: number
  readonly pending: PendingPlanPayment | null
}

type RenewalDto = {
  readonly planName: string | null
  readonly planActive: boolean | null
  readonly expiresAt: string | null
  readonly amountVnd: number | string | null
  readonly renewable: boolean | null
  readonly reason: string | null
  readonly renewalWindowDays: number | null
  readonly pendingPayment: {
    readonly transactionId: string | null
    readonly orderType: string | null
    readonly amountVnd: number | string | null
  } | null
}

const RENEWAL_BLOCKS: readonly RenewalBlock[] = ['NO_SUBSCRIPTION', 'CANCELLED', 'TRIAL', 'NOT_DUE']

function renewalOf(dto: RenewalDto): Renewal {
  const pending = dto.pendingPayment
  const reference = pending?.transactionId ?? ''
  return {
    planName: dto.planName,
    planOnSale: dto.planActive !== false,
    expiresAt: fromBackendLocalDateTime(dto.expiresAt),
    amountVnd: Math.round(Number(dto.amountVnd ?? 0)),
    renewable: dto.renewable === true,
    block: RENEWAL_BLOCKS.find((item) => item === dto.reason) ?? null,
    windowDays: dto.renewalWindowDays ?? 0,
    pending:
      pending === null || reference === ''
        ? null
        : { reference, renewal: pending.orderType === 'SUBSCRIPTION_RENEWAL', amountVnd: Math.round(Number(pending.amountVnd ?? 0)) },
  }
}

/** Chỉ backend (`BILLING_CAPABILITIES.renewal`); kho mẫu đọc thanh toán chờ từ lịch sử thanh toán. */
// GET /api/subscription/renewal
export async function getRenewal(): Promise<Renewal> {
  if (!ON_BACKEND) throw new ApiError('NOT_SUPPORTED')
  return renewalOf(await api().get<RenewalDto>('/api/subscription/renewal'))
}

/**
 * Gia hạn đúng gói đang (hoặc vừa) dùng thêm một kỳ qua cổng thử, kể cả gói đã ngừng bán; thanh toán gia hạn còn chờ được dùng lại.
 * Chưa tới mấy ngày cuối, hợp đồng đã huỷ, gói dùng thử: `SUBSCRIPTION_NOT_RENEWABLE`.
 */
// POST /api/subscription/renew
export async function renewSubscription(): Promise<PaymentStart> {
  if (!ON_BACKEND) throw new ApiError('NOT_SUPPORTED')
  return startServerPayment('/api/subscription/renew', {}, 'SUBSCRIBE', { CONFLICT: 'SUBSCRIPTION_NOT_RENEWABLE', NOT_FOUND: 'NO_ACTIVE_SUBSCRIPTION' })
}
