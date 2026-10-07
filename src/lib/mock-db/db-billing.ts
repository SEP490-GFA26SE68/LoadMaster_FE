import type { Role } from '@/types/user'
import {
  BILLING_CONSTANTS,
  creditBlock,
  isUnlimited,
  optimizationCost,
  PLAN_TIERS,
  type CompanySubscription,
  type CreditAccount,
  type CreditTransaction,
  type CurrentSubscription,
  type PaymentPurpose,
  type PaymentTransaction,
  type SubscriptionPlan,
} from './billing-model'
import type { BillingDb } from './db-api-billing'
import { nextId, put, type DbContext } from './db-context'
import { MockDbError } from './errors'

const DAY_MS = 24 * 60 * 60 * 1000
const addDaysIso = (iso: string, days: number) => new Date(Date.parse(iso) + days * DAY_MS).toISOString()
/** `-0` không ra ngoài kho: lượt dùng của gói không giới hạn ghi đúng `0`. */
const negated = (amount: number) => (amount === 0 ? 0 : -amount)

/**
 * Trừ credit của một lần chạy đã giữ (`saveOptimizationRun` gọi khi lưu xong): giao dịch dùng `RESERVED` → `DEDUCTED`. Lần chạy phải
 * thuộc `companyId` của chuyến và còn đang giữ — đã hoàn, hoặc mã lạ, là `CREDIT_NOT_RESERVED`. Gọi **trước** khi ghi kết quả để lỗi
 * không để lại phương án chưa trả credit; trả hàm chốt.
 */
export function claimReservedCredit(ctx: DbContext, reference: string, companyId: string): () => void {
  const usage = ctx.scope.creditTransactions.list()
    .find((item) => item.type === 'USAGE' && item.reference === reference && item.companyId === companyId)
  if (usage?.usageStatus !== 'RESERVED') throw new MockDbError('CREDIT_NOT_RESERVED', { reference })
  return () => { usage.usageStatus = 'DEDUCTED' }
}

/**
 * Gói cước, credit và thanh toán (FE-8-01, FE-8-05; D-89, D-94). Sổ cái là nguồn của số dư: `appendTransaction` là nơi duy nhất đổi
 * `CreditAccount.balance`, nên số dư luôn bằng tổng sổ cái và không bao giờ âm. Vòng đời gói chạy lười theo đồng hồ của kho: mọi hàm
 * chạm tới công ty gọi `settle` trước (việc tới hạn mới được xử lý), như vị trí xe mô phỏng (`db-tracking.ts`).
 */
