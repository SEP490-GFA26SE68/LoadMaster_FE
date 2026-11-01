import { isAuthenticated } from '@/features/auth/auth-api'
import { apiFetch } from '@/lib/api-client'
import {
  BILLING_CONSTANTS,
  getMockDb,
  type AlgorithmTier,
  type CompanySubscription,
  type CreditBalance,
  type CreditTransaction,
  type CreditTransactionType,
  type CurrentSubscription,
  type PaymentTransaction,
  type SubscriptionPlan,
  type SubscriptionStatus,
  type PlanTier,
} from '@/lib/mock-db'
import { TIER_ALGORITHM, TIER_FEATURES } from '@/lib/mock-db/billing-model'

type ApiResponse<T> = {
  success: boolean
  message?: string
  data: T
}

export type SubscriptionPlanApi = {
  id: number
  planCode: string
  name: string
  priceVnd: number
  tier: PlanTier
  monthlyCredits: number | null
  algorithmTier?: AlgorithmTier | null
  features?: string | null
  billingCycle?: 'MONTHLY' | 'YEARLY' | null
  active?: boolean | null
  activeCompanyCount?: number
}

type SubscriptionCurrentApi = {
  subscriptionId: number | null
  planId: number | null
  planName: string | null
  tier: PlanTier | null
  status: SubscriptionStatus | null
  startedAt: string | null
  expiresAt: string | null
  autoRenew: boolean | null
  creditsBalance: number | null
  creditsMonthlyGrant: number | null
  algorithmTier: AlgorithmTier | null
}

type CreditBalanceApi = {
  companyId: number
  balance: number
  isUnlimited: boolean
}

type CreditTransactionApi = {
  id: number
  amount: number
  type: CreditTransactionType
  reference: string | null
  refunded: boolean | null
  createdAt: string
}

type PageApi<T> = {
  content: T[]
}

type PaymentUrlApi = {
  id: number
  transactionId: string
  paymentUrl: string | null
  status: string
}

export type StoredBackendPayment = {
  payment: PaymentTransaction
  planName: string | null
  paymentUrl: string | null
}

const STORAGE_KEY = 'loadmaster.backend.payments'
let memoryPayments: StoredBackendPayment[] = []

function readStoredPayments(): StoredBackendPayment[] {
  if (typeof sessionStorage === 'undefined') return memoryPayments
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return memoryPayments
    const parsed = JSON.parse(raw) as StoredBackendPayment[]
    memoryPayments = parsed
    return parsed
  } catch {
    return memoryPayments
  }
}

export function writeStoredPayments(items: StoredBackendPayment[]): void {
  memoryPayments = items
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      // ignore storage quota errors
    }
  }
}

export function upsertStoredPayment(entry: StoredBackendPayment): PaymentTransaction {
  const current = readStoredPayments().filter((item) => item.payment.id !== entry.payment.id)
  const next = [entry, ...current]
  writeStoredPayments(next)
  return entry.payment
}

export function findStoredPayment(paymentId: string): StoredBackendPayment | undefined {
  return readStoredPayments().find((item) => item.payment.id === paymentId)
}

function parseFeatures(raw: string | null | undefined, tier: PlanTier): string[] {
  if (!raw || !raw.trim()) return [...TIER_FEATURES[tier]]
  const trimmed = raw.trim()
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) return parsed.map(String)
    } catch {
      // fallback below
    }
  }
  const codes = trimmed.split(',').map((item) => item.trim()).filter(Boolean)
  const validCodes = new Set<string>([
    ...TIER_FEATURES.BASIC,
    ...TIER_FEATURES.PRO,
    ...TIER_FEATURES.ULTIMATE,
  ])
  if (codes.length > 0 && codes.every((c) => validCodes.has(c))) {
    return codes
  }
  return [...TIER_FEATURES[tier]]
}

export function mapSubscriptionPlanApi(item: SubscriptionPlanApi): SubscriptionPlan {
  const tier = item.tier ?? 'BASIC'
  return {
    id: String(item.id),
    name: item.name,
    tier,
    priceVnd: Number(item.priceVnd ?? 0),
    monthlyCredits: item.monthlyCredits ?? null,
    algorithmTier: item.algorithmTier ?? TIER_ALGORITHM[tier],
    features: parseFeatures(item.features, tier),
    active: item.active ?? true,
    provisional: false,
  }
}

function toIsoString(dateStr: string | null | undefined): string {
  if (!dateStr) return new Date().toISOString()
  const normalized = dateStr.endsWith('Z') || dateStr.includes('+') ? dateStr : `${dateStr}Z`
  const parsed = Date.parse(normalized)
  return Number.isNaN(parsed) ? new Date().toISOString() : new Date(parsed).toISOString()
}

// GET /api/subscription/current
export async function getCurrentSubscription(): Promise<CurrentSubscription | null> {
  if (!isAuthenticated()) {
    return getMockDb().getCurrentSubscription()
  }

  const [subRes, plans] = await Promise.all([
    apiFetch<ApiResponse<SubscriptionCurrentApi>>('/api/subscription/current'),
    listPlansOnSale(),
  ])

  const data = subRes.data
  if (!data || data.subscriptionId == null || data.status == null) {
    return null
  }

  const tier: PlanTier = data.tier ?? 'BASIC'
  const matchedPlan =
    plans.find((p) => p.id === String(data.planId)) ??
    ({
      id: String(data.planId ?? '1'),
      name: data.planName ?? tier,
      tier,
      priceVnd: 0,
      monthlyCredits: data.creditsMonthlyGrant ?? 0,
      algorithmTier: data.algorithmTier ?? TIER_ALGORITHM[tier],
      features: [...TIER_FEATURES[tier]],
      active: true,
      provisional: false,
    } satisfies SubscriptionPlan)

  const effectiveStatus: SubscriptionStatus =
    (data.status as string) === 'TRIAL' ? 'ACTIVE' : data.status

  const subscription: CompanySubscription = {
    id: String(data.subscriptionId),
    companyId: '1',
    planId: matchedPlan.id,
    status: effectiveStatus,
    startedAt: toIsoString(data.startedAt),
    expiresAt: toIsoString(data.expiresAt),
    autoRenew: Boolean(data.autoRenew ?? true),
  }

  return {
    subscription,
    plan: matchedPlan,
  }
}

