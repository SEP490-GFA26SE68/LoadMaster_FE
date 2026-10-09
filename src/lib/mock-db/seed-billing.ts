import {
  BILLING_CONSTANTS,
  type CompanySubscription,
  type CreditAccount,
  type CreditTransaction,
  type PaymentTransaction,
  type SubscriptionPlan,
} from './billing-model'
import { nextId } from './db-context'
import { LONG_BINH, PHUONG_NAM } from './seed-users'
import type { OptimizationRun } from './source-types'
import type { Trip } from './types'

/**
 * Gói cước, đăng ký, sổ cái credit và thanh toán của seed (FE-8-01). **Giá và hạn mức dưới đây là giá trị tạm** (`provisional`): nhóm
 * chưa chốt giá VND của ba gói và hạn mức credit tháng của Pro, Ultimate (PRD v2 mục 17.2) — chỉ Basic 100 credit/tháng lấy từ ví dụ
 * của backend. Màn gói cước ghi "Giá trị tạm — chờ chốt". Chốt số thật thì sửa ở **bảng này**, không ở chỗ nào khác.
 */
export const SEED_PLANS: readonly SubscriptionPlan[] = [
  {
    id: 'PLAN-001', name: 'Basic', tier: 'BASIC', priceVnd: 490_000, monthlyCredits: 100, algorithmTier: 'EP_DBLF',
    features: ['OPTIMIZATION_3D', 'ROUTE_OPTIMIZATION'], active: true, provisional: true,
  },
  {
    id: 'PLAN-002', name: 'Pro', tier: 'PRO', priceVnd: 1_490_000, monthlyCredits: 500, algorithmTier: 'EP_DBLF_GA',
    features: ['OPTIMIZATION_3D', 'ROUTE_OPTIMIZATION', 'ADVANCED_ALGORITHM'], active: true, provisional: true,
  },
  {
    id: 'PLAN-003', name: 'Ultimate', tier: 'ULTIMATE', priceVnd: 3_990_000, monthlyCredits: null, algorithmTier: 'EP_DBLF_GA_AI',
    features: ['OPTIMIZATION_3D', 'ROUTE_OPTIMIZATION', 'ADVANCED_ALGORITHM', 'UNLIMITED_CREDITS'], active: true, provisional: true,
  },
]

/**
 * Công ty nào dùng gói nào, và lịch sử trước lần chạy đầu tiên của seed: gói đăng ký `leadDays` ngày trước lần chạy tối ưu đầu tiên của
 * công ty; `earlierUsage` là số lượt dùng credit **cũ hơn mọi chuyến của seed** (chuyến đã xong từ trước, không còn trong kho) — Phương
 * Nam đã dùng gần hết 100 credit của gói Basic nên số dư thấp (còn 2 sau lần chạy duy nhất của seed).
 */
const COMPANY_PLANS = [
  { companyId: LONG_BINH, planId: 'PLAN-002', leadDays: 1, earlierUsage: 0 },
  { companyId: PHUONG_NAM, planId: 'PLAN-001', leadDays: 20, earlierUsage: 97 },
] as const

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000
const iso = (ms: number) => new Date(ms).toISOString()

export type BillingSeed = {
  plans: SubscriptionPlan[]
  subscriptions: CompanySubscription[]
  creditAccounts: CreditAccount[]
  creditTransactions: CreditTransaction[]
  payments: PaymentTransaction[]
}

type Row = Omit<CreditTransaction, 'id' | 'companyId' | 'refunded'> & { refunded?: boolean }

/**
 * Dựng phần gói cước của kho từ các lần chạy tối ưu của seed (đã dời giờ — `shiftSeedTimes`), nên mỗi lần chạy có **đúng một** giao
 * dịch dùng tại đúng giờ của nó; lần chạy không ra kết quả được hoàn. Kỳ hiện tại bao `now` dù mở app ở ngày nào (test neo seed ở
 * 14/09/2026 nhưng chạy bằng giờ máy), nên số dư của seed không đổi theo ngày chạy.
 */
export function seedBilling({ runs, trips, now }: { runs: readonly OptimizationRun[]; trips: readonly Trip[]; now: Date }): BillingSeed {
  const companyOf = new Map(trips.map((trip) => [trip.id, trip.companyId]))
  const nowMs = now.getTime()
  const seed: BillingSeed = { plans: SEED_PLANS.map((plan) => structuredClone(plan)), subscriptions: [], creditAccounts: [], creditTransactions: [], payments: [] }
  const references: string[] = []

  COMPANY_PLANS.forEach(({ companyId, planId, leadDays, earlierUsage }, index) => {
    const plan = SEED_PLANS.find((item) => item.id === planId) as SubscriptionPlan
    const companyRuns = runs.filter((run) => companyOf.get(run.tripId) === companyId).toSorted((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
    const firstRunMs = Math.min(Date.parse(companyRuns[0]?.at ?? iso(nowMs)), nowMs)
    const startedMs = firstRunMs - leadDays * DAY_MS
    const startedAt = iso(startedMs)
    const expiresMs = Math.max(startedMs + BILLING_CONSTANTS.periodDays * DAY_MS, nowMs + 15 * DAY_MS)
    const ordinal = String(index + 1).padStart(3, '0')
    const payment: PaymentTransaction = {
      id: `PAY-${ordinal}`, companyId, purpose: 'SUBSCRIBE', amountVnd: plan.priceVnd, status: 'SUCCESS', planId,
      credits: plan.monthlyCredits, createdAt: startedAt, updatedAt: startedAt,
    }
    seed.payments.push(payment)
    seed.subscriptions.push({ id: `SUB-${ordinal}`, companyId, planId, status: 'ACTIVE', startedAt, expiresAt: iso(expiresMs), autoRenew: true })

    const rows: Row[] = []
    if (plan.monthlyCredits !== null) rows.push({ type: 'MONTHLY_GRANT', amount: plan.monthlyCredits, reference: payment.id, createdAt: startedAt })
    const earlierEnd = firstRunMs - HOUR_MS
    for (let k = 1; k <= earlierUsage; k += 1) {
      const at = iso(startedMs + Math.round(((earlierEnd - startedMs) * k) / (earlierUsage + 1)))
      rows.push({ type: 'USAGE', amount: -1, reference: nextRunReference(references), usageStatus: 'DEDUCTED', createdAt: at })
    }
    for (const run of companyRuns) {
      const reference = nextRunReference(references)
      const failed = run.status === 'FAILED'
      rows.push({ type: 'USAGE', amount: -1, reference, usageStatus: failed ? 'REFUNDED' : 'DEDUCTED', refunded: failed, tripId: run.tripId, createdAt: run.at })
      if (failed) rows.push({ type: 'REFUND', amount: 1, reference, tripId: run.tripId, createdAt: run.at })
    }
    const sorted = rows.toSorted((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))
    for (const row of sorted) {
      seed.creditTransactions.push({ id: `CTX-${String(seed.creditTransactions.length + 1).padStart(4, '0')}`, companyId, ...row, refunded: row.refunded ?? false })
    }
    seed.creditAccounts.push({ id: `CA-${ordinal}`, companyId, balance: sorted.reduce((sum, row) => sum + row.amount, 0) })
  })
  return seed
}

/** Mã lần chạy kế tiếp (`JOB-NNN`), liền mạch trong seed; kho tiếp tục từ số lớn nhất (`nextId`). */
function nextRunReference(taken: string[]): string {
  const reference = nextId('JOB', taken)
  taken.push(reference)
  return reference
}
