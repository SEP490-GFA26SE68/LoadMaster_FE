import type { Role } from '@/types/user'
import {
  BILLING_CONSTANTS,
  type CompanySubscription,
  type CreditAccount,
  type CreditTransaction,
  type CurrentSubscription,
  type PaymentPurpose,
  type PaymentTransaction,
  type SubscriptionPlan,
} from './billing-model'
import { nextId, put, type DbContext } from './db-context'
import { MockDbError } from './errors'

const DAY_MS = 24 * 60 * 60 * 1000
const addDaysIso = (iso: string, days: number) => new Date(Date.parse(iso) + days * DAY_MS).toISOString()

/**
 * Nền của kho gói cước (FE-8-01): sổ cái, thanh toán và việc tới hạn của vòng đời gói, chạy lười theo đồng hồ của kho. Sổ cái là nguồn của
 * số dư: `appendTransaction` là nơi duy nhất đổi `CreditAccount.balance`, nên số dư luôn bằng tổng sổ cái và không bao giờ âm. Các hàm công
 * khai của kho nằm ở `db-billing.ts`.
 */
export function billingCore(ctx: DbContext) {
  const { subscriptions, creditAccounts, creditTransactions, payments, users } = ctx.state
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
    companyTarget, assertRole, subscriptionOf, planOf, currentOf, accountOf, appendTransaction, createPayment, pendingOf, failPayment, settle,
    settledCompany, applyPayment,
  }
}
