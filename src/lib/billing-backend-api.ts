/**
 * Gói cước, gói hiện tại và số dư credit đọc từ backend (`usesBackend('billing')`) — dùng chung cho danh mục gói của nền tảng, gói và
 * credit của công ty, thẻ Credit của Thiết lập tối ưu và bảng giá công khai. Kiểu DTO của backend chỉ nằm ở đây và ở `-api.ts` dùng nó;
 * hàm trả kiểu của app.
 *   listPlanDtos, listActivePlans → GET /api/subscription/plans (chỉ gói đang bán, không cần đăng nhập)
 *   getPlanDto                    → GET /api/subscription/plans/{id}
 *   getCurrentSubscriptionDto     → GET /api/subscription/current
 *   getCreditBalanceDto           → GET /api/credits/balance
 *   listCreditTransactionDtos     → GET /api/credits/transactions (đọc theo trang)
 */

import { api, ApiError, isApiError, type ApiClient, type TransportErrorCode } from './api-client'
import { fetchAllPages, type FetchAllPagesOptions } from './api-page'
import { isoFromBackend } from './backend-time'
import {
  effectiveSubscriptionStatus,
  PLAN_TIERS,
  TIER_ALGORITHM,
  TIER_FEATURES,
  type AlgorithmTier,
  type CreditBalance,
  type CreditTransaction,
  type CreditTransactionType,
  type PlanTier,
  type SubscriptionPlan,
  type SubscriptionStatus,
} from './mock-db/billing-model'

export const PLANS_PATH = '/api/subscription/plans'

/** `SubscriptionPlanResponse`; `priceVnd` là BigDecimal (số JSON). */
export type PlanDto = {
  readonly id: number
  readonly planCode: string
  readonly name: string
  readonly priceVnd: number | string | null
  readonly tier: PlanTier
  readonly monthlyCredits: number | null
  readonly algorithmTier: AlgorithmTier | null
  /** Chuỗi tự do; seed ghi mảng JSON mã tính năng. */
  readonly features: string | null
  readonly billingCycle: 'MONTHLY' | 'YEARLY' | null
  readonly maxVehicles: number | null
  readonly maxMonthlyJobs: number | null
  readonly active: boolean | null
  /** Số công ty có gói `ACTIVE` theo gói này (gói đã hết hạn không tính). */
  readonly activeCompanyCount: number
}

/** `SubscriptionCurrentResponse`: gói không `ACTIVE` (hoặc chưa có) chỉ có `status` và `creditsBalance`. */
export type CurrentSubscriptionDto = {
  readonly subscriptionId: number | null
  readonly planId: number | null
  readonly planName: string | null
  readonly tier: PlanTier | null
  readonly status: 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'CANCELLED' | null
  readonly startedAt: string | null
  readonly expiresAt: string | null
  readonly autoRenew: boolean | null
  readonly creditsBalance: number | null
  readonly creditsMonthlyGrant: number | null
  readonly algorithmTier: AlgorithmTier | null
}

/** `CreditBalanceResponse`. */
export type CreditBalanceDto = { readonly companyId: number | null; readonly balance: number | null; readonly isUnlimited: boolean | null }

/** Backend coi hạng Ultimate là không giới hạn credit (không theo `monthlyCredits`). */
export const UNLIMITED_TIER: PlanTier = 'ULTIMATE'

/** Mốc giờ của backend (cách đọc ở `isoFromBackend`) cho trường có thể vắng: vắng hoặc không đọc được là `null`. */
export function fromBackendLocalDateTime(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value.trim() === '') return null
  try {
    return isoFromBackend(value)
  } catch {
    return null
  }
}

/**
 * Backend `develop` không trả `code` cho lỗi nghiệp vụ, chỉ mã HTTP. Ở nơi một mã HTTP chỉ có một nghĩa (409 khi xoá gói là gói còn công
 * ty dùng), đổi sang mã nghiệp vụ để câu báo đúng việc; lỗi khác giữ nguyên.
 */
export async function withBusinessCode<T>(promise: Promise<T>, codes: Partial<Record<TransportErrorCode, string>>): Promise<T> {
  try {
    return await promise
  } catch (error) {
    const byStatus: Readonly<Record<string, string | undefined>> = codes
    const code = isApiError(error) ? byStatus[error.code] : undefined
    if (!isApiError(error) || code === undefined) throw error
    throw new ApiError(code, { status: error.status, params: error.params })
  }
}

function tierOf(value: string | null | undefined): PlanTier {
  return PLAN_TIERS.find((tier) => tier === value) ?? PLAN_TIERS[0]
}

/** Mã tính năng của gói: mảng JSON, hoặc danh sách cách nhau bằng dấu phẩy; trống thì bộ của hạng. */
function featuresOf(raw: string | null, tier: PlanTier): string[] {
  const text = raw?.trim() ?? ''
  if (text === '') return [...TIER_FEATURES[tier]]
  if (text.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(text)
      if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === 'string')
    } catch {
      return [...TIER_FEATURES[tier]]
    }
  }
  return text.split(',').map((item) => item.trim()).filter((item) => item !== '')
}

