import { describe, expect, test } from 'vitest'
import { BILLING_CONSTANTS, createMockDb, type MockDb } from '@/lib/mock-db'
import { runMockCandidates } from '@/services/optimization'

/**
 * Gói cước, sổ cái credit, thanh toán và vòng đời gói theo đồng hồ của kho (FE-8-01, FE-8-05; D-89, D-94). Đồng hồ là một biến test
 * đặt tay: kho không có hẹn giờ, việc tới hạn được xử lý khi có người đọc.
 *
 * Seed: Long Bình dùng gói Pro (500 credit, 15 lần chạy → 14 lượt dùng thật cộng một lần hỏng đã hoàn: 486), Phương Nam dùng gói Basic
 * (100 credit, đã dùng gần hết: 97 lượt cũ hơn seed cộng lần chạy của `TRIP-PN-001`: còn 2).
 */

const T0 = new Date('2026-09-14T05:00:00.000Z')
const DAY_MS = 24 * 60 * 60 * 1000
const LONG_BINH_ADMIN = 'US-LB-01'
const LONG_BINH_DISPATCHER = 'US-0001'
const PHUONG_NAM_ADMIN = 'US-PN-01'
const PHUONG_NAM_DISPATCHER = 'US-PN-03'
const PLATFORM_MANAGER = 'US-NT-01'
const BASIC = 'PLAN-001'
const PRO = 'PLAN-002'
const ULTIMATE = 'PLAN-003'

function open(user: string) {
  const clock = { at: T0 }
  const db = createMockDb({ now: () => clock.at })
  db.restoreSession(user)
  return {
    db,
    /** Đặt đồng hồ của kho: `iso` cộng `offsetMs`. */
    jump: (iso: string, offsetMs = 0) => { clock.at = new Date(Date.parse(iso) + offsetMs) },
  }
}

type Session = ReturnType<typeof open>

const balanceOf = async (db: MockDb) => (await db.getCreditBalance()).balance
const expiryOf = async (db: MockDb) => (await db.getCurrentSubscription())?.subscription.expiresAt ?? ''

/** Hết kỳ hiện tại, rồi Quản trị công ty mua `planId` và trả thành công: gói mới đang hoạt động. */
async function switchPlan({ db, jump }: Session, adminId: string, planId: string) {
  db.restoreSession(adminId)
  await db.cancelSubscription()
  jump(await expiryOf(db))
  const payment = await db.subscribeToPlan(planId)
  await db.settlePayment(payment.id, 'SUCCESS')
}

/** Lưu một lần chạy ba phương án cho `TRIP-012` của Long Bình, kèm mã đã giữ credit (nếu có). */
async function saveRun(db: MockDb, creditReference?: string) {
  const trip = await db.getTrip('TRIP-012')
  const request = { vehicle: await db.getVehicle(trip.vehicleId), packages: trip.packages, settings: (await db.getRevision('REV-025')).request.settings }
  const job = runMockCandidates(request, { clock: () => 0 })
  return db.saveOptimizationRun({ tripId: trip.id, request, jobId: job.jobId, plans: job.plans, ...(creditReference === undefined ? {} : { creditReference }) })
}

async function ledgerOf(db: MockDb, userId: string) {
  db.restoreSession(userId)
  return db.listCreditTransactions()
}

