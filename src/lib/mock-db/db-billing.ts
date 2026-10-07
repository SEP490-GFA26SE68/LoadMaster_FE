import {
  BILLING_CONSTANTS,
  creditBlock,
  isUnlimited,
  optimizationCost,
  PLAN_TIERS,
  type CreditTransaction,
  type CurrentSubscription,
  type SubscriptionPlan,
} from './billing-model'
import { billingCore } from './billing-core'
import type { BillingDb } from './db-api-billing'
import { nextId, put, type DbContext } from './db-context'
import { MockDbError } from './errors'

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
 * Giữ credit cho một lần chạy tối ưu của chuyến: gói hết hạn hoặc hết credit thì từ chối và không ghi gì; không thì ghi lượt dùng
 * `RESERVED` (số dư giảm ngay) và báo quản trị công ty khi số dư xuống tới ngưỡng. Một chỗ cho `reserveOptimizationCredit` và cho lần
 * lưu không kèm mã giữ (`runCredit`).
 */
function reserveCredit(ctx: DbContext, trip: { id: string; companyId: string }): { reference: string; cost: number } {
  const { companyTarget, currentOf, accountOf, appendTransaction, settle } = billingCore(ctx)
  const { companyId } = trip
  settle(companyId)
  const current = currentOf(companyId)
  const { balance } = accountOf(companyId)
  const block = creditBlock(current, balance)
  if (block === 'SUBSCRIPTION_EXPIRED') throw new MockDbError(block, { expiredAt: current?.subscription.expiresAt ?? null })
  if (block === 'INSUFFICIENT_CREDITS') throw new MockDbError(block, { balance })
  const cost = optimizationCost((current as CurrentSubscription).plan)
  const reference = nextId('JOB', [...ctx.state.creditTransactions.values()].map((item) => item.reference), 3)
  appendTransaction(companyId, { type: 'USAGE', amount: negated(cost), reference, usageStatus: 'RESERVED', tripId: trip.id })
  // Số dư từ ngưỡng trở xuống thì báo quản trị công ty (đề xuất `lowCreditThreshold`); gói không giới hạn không bao giờ hết
  if (cost > 0 && balance - cost <= BILLING_CONSTANTS.lowCreditThreshold) {
    ctx.logSystem('credit.lowBalance', companyTarget(companyId), { balance: balance - cost }, companyId)
  }
  return { reference, cost }
}

/** Hoàn lượt dùng còn đang giữ: `RESERVED` → `REFUNDED` kèm một dòng hoàn. Lượt đã trừ hẳn không hoàn được. */
function refundReserved(ctx: DbContext, usage: CreditTransaction): void {
  usage.usageStatus = 'REFUNDED'
  usage.refunded = true
  billingCore(ctx).appendTransaction(usage.companyId, { type: 'REFUND', amount: Math.abs(usage.amount), reference: usage.reference, ...(usage.tripId === undefined ? {} : { tripId: usage.tripId }) })
}

/**
 * Credit của một lần lưu kết quả tối ưu (`saveOptimizationRun`, `addRevision`) — **kho tự tính, không tin nơi gọi**: có mã giữ thì lượt
 * đó phải còn `RESERVED`; không có mã giữ mà kho đang có phiên đăng nhập thì kho giữ ngay tại đây (hết credit hay gói hết hạn là từ chối).
 * Chỉ kho không có phiên (dựng seed, test logic kho) mới lưu không tính credit. `deduct` gọi khi đã ghi xong, `rollback` khi ghi lỗi —
 * chỉ hoàn lượt kho tự giữ, lượt nơi gọi giữ thì nơi gọi hoàn.
 */
export function runCredit(ctx: DbContext, trip: { id: string; companyId: string }, reference?: string): { deduct: () => void; rollback: () => void } {
  if (reference !== undefined) return { deduct: claimReservedCredit(ctx, reference, trip.companyId), rollback: () => {} }
  if (ctx.state.session.userId === null) return { deduct: () => {}, rollback: () => {} }
  const own = reserveCredit(ctx, trip).reference
  const usage = ctx.scope.creditTransactions.list().find((item) => item.type === 'USAGE' && item.reference === own)
  return {
    deduct: claimReservedCredit(ctx, own, trip.companyId),
    rollback: () => { if (usage?.usageStatus === 'RESERVED') refundReserved(ctx, usage) },
  }
}

/**
 * Hàm công khai của kho gói cước, credit và thanh toán (FE-8-01, FE-8-05; D-89, D-94). Sổ cái, thanh toán và vòng đời gói chạy lười theo
 * đồng hồ của kho nằm ở `billing-core.ts`: mọi hàm chạm tới công ty gọi `settle` trước (việc tới hạn mới được xử lý), như vị trí xe mô
 * phỏng (`db-tracking.ts`).
 */
export function billingMethods(ctx: DbContext): BillingDb {
  const { plans, subscriptions, payments } = ctx.state
  const {
    companyTarget, assertRole, subscriptionOf, planOf, currentOf, accountOf, createPayment, pendingOf, failPayment, settle,
    settledCompany, applyPayment,
  } = billingCore(ctx)

  function validatePlanPatch(patch: Parameters<BillingDb['updateSubscriptionPlan']>[1]) {
    const bad = (field: string) => new MockDbError('PLAN_INVALID', { field })
    if (patch.name !== undefined && patch.name.trim() === '') throw bad('name')
    if (patch.priceVnd !== undefined && (!Number.isInteger(patch.priceVnd) || patch.priceVnd < 0)) throw bad('priceVnd')
    if (patch.monthlyCredits !== undefined && patch.monthlyCredits !== null && (!Number.isInteger(patch.monthlyCredits) || patch.monthlyCredits <= 0)) throw bad('monthlyCredits')
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

    // Chỉ người chạy tối ưu (điều phối viên) giữ và hoàn credit của một lần chạy
    reserveOptimizationCredit: (tripId) =>
      ctx.respond(() => {
        const trip = ctx.scope.trips.own(tripId)
        assertRole('dispatcher')
        return reserveCredit(ctx, trip)
      }),

    refundOptimizationCredit: (reference) =>
      ctx.respond(() => {
        const usage = ctx.scope.creditTransactions.list().find((item) => item.type === 'USAGE' && item.reference === reference)
        if (usage === undefined) throw new MockDbError('NOT_FOUND', { collection: 'creditTransactions', id: reference })
        assertRole('dispatcher')
        // Hoàn đúng một lần theo tham chiếu; lượt đã trừ hẳn (lần chạy đã lưu) không hoàn được — nếu không, chạy xong gọi hoàn là chạy miễn phí
        if (usage.usageStatus === 'REFUNDED') return
        if (usage.usageStatus !== 'RESERVED') throw new MockDbError('CREDIT_NOT_RESERVED', { reference })
        refundReserved(ctx, usage)
      }),
  }
}