// GET /api/subscription/plans
export async function listPlansOnSale(): Promise<SubscriptionPlan[]> {
  if (!isAuthenticated()) {
    return (await getMockDb().listSubscriptionPlans()).filter((plan) => plan.active)
  }

  const items = await apiFetch<SubscriptionPlanApi[]>('/api/subscription/plans')
  return items.map(mapSubscriptionPlanApi).filter((plan) => plan.active)
}

// POST /api/subscription/subscribe
export async function subscribe(planId: string): Promise<PaymentTransaction> {
  if (!isAuthenticated()) {
    return getMockDb().subscribeToPlan(planId)
  }

  const plans = await listPlansOnSale()
  const plan = plans.find((p) => p.id === planId)

  const body = await apiFetch<ApiResponse<PaymentUrlApi>>('/api/subscription/subscribe', {
    method: 'POST',
    body: JSON.stringify({
      planId: Number(planId),
      gateway: 'VNPAY',
    }),
  })

  const now = new Date().toISOString()
  const txnId = body.data.transactionId ?? `VNPAY_${body.data.id ?? Date.now()}`
  const payment: PaymentTransaction = {
    id: txnId,
    companyId: '1',
    purpose: 'SUBSCRIBE',
    amountVnd: plan?.priceVnd ?? 0,
    status: body.data.status === 'ACTIVE' ? 'SUCCESS' : 'PENDING',
    planId,
    credits: plan?.monthlyCredits ?? null,
    createdAt: now,
    updatedAt: now,
  }

  return upsertStoredPayment({
    payment,
    planName: plan?.name ?? null,
    paymentUrl: body.data.paymentUrl ?? `/api/payment/mock-checkout?txnRef=${txnId}`,
  })
}

// POST /api/subscription/cancel
export async function cancelSubscription(): Promise<CompanySubscription> {
  if (!isAuthenticated()) {
    return getMockDb().cancelSubscription()
  }

  const currentBefore = await getCurrentSubscription()
  await apiFetch<ApiResponse<void>>('/api/subscription/cancel', {
    method: 'POST',
  })

  const now = new Date().toISOString()
  return {
    id: currentBefore?.subscription.id ?? '1',
    companyId: currentBefore?.subscription.companyId ?? '1',
    planId: currentBefore?.subscription.planId ?? '1',
    status: 'CANCELLED',
    startedAt: currentBefore?.subscription.startedAt ?? now,
    expiresAt: currentBefore?.subscription.expiresAt ?? now,
    autoRenew: false,
    cancelledAt: now,
  }
}

// GET /api/credits/balance
export async function getCreditBalance(): Promise<CreditBalance> {
  if (!isAuthenticated()) {
    return getMockDb().getCreditBalance()
  }

  const body = await apiFetch<ApiResponse<CreditBalanceApi>>('/api/credits/balance')
  return {
    balance: body.data.balance ?? 0,
    unlimited: Boolean(body.data.isUnlimited),
  }
}

// GET /api/credits/transactions
export async function listCreditTransactions(): Promise<CreditTransaction[]> {
  if (!isAuthenticated()) {
    return getMockDb().listCreditTransactions()
  }

  const body = await apiFetch<ApiResponse<PageApi<CreditTransactionApi>>>(
    '/api/credits/transactions?page=0&size=100',
  )
  const items = body.data?.content ?? []
  return items.map((item) => ({
    id: String(item.id),
    companyId: '1',
    type: item.type,
    amount: item.amount,
    reference: item.reference ?? '',
    refunded: Boolean(item.refunded),
    ...(item.type === 'USAGE'
      ? { usageStatus: item.refunded ? ('REFUNDED' as const) : ('DEDUCTED' as const) }
      : {}),
    createdAt: toIsoString(item.createdAt),
  }))
}

// POST /api/credits/topup
export async function topUpCredits(credits: number): Promise<PaymentTransaction> {
  if (!isAuthenticated()) {
    return getMockDb().topUpCredits(credits)
  }

  const currentSub = await getCurrentSubscription().catch(() => null)
  const tier = currentSub?.plan.tier ?? 'BASIC'
  const unitPrice = tier === 'ULTIMATE' ? 263 : tier === 'PRO' ? 326 : 400

  const body = await apiFetch<ApiResponse<PaymentUrlApi>>('/api/credits/topup', {
    method: 'POST',
    body: JSON.stringify({
      credits,
      gateway: 'VNPAY',
    }),
  })

  const now = new Date().toISOString()
  const txnId = body.data.transactionId ?? `VNPAY_${body.data.id ?? Date.now()}`
  const payment: PaymentTransaction = {
    id: txnId,
    companyId: '1',
    purpose: 'TOPUP',
    amountVnd: credits * unitPrice,
    status: 'PENDING',
    credits,
    createdAt: now,
    updatedAt: now,
  }

  return upsertStoredPayment({
    payment,
    planName: null,
    paymentUrl: body.data.paymentUrl ?? `/api/payment/mock-checkout?txnRef=${txnId}`,
  })
}

export async function listPayments(): Promise<PaymentTransaction[]> {
  if (!isAuthenticated()) {
    return getMockDb().listPayments()
  }

  return readStoredPayments().map((item) => item.payment)
}