describe('ledger and seed', () => {
  test.each([
    { user: LONG_BINH_ADMIN, balance: 486, rows: 17, usages: 15, plan: 'Pro' },
    { user: PHUONG_NAM_ADMIN, balance: 2, rows: 99, usages: 98, plan: 'Basic' },
  ])('$plan company: balance is the sum of the ledger and never went below zero ($balance)', async ({ user, balance, rows, usages }) => {
    const { db } = open(user)
    const ledger = await db.listCreditTransactions()
    expect(await balanceOf(db)).toBe(balance)
    expect(ledger).toHaveLength(rows)
    expect(ledger.filter((entry) => entry.type === 'USAGE')).toHaveLength(usages)
    expect(ledger.reduce((sum, entry) => sum + entry.amount, 0)).toBe(balance)
    // Cũ trước: số dư chạy qua từng giao dịch không bao giờ âm
    let running = 0
    for (const entry of ledger.toReversed()) {
      running += entry.amount
      expect(running).toBeGreaterThanOrEqual(0)
    }
  })

  test('every seeded run has exactly one usage at its own time; a failed run was refunded once', async () => {
    const { db } = open(LONG_BINH_ADMIN)
    db.restoreSession(null)
    const runs = (await Promise.all((await db.listTrips()).map((trip) => db.listOptimizationRuns(trip.id)))).flat()
    const ledger = [...(await ledgerOf(db, LONG_BINH_ADMIN)), ...(await ledgerOf(db, PHUONG_NAM_ADMIN))]
    expect(runs).toHaveLength(16)
    for (const run of runs) {
      const usages = ledger.filter((entry) => entry.type === 'USAGE' && entry.tripId === run.tripId && entry.createdAt === run.at)
      expect(usages, run.id).toHaveLength(1)
      const refunds = ledger.filter((entry) => entry.type === 'REFUND' && entry.reference === usages[0]?.reference)
      expect(refunds, run.id).toHaveLength(run.status === 'FAILED' ? 1 : 0)
      expect(usages[0]).toMatchObject({ usageStatus: run.status === 'FAILED' ? 'REFUNDED' : 'DEDUCTED', refunded: run.status === 'FAILED' })
    }
  })
})