export function planFromDto(dto: PlanDto): SubscriptionPlan {
  const tier = tierOf(dto.tier)
  return {
    id: String(dto.id),
    name: dto.name,
    tier,
    priceVnd: Math.round(Number(dto.priceVnd ?? 0)),
    monthlyCredits: tier === UNLIMITED_TIER ? null : (dto.monthlyCredits ?? 0),
    algorithmTier: dto.algorithmTier ?? TIER_ALGORITHM[tier],
    features: featuresOf(dto.features, tier),
    active: dto.active !== false,
    // Backend không có cờ "giá trị tạm".
    provisional: false,
  }
}

/** Thứ tự hạng như kho mẫu (Basic → Pro → Ultimate), rồi giá, rồi mã. */
function comparePlans(a: PlanDto, b: PlanDto): number {
  return PLAN_TIERS.indexOf(tierOf(a.tier)) - PLAN_TIERS.indexOf(tierOf(b.tier)) || Number(a.priceVnd ?? 0) - Number(b.priceVnd ?? 0) || a.id - b.id
}

// GET /api/subscription/plans
export async function listPlanDtos(client: ApiClient = api()): Promise<PlanDto[]> {
  const plans = await client.get<PlanDto[] | null>(PLANS_PATH)
  return [...(plans ?? [])].sort(comparePlans)
}

// GET /api/subscription/plans
export async function listActivePlans(client: ApiClient = api()): Promise<SubscriptionPlan[]> {
  return (await listPlanDtos(client)).filter((plan) => plan.active !== false).map(planFromDto)
}

// GET /api/subscription/plans/{id}
export function getPlanDto(planId: string, client: ApiClient = api()): Promise<PlanDto> {
  return client.get<PlanDto>(`${PLANS_PATH}/${encodeURIComponent(planId)}`)
}

// GET /api/subscription/current
export function getCurrentSubscriptionDto(client: ApiClient = api()): Promise<CurrentSubscriptionDto> {
  return client.get<CurrentSubscriptionDto>('/api/subscription/current')
}

// GET /api/credits/balance
export function getCreditBalanceDto(client: ApiClient = api()): Promise<CreditBalanceDto> {
  return client.get<CreditBalanceDto>('/api/credits/balance')
}

export function creditBalanceOf(dto: CreditBalanceDto): CreditBalance {
  return { balance: dto.balance ?? 0, unlimited: dto.isUnlimited === true }
}

/**
 * Trạng thái gói của app từ `/current`; `null` khi công ty chưa từng có gói (hoặc ở trạng thái app không có, như `TRIAL`). Backend huỷ
 * gói chỉ tắt tự gia hạn — gói vẫn `ACTIVE` tới hết kỳ — nên `ACTIVE` đã tắt tự gia hạn là "Đã huỷ — còn hiệu lực"; gói quá hạn mà lịch
 * hằng ngày của backend chưa chạy tới là "Đã hết hạn" (`effectiveSubscriptionStatus`, như kho mẫu).
 */
export function subscriptionStatusOf(dto: CurrentSubscriptionDto, nowIso: string): SubscriptionStatus | null {
  if (dto.status === 'EXPIRED' || dto.status === 'CANCELLED') return 'EXPIRED'
  if (dto.status !== 'ACTIVE') return null
  const status: SubscriptionStatus = dto.autoRenew === false ? 'CANCELLED' : 'ACTIVE'
  const expiresAt = fromBackendLocalDateTime(dto.expiresAt)
  return expiresAt === null ? status : effectiveSubscriptionStatus({ status, expiresAt }, nowIso)
}

export const CREDIT_TRANSACTIONS_PATH = '/api/credits/transactions'

/** `CreditTransactionResponse`: lượt dùng ghi `-1`, hoàn rồi thì lượt dùng mang `refunded`. */
export type CreditTransactionDto = {
  readonly id: number
  readonly amount: number | null
  readonly type: CreditTransactionType
  readonly reference: string | null
  readonly refunded: boolean | null
  readonly createdAt: string | null
}

// GET /api/credits/transactions
export function listCreditTransactionDtos(options: FetchAllPagesOptions = {}, client: ApiClient = api()): Promise<CreditTransactionDto[]> {
  return fetchAllPages<CreditTransactionDto>(CREDIT_TRANSACTIONS_PATH, { size: 100, ...options }, client)
}

/** Backend trừ credit ngay khi chạy, không có bước giữ: lượt dùng là "Đã trừ", hoặc "Đã hoàn" khi đã được hoàn. Không có mã chuyến. */
export function creditTransactionOf(dto: CreditTransactionDto): CreditTransaction {
  const refunded = dto.refunded === true
  return {
    id: String(dto.id),
    companyId: '',
    type: dto.type,
    amount: dto.amount ?? 0,
    reference: dto.reference ?? '',
    refunded,
    ...(dto.type === 'USAGE' ? { usageStatus: refunded ? ('REFUNDED' as const) : ('DEDUCTED' as const) } : {}),
    createdAt: fromBackendLocalDateTime(dto.createdAt) ?? '',
  }
}