export function billingMethods(ctx: DbContext): BillingDb {
  const { plans, subscriptions, creditAccounts, creditTransactions, payments, users } = ctx.state
  const companyTarget = (companyId: string) => ({ type: 'company' as const, id: companyId })

  const sessionUser = () => (ctx.state.session.userId === null ? undefined : users.get(ctx.state.session.userId))

  /** Việc của một vai trò; kho không có phiên (test logic) thì không xét. */
  function assertRole(...roles: Role[]) {
    const user = sessionUser()
    if (user !== undefined && !roles.includes(user.role)) throw new MockDbError('ROLE_NOT_ALLOWED', { role: user.role })
  }

  const subscriptionOf = (companyId: string): CompanySubscription | undefined =>
    ctx.scope.subscriptions.list().find((item) => item.companyId === companyId)

  const planOf = (planId: string): SubscriptionPlan => ctx.scope.plans.read(planId)

  function currentOf(companyId: string): CurrentSubscription | null {
    const subscription = subscriptionOf(companyId)
    return subscription ? { subscription, plan: planOf(subscription.planId) } : null
  }

  function accountOf(companyId: string): CreditAccount {
    const existing = ctx.scope.creditAccounts.list().find((item) => item.companyId === companyId)
    if (existing) return existing
    const id = nextId('CA', creditAccounts.keys())
    creditAccounts.set(id, { id, companyId, balance: 0 })
    return creditAccounts.get(id) as CreditAccount
  }

  /** Thêm một dòng vào sổ cái và đổi số dư theo nó; số dư âm là `INSUFFICIENT_CREDITS` và không ghi gì. */
  function appendTransaction(
    companyId: string,
    entry: Pick<CreditTransaction, 'type' | 'amount' | 'reference'> & Partial<Pick<CreditTransaction, 'usageStatus' | 'tripId'>>,
  ): CreditTransaction {
    const account = accountOf(companyId)
    const balance = account.balance + entry.amount
    if (balance < 0) throw new MockDbError('INSUFFICIENT_CREDITS', { balance: account.balance })
    account.balance = balance
    return put(creditTransactions, {
      id: nextId('CTX', creditTransactions.keys(), 4), companyId, refunded: false, createdAt: ctx.nowIso(), ...entry,
    })
  }

  function createPayment(
    companyId: string,
    purpose: PaymentPurpose,
    fields: Pick<PaymentTransaction, 'amountVnd'> & Partial<Pick<PaymentTransaction, 'planId' | 'credits' | 'periodEnd'>>,
    at = ctx.nowIso(),
  ): PaymentTransaction {
    return put(payments, { id: nextId('PAY', payments.keys()), companyId, purpose, status: 'PENDING', createdAt: at, updatedAt: at, ...fields })
  }

  const pendingOf = (companyId: string, ...purposes: PaymentPurpose[]) =>
    ctx.scope.payments.list().filter((item) => item.companyId === companyId && item.status === 'PENDING' && purposes.includes(item.purpose))

  function failPayment(payment: PaymentTransaction, at: string) {
    payment.status = 'FAILED'
    payment.updatedAt = at
  }

  /** Cấp credit của một kỳ đã trả; gói không giới hạn không cấp gì. */
  function grantMonthly(companyId: string, credits: number | null | undefined, reference: string) {
    if (credits === null || credits === undefined) return
    appendTransaction(companyId, { type: 'MONTHLY_GRANT', amount: credits, reference })
  }

  /**
   * Việc tới hạn của công ty theo đồng hồ của kho: tự gia hạn tạo thanh toán `PENDING` khi còn `renewalNoticeDays` ngày (một thanh
   * toán chờ cho mỗi kỳ; thanh toán đã thất bại thì tạo lại để trả lại được), và gói hết kỳ — chưa trả gia hạn, hoặc đã huỷ — thành
   * `EXPIRED`, thanh toán gia hạn còn chờ thành `FAILED`. Số dư credit giữ nguyên khi hết hạn (D-94).
   */
  function settle(companyId: string) {
    const subscription = subscriptionOf(companyId)
    if (subscription === undefined || subscription.status === 'EXPIRED') return
    const now = Date.parse(ctx.nowIso())
    const end = Date.parse(subscription.expiresAt)
    const plan = planOf(subscription.planId)
    const renewals = pendingOf(companyId, 'RENEWAL').filter((payment) => payment.periodEnd === subscription.expiresAt)
    if (now < end) {
      const noticeAt = end - BILLING_CONSTANTS.renewalNoticeDays * DAY_MS
      if (subscription.status === 'ACTIVE' && subscription.autoRenew && renewals.length === 0 && now >= noticeAt) {
        createPayment(companyId, 'RENEWAL', { amountVnd: plan.priceVnd, planId: plan.id, credits: plan.monthlyCredits, periodEnd: subscription.expiresAt }, new Date(noticeAt).toISOString())
      }
      return
    }
    subscription.status = 'EXPIRED'
    for (const payment of renewals) failPayment(payment, subscription.expiresAt)
    ctx.logSystem('subscription.expired', companyTarget(companyId), { plan: plan.name }, companyId)
  }

  /** Công ty của một lệnh dành cho quản trị công ty: công ty của phiên (nền tảng: `COMPANY_REQUIRED`), đã xử lý việc tới hạn. */
  function settledCompany(): string {
    const companyId = ctx.scope.newRecordCompany()
    settle(companyId)
    return companyId
  }

  function validatePlanPatch(patch: Parameters<BillingDb['updateSubscriptionPlan']>[1]) {
    const bad = (field: string) => new MockDbError('PLAN_INVALID', { field })
    if (patch.name !== undefined && patch.name.trim() === '') throw bad('name')
    if (patch.priceVnd !== undefined && (!Number.isInteger(patch.priceVnd) || patch.priceVnd < 0)) throw bad('priceVnd')
    if (patch.monthlyCredits !== undefined && patch.monthlyCredits !== null && (!Number.isInteger(patch.monthlyCredits) || patch.monthlyCredits <= 0)) throw bad('monthlyCredits')
  }

  /** Áp dụng một thanh toán thành công: kích hoạt gói, nối kỳ gia hạn hoặc cộng credit đã mua. */
  function applyPayment(payment: PaymentTransaction) {
    const { companyId } = payment
    if (payment.purpose === 'TOPUP') {
      appendTransaction(companyId, { type: 'PURCHASE', amount: payment.credits ?? 0, reference: payment.id })
      ctx.log('credit.purchased', companyTarget(companyId), { credits: payment.credits ?? 0 }, companyId)
      return
    }
    const existing = subscriptionOf(companyId)
    const plan = planOf(payment.planId ?? '')
    const now = ctx.nowIso()
    if (payment.purpose === 'RENEWAL') {
      if (existing?.status !== 'ACTIVE' || existing.expiresAt !== payment.periodEnd) {
        failPayment(payment, now)
        return
      }
      existing.expiresAt = addDaysIso(existing.expiresAt, BILLING_CONSTANTS.periodDays)
      grantMonthly(companyId, payment.credits, payment.id)
      ctx.log('subscription.renewed', companyTarget(companyId), { plan: plan.name }, companyId)
      return
    }
    if (existing !== undefined && existing.status !== 'EXPIRED') throw new MockDbError('SUBSCRIPTION_ACTIVE', { subscriptionId: existing.id })
    const next: CompanySubscription = {
      id: existing?.id ?? nextId('SUB', subscriptions.keys()), companyId, planId: plan.id, status: 'ACTIVE',
      startedAt: now, expiresAt: addDaysIso(now, BILLING_CONSTANTS.periodDays), autoRenew: true,
    }
    put(subscriptions, next)
    accountOf(companyId)
    grantMonthly(companyId, payment.credits, payment.id)
    ctx.log('subscription.subscribed', companyTarget(companyId), { plan: plan.name }, companyId)
  }

  return {
    listSubscriptionPlans: () =>
      ctx.respond(() => ctx.scope.plans.list().toSorted((a, b) => PLAN_TIERS.indexOf(a.tier) - PLAN_TIERS.indexOf(b.tier) || (a.id < b.id ? -1 : 1))),

    updateSubscriptionPlan: (planId, patch) =>
      ctx.respond(() => {
        const plan = ctx.scope.plans.read(planId)
        assertRole('systemManager')
        validatePlanPatch(patch)
        const next: SubscriptionPlan = {
          ...plan,
          ...(patch.name === undefined ? {} : { name: patch.name.trim() }),
          ...(patch.priceVnd === undefined ? {} : { priceVnd: patch.priceVnd }),
          ...(patch.monthlyCredits === undefined ? {} : { monthlyCredits: patch.monthlyCredits }),
          ...(patch.features === undefined ? {} : { features: [...patch.features] }),
          provisional: false,
        }
        put(plans, next)
        // Giá và credit mới áp dụng từ kỳ kế tiếp: thanh toán gia hạn đang chờ của các công ty dùng gói này là của kỳ kế tiếp
        const onPlan = new Set([...subscriptions.values()].filter((item) => item.planId === planId).map((item) => item.companyId))
        for (const payment of payments.values()) {
          if (payment.purpose === 'RENEWAL' && payment.status === 'PENDING' && onPlan.has(payment.companyId)) {
            payment.amountVnd = next.priceVnd
            payment.credits = next.monthlyCredits
          }
        }
        return next
      }),

    getCurrentSubscription: () => ctx.respond(() => currentOf(settledCompany())),

    subscribeToPlan: (planId) =>
      ctx.respond(() => {
        const companyId = settledCompany()
        assertRole('companyAdmin')
        const existing = subscriptionOf(companyId)
        if (existing !== undefined && existing.status !== 'EXPIRED') throw new MockDbError('SUBSCRIPTION_ACTIVE', { subscriptionId: existing.id })
        const plan = planOf(planId)
        if (!plan.active) throw new MockDbError('PLAN_INACTIVE', { planId })
        const now = ctx.nowIso()
        for (const earlier of pendingOf(companyId, 'SUBSCRIBE')) failPayment(earlier, now)
        return createPayment(companyId, 'SUBSCRIBE', { amountVnd: plan.priceVnd, planId, credits: plan.monthlyCredits })
      }),

    cancelSubscription: () =>
      ctx.respond(() => {
        const companyId = settledCompany()
        assertRole('companyAdmin')
        const subscription = subscriptionOf(companyId)
        if (subscription?.status !== 'ACTIVE') throw new MockDbError('SUBSCRIPTION_STATUS_INVALID', { status: subscription?.status ?? 'NONE' })
        const now = ctx.nowIso()
        subscription.status = 'CANCELLED'
        subscription.autoRenew = false
        subscription.cancelledAt = now
        for (const renewal of pendingOf(companyId, 'RENEWAL')) failPayment(renewal, now)
        ctx.log('subscription.cancelled', companyTarget(companyId), { plan: planOf(subscription.planId).name }, companyId)
        return subscription
      }),

    getCreditBalance: () =>
      ctx.respond(() => {
        const companyId = settledCompany()
        const current = currentOf(companyId)
        return { balance: accountOf(companyId).balance, unlimited: current !== null && current.subscription.status !== 'EXPIRED' && isUnlimited(current.plan) }
      }),

    listCreditTransactions: () =>
      ctx.respond(() => {
        const companyId = settledCompany()
        return ctx.scope.creditTransactions.list().filter((item) => item.companyId === companyId)
          .toReversed().toSorted((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
      }),

    topUpCredits: (credits) =>
      ctx.respond(() => {
        const companyId = settledCompany()
        assertRole('companyAdmin')
        if (!(BILLING_CONSTANTS.topUpPacks as readonly number[]).includes(credits)) throw new MockDbError('TOPUP_INVALID', { credits })
        return createPayment(companyId, 'TOPUP', { amountVnd: credits * BILLING_CONSTANTS.creditPriceVnd, credits })
      }),

    listPayments: () =>
      ctx.respond(() => {
        const companyId = settledCompany()
        return ctx.scope.payments.list().filter((item) => item.companyId === companyId)
          .toReversed().toSorted((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
      }),

    getPayment: (paymentId) =>
      ctx.respond(() => {
        const payment = ctx.scope.payments.read(paymentId)
        settle(payment.companyId)
        return payment
      }),

    settlePayment: (paymentId, outcome) =>
      ctx.respond(() => {
        const payment = ctx.scope.payments.own(paymentId)
        assertRole('companyAdmin')
        settle(payment.companyId)
        // Xử lý một lần theo mã giao dịch: bấm lại, mở lại trang, hay cổng gọi hai lần đều không cộng lần hai
        if (payment.status !== 'PENDING') return payment
        if (outcome === 'FAILED') failPayment(payment, ctx.nowIso())
        else {
          applyPayment(payment)
          if (payment.status === 'PENDING') {
            payment.status = 'SUCCESS'
            payment.updatedAt = ctx.nowIso()
          }
        }
        return payment
      }),

    reserveOptimizationCredit: (tripId) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.own(tripId)
        const { companyId } = trip
        settle(companyId)
        const current = currentOf(companyId)
        const { balance } = accountOf(companyId)
        const block = creditBlock(current, balance)
        if (block === 'SUBSCRIPTION_EXPIRED') throw new MockDbError(block, { expiredAt: current?.subscription.expiresAt ?? null })
        if (block === 'INSUFFICIENT_CREDITS') throw new MockDbError(block, { balance })
        const cost = optimizationCost((current as CurrentSubscription).plan)
        const reference = nextId('JOB', [...creditTransactions.values()].map((item) => item.reference), 3)
        appendTransaction(companyId, { type: 'USAGE', amount: negated(cost), reference, usageStatus: 'RESERVED', tripId })
        // Số dư từ ngưỡng trở xuống thì báo quản trị công ty (đề xuất `lowCreditThreshold`); gói không giới hạn không bao giờ hết
        if (cost > 0 && balance - cost <= BILLING_CONSTANTS.lowCreditThreshold) {
          ctx.logSystem('credit.lowBalance', companyTarget(companyId), { balance: balance - cost }, companyId)
        }
        return { reference, cost }
      }),

    refundOptimizationCredit: (reference) =>
      ctx.respond(() => {
        const usage = ctx.scope.creditTransactions.list().find((item) => item.type === 'USAGE' && item.reference === reference)
        if (usage === undefined) throw new MockDbError('NOT_FOUND', { collection: 'creditTransactions', id: reference })
        // Hoàn đúng một lần theo tham chiếu
        if (usage.usageStatus === 'REFUNDED') return
        usage.usageStatus = 'REFUNDED'
        usage.refunded = true
        appendTransaction(usage.companyId, { type: 'REFUND', amount: Math.abs(usage.amount), reference, ...(usage.tripId === undefined ? {} : { tripId: usage.tripId }) })
      }),
  }
}