describe('plan lifecycle on the store clock', () => {
  test('a company with a plan in effect cannot subscribe; cancelling keeps the plan to the end of the period; then it expires and can subscribe', async () => {
    const session = open(PHUONG_NAM_ADMIN)
    const { db, jump } = session
    await expect(db.subscribeToPlan(PRO)).rejects.toMatchObject({ code: 'SUBSCRIPTION_ACTIVE' })
    const before = await expiryOf(db)

    const cancelled = await db.cancelSubscription()
    expect(cancelled).toMatchObject({ status: 'CANCELLED', autoRenew: false, expiresAt: before })
    await expect(db.cancelSubscription()).rejects.toMatchObject({ code: 'SUBSCRIPTION_STATUS_INVALID' })
    // Còn hiệu lực tới hết kỳ: vẫn chạy được, vẫn chưa đăng ký lại được
    jump(before, -1000)
    await expect(db.subscribeToPlan(PRO)).rejects.toMatchObject({ code: 'SUBSCRIPTION_ACTIVE' })
    db.restoreSession(PHUONG_NAM_DISPATCHER)
    await expect(db.reserveOptimizationCredit('TRIP-PN-001')).resolves.toMatchObject({ cost: 1 })
    db.restoreSession(PHUONG_NAM_ADMIN)

    jump(before)
    expect((await db.getCurrentSubscription())?.subscription.status).toBe('EXPIRED')
    // Số dư giữ nguyên khi hết hạn (đã giữ một credit ở trên)
    expect(await balanceOf(db)).toBe(1)

    // Đăng ký: chỉ tạo thanh toán chờ; trả xong mới kích hoạt gói và cấp credit tháng
    const payment = await db.subscribeToPlan(PRO)
    expect(payment).toMatchObject({ purpose: 'SUBSCRIBE', status: 'PENDING', amountVnd: 1_490_000, planId: PRO, credits: 500 })
    expect((await db.getCurrentSubscription())?.subscription.status).toBe('EXPIRED')
    const paid = await db.settlePayment(payment.id, 'SUCCESS')
    expect(paid.status).toBe('SUCCESS')
    const current = await db.getCurrentSubscription()
    expect(current?.subscription).toMatchObject({ status: 'ACTIVE', planId: PRO, autoRenew: true, startedAt: before })
    expect(Date.parse(current?.subscription.expiresAt ?? '') - Date.parse(before)).toBe(BILLING_CONSTANTS.periodDays * DAY_MS)
    expect(await balanceOf(db)).toBe(501)
    // Xử lý một lần: thanh toán đã xong, gọi lại (kể cả với kết quả khác) không cộng lần hai
    await db.settlePayment(payment.id, 'SUCCESS')
    await db.settlePayment(payment.id, 'FAILED')
    expect(await balanceOf(db)).toBe(501)
    expect((await db.listPayments())[0]).toMatchObject({ id: payment.id, status: 'SUCCESS' })
    expect((await db.listCreditTransactions()).filter((entry) => entry.type === 'MONTHLY_GRANT' && entry.reference === payment.id)).toHaveLength(1)
  })

  test('auto-renew makes one pending payment before the end; paying extends the period by 30 days and grants the monthly credits', async () => {
    const { db, jump } = open(PHUONG_NAM_ADMIN)
    const end = await expiryOf(db)
    jump(end, -(BILLING_CONSTANTS.renewalNoticeDays * DAY_MS + 1000))
    expect(await db.listPayments()).toHaveLength(1)

    jump(end, -BILLING_CONSTANTS.renewalNoticeDays * DAY_MS)
    const [renewal] = await db.listPayments()
    expect(renewal).toMatchObject({ purpose: 'RENEWAL', status: 'PENDING', amountVnd: 490_000, credits: 100, periodEnd: end })
    expect(await db.listPayments()).toHaveLength(2)

    await db.settlePayment(renewal?.id ?? '', 'SUCCESS')
    expect(await expiryOf(db)).toBe(new Date(Date.parse(end) + BILLING_CONSTANTS.periodDays * DAY_MS).toISOString())
    expect(await balanceOf(db)).toBe(102)
    expect((await db.listEvents())[0]).toMatchObject({ action: 'subscription.renewed', companyId: 'LOG-002' })
  })

  test('a renewal left unpaid expires the plan at the end of the period: payment failed, credits kept, nothing granted', async () => {
    const { db, jump } = open(PHUONG_NAM_ADMIN)
    const end = await expiryOf(db)
    jump(end, -DAY_MS)
    expect((await db.listPayments())[0]).toMatchObject({ purpose: 'RENEWAL', status: 'PENDING' })
    jump(end)
    expect((await db.getCurrentSubscription())?.subscription.status).toBe('EXPIRED')
    expect((await db.listPayments())[0]).toMatchObject({ purpose: 'RENEWAL', status: 'FAILED' })
    expect(await balanceOf(db)).toBe(2)
    expect((await db.listEvents())[0]).toMatchObject({ action: 'subscription.expired', actorId: null, companyId: 'LOG-002' })
  })

  test('cancelling with a renewal waiting fails that payment and the plan simply ends', async () => {
    const { db, jump } = open(PHUONG_NAM_ADMIN)
    const end = await expiryOf(db)
    jump(end, -DAY_MS)
    await db.cancelSubscription()
    expect((await db.listPayments())[0]).toMatchObject({ purpose: 'RENEWAL', status: 'FAILED' })
    jump(end, -1000)
    expect(await db.listPayments()).toHaveLength(2)
    expect((await db.getCurrentSubscription())?.subscription.status).toBe('CANCELLED')
  })

  test('a top-up takes the 50 or 500 packs only, 1.000 đ a credit; a failed payment changes nothing, a paid one adds the credits once', async () => {
    const { db } = open(PHUONG_NAM_ADMIN)
    await expect(db.topUpCredits(75)).rejects.toMatchObject({ code: 'TOPUP_INVALID' })
    const failed = await db.topUpCredits(50)
    expect(failed).toMatchObject({ purpose: 'TOPUP', status: 'PENDING', amountVnd: 50_000, credits: 50 })
    await db.settlePayment(failed.id, 'FAILED')
    expect(await balanceOf(db)).toBe(2)
    const paid = await db.topUpCredits(500)
    expect(paid.amountVnd).toBe(500_000)
    await db.settlePayment(paid.id, 'SUCCESS')
    await db.settlePayment(paid.id, 'SUCCESS')
    expect(await balanceOf(db)).toBe(502)
    expect((await db.listCreditTransactions())[0]).toMatchObject({ type: 'PURCHASE', amount: 500, reference: paid.id })
  })

  test('a new price and monthly credits reach a company only from its next period; the plan stops being provisional once edited', async () => {
    const { db, jump } = open(PHUONG_NAM_ADMIN)
    const end = await expiryOf(db)
    db.restoreSession(PLATFORM_MANAGER)
    const edited = await db.updateSubscriptionPlan(BASIC, { priceVnd: 590_000, monthlyCredits: 120 })
    expect(edited).toMatchObject({ priceVnd: 590_000, monthlyCredits: 120, provisional: false })
    expect((await db.listSubscriptionPlans()).map((plan) => [plan.tier, plan.provisional])).toStrictEqual([['BASIC', false], ['PRO', true], ['ULTIMATE', true]])

    // Kỳ đang chạy giữ nguyên: số dư và hạn không đổi; kỳ kế tiếp mang giá và credit mới
    db.restoreSession(PHUONG_NAM_ADMIN)
    expect(await balanceOf(db)).toBe(2)
    jump(end, -DAY_MS)
    const [renewal] = await db.listPayments()
    expect(renewal).toMatchObject({ amountVnd: 590_000, credits: 120 })
    // Sửa tiếp trong lúc thanh toán gia hạn đang chờ: thanh toán đó là của kỳ kế tiếp nên đổi theo
    db.restoreSession(PLATFORM_MANAGER)
    await db.updateSubscriptionPlan(BASIC, { priceVnd: 600_000, monthlyCredits: 130 })
    db.restoreSession(PHUONG_NAM_ADMIN)
    expect((await db.listPayments())[0]).toMatchObject({ amountVnd: 600_000, credits: 130 })
    await db.settlePayment(renewal?.id ?? '', 'SUCCESS')
    expect(await balanceOf(db)).toBe(132)
  })

  test.each([
    { what: 'a bad price', patch: { priceVnd: -1 }, field: 'priceVnd' },
    { what: 'a fractional price', patch: { priceVnd: 99.5 }, field: 'priceVnd' },
    { what: 'zero monthly credits', patch: { monthlyCredits: 0 }, field: 'monthlyCredits' },
    { what: 'an empty name', patch: { name: '  ' }, field: 'name' },
  ])('updating a plan with $what is PLAN_INVALID', async ({ patch, field }) => {
    const { db } = open(PLATFORM_MANAGER)
    await expect(db.updateSubscriptionPlan(BASIC, patch)).rejects.toMatchObject({ code: 'PLAN_INVALID', params: { field } })
  })

  test('roles: only the company admin buys, cancels, tops up and settles; only the platform manager edits plans; the platform has no company', async () => {
    const { db } = open(PHUONG_NAM_ADMIN)
    const pending = await db.topUpCredits(50)
    db.restoreSession(PHUONG_NAM_DISPATCHER)
    for (const call of [() => db.subscribeToPlan(PRO), () => db.cancelSubscription(), () => db.topUpCredits(50), () => db.settlePayment(pending.id, 'SUCCESS')]) {
      await expect(call()).rejects.toMatchObject({ code: 'ROLE_NOT_ALLOWED' })
    }
    await expect(db.updateSubscriptionPlan(BASIC, { priceVnd: 1 })).rejects.toMatchObject({ code: 'ROLE_NOT_ALLOWED' })
    db.restoreSession(PLATFORM_MANAGER)
    for (const call of [() => db.getCreditBalance(), () => db.getCurrentSubscription(), () => db.listPayments()]) {
      await expect(call()).rejects.toMatchObject({ code: 'COMPANY_REQUIRED' })
    }
    expect((await db.listSubscriptionPlans()).map((plan) => plan.name)).toStrictEqual(['Basic', 'Pro', 'Ultimate'])
  })
})

describe('credit of an optimization run', () => {
  test('one run costs one credit however many plans it saves: reserved, then deducted when saved', async () => {
    const { db } = open(LONG_BINH_DISPATCHER)
    const { reference, cost } = await db.reserveOptimizationCredit('TRIP-012')
    expect(cost).toBe(1)
    expect(await balanceOf(db)).toBe(485)
    expect((await db.listCreditTransactions())[0]).toMatchObject({ type: 'USAGE', amount: -1, reference, usageStatus: 'RESERVED', tripId: 'TRIP-012' })

    const { revisions } = await saveRun(db, reference)
    expect(revisions).toHaveLength(3)
    expect(await balanceOf(db)).toBe(485)
    expect((await db.listCreditTransactions()).slice(0, 2)).toMatchObject([{ reference, usageStatus: 'DEDUCTED', refunded: false }, { type: 'USAGE', reference: 'JOB-015' }])
    expect((await db.listCreditTransactions())).toHaveLength(18)
  })

  test('a failed or cancelled run is refunded exactly once: one usage and one refund, however often the refund is asked for', async () => {
    const { db } = open(LONG_BINH_DISPATCHER)
    const { reference } = await db.reserveOptimizationCredit('TRIP-012')
    await db.refundOptimizationCredit(reference)
    await db.refundOptimizationCredit(reference)
    expect(await balanceOf(db)).toBe(486)
    const entries = (await db.listCreditTransactions()).filter((entry) => entry.reference === reference)
    expect(entries.map((entry) => [entry.type, entry.amount, entry.usageStatus, entry.refunded])).toStrictEqual([
      ['REFUND', 1, undefined, false],
      ['USAGE', -1, 'REFUNDED', true],
    ])
    await expect(db.refundOptimizationCredit('JOB-999')).rejects.toMatchObject({ code: 'NOT_FOUND' })
    // Đã hoàn thì không lưu kết quả được nữa: không có lần chạy nào miễn phí
    const revisions = (await db.listRevisions('TRIP-012')).length
    await expect(saveRun(db, reference)).rejects.toMatchObject({ code: 'CREDIT_NOT_RESERVED' })
    expect((await db.listRevisions('TRIP-012')).length).toBe(revisions)
  })

  // Ba lối lách credit kho phải tự chặn — giao diện bị bỏ qua cũng không chạy miễn phí được
  test('a run already saved cannot be refunded: its credit stays spent', async () => {
    const { db } = open(LONG_BINH_DISPATCHER)
    const { reference } = await db.reserveOptimizationCredit('TRIP-012')
    await saveRun(db, reference)
    await expect(db.refundOptimizationCredit(reference)).rejects.toMatchObject({ code: 'CREDIT_NOT_RESERVED' })
    expect(await balanceOf(db)).toBe(485)
    expect((await db.listCreditTransactions()).filter((entry) => entry.reference === reference).map((entry) => [entry.type, entry.usageStatus])).toStrictEqual([['USAGE', 'DEDUCTED']])
  })

  test('a signed-in session that saves a run without a reserved credit is charged by the store; with none left nothing is saved', async () => {
    const { db } = open(LONG_BINH_DISPATCHER)
    await saveRun(db)
    expect(await balanceOf(db)).toBe(485)
    expect((await db.listCreditTransactions())[0]).toMatchObject({ type: 'USAGE', amount: -1, usageStatus: 'DEDUCTED', tripId: 'TRIP-012' })

    const empty = open(PHUONG_NAM_DISPATCHER).db
    await empty.reserveOptimizationCredit('TRIP-PN-001')
    await empty.reserveOptimizationCredit('TRIP-PN-001')
    const trip = await empty.getTrip('TRIP-PN-001')
    const [approved] = await empty.listRevisions(trip.id)
    if (!approved) throw new Error('seed phải có phương án của TRIP-PN-001')
    const revisions = (await empty.listRevisions(trip.id)).length
    const job = runMockCandidates(approved.request, { clock: () => 0 })
    await expect(empty.saveOptimizationRun({ tripId: trip.id, request: approved.request, jobId: job.jobId, plans: job.plans })).rejects.toMatchObject({ code: 'INSUFFICIENT_CREDITS' })
    expect((await empty.listRevisions(trip.id)).length).toBe(revisions)
  })

  test('only the dispatcher holds and returns the credit of a run', async () => {
    const { db } = open(LONG_BINH_DISPATCHER)
    const { reference } = await db.reserveOptimizationCredit('TRIP-012')
    db.restoreSession(LONG_BINH_ADMIN)
    await expect(db.reserveOptimizationCredit('TRIP-012')).rejects.toMatchObject({ code: 'ROLE_NOT_ALLOWED' })
    await expect(db.refundOptimizationCredit(reference)).rejects.toMatchObject({ code: 'ROLE_NOT_ALLOWED' })
    expect(await balanceOf(db)).toBe(485)
  })

  test('with no credit left the run is refused and nothing is written; running low tells the company admin', async () => {
    const { db } = open(PHUONG_NAM_DISPATCHER)
    await db.reserveOptimizationCredit('TRIP-PN-001')
    await db.reserveOptimizationCredit('TRIP-PN-001')
    const rows = (await db.listCreditTransactions()).length
    await expect(db.reserveOptimizationCredit('TRIP-PN-001')).rejects.toMatchObject({ code: 'INSUFFICIENT_CREDITS', params: { balance: 0 } })
    expect(await balanceOf(db)).toBe(0)
    expect(await db.listCreditTransactions()).toHaveLength(rows)
    const lowBalance = (await db.listEvents()).filter((event) => event.action === 'credit.lowBalance')
    expect(lowBalance.map((event) => [event.actorId, event.companyId, event.params.balance])).toStrictEqual([[null, 'LOG-002', 0], [null, 'LOG-002', 1]])
  })

  test('an expired plan blocks the run before the balance is looked at, and leaves the balance as it was', async () => {
    const { db, jump } = open(LONG_BINH_ADMIN)
    await db.cancelSubscription()
    jump(await expiryOf(db))
    db.restoreSession(LONG_BINH_DISPATCHER)
    await expect(db.reserveOptimizationCredit('TRIP-012')).rejects.toMatchObject({ code: 'SUBSCRIPTION_EXPIRED' })
    expect(await balanceOf(db)).toBe(486)
    expect(await db.listCreditTransactions()).toHaveLength(17)
  })

  test('the unlimited plan records 0 credits for a run and for its refund, and reports an unlimited balance', async () => {
    const session = open(PHUONG_NAM_DISPATCHER)
    const { db } = session
    await switchPlan(session, PHUONG_NAM_ADMIN, ULTIMATE)
    db.restoreSession(PHUONG_NAM_DISPATCHER)
    expect(await db.getCreditBalance()).toStrictEqual({ balance: 2, unlimited: true })
    const { reference, cost } = await db.reserveOptimizationCredit('TRIP-PN-001')
    expect(cost).toBe(0)
    await db.refundOptimizationCredit(reference)
    const entries = (await db.listCreditTransactions()).filter((entry) => entry.reference === reference)
    expect(entries.map((entry) => [entry.type, Object.is(entry.amount, 0)])).toStrictEqual([['REFUND', true], ['USAGE', true]])
    expect(await balanceOf(db)).toBe(2)
    expect((await db.listEvents()).filter((event) => event.action === 'credit.lowBalance')).toHaveLength(0)
  })

  test('route optimization and finding another route cost nothing', async () => {
    const { db } = open(LONG_BINH_DISPATCHER)
    await db.optimizeTripRoute('TRIP-012')
    await db.requestReroute('TRIP-009')
    expect(await balanceOf(db)).toBe(486)
    expect(await db.listCreditTransactions()).toHaveLength(17)
  })
})
