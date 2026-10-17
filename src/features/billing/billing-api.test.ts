import { afterEach, expect, test, vi } from 'vitest'
import type { CurrentSubscriptionDto, PlanDto } from '@/lib/billing-backend-api'
import { envelope, failure, useFakeBackend } from '@/test/billing-backend-fetch'
import {
  BILLING_CAPABILITIES,
  cancelSubscription,
  getCreditBalance,
  getSubscriptionView,
  listCreditTransactions,
  listInvoices,
  listPlansOnSale,
  subscribe,
  topUpCredits,
} from './billing-api'

/**
 * Gói và credit của công ty nối backend (`usesBackend('billing')`): endpoint, thân gửi đi, DTO đổi sang kiểu của app. Giờ của backend là
 * giờ Việt Nam không kèm múi. Đồng hồ giả ở 17/10/2026 để gói hết hạn ngày 01/11 vẫn còn hiệu lực.
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['billing']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'billing',
}))

const backend = useFakeBackend()

afterEach(() => {
  vi.useRealTimers()
})

const PRO: PlanDto = {
  id: 2, planCode: 'PRO', name: 'Pro', priceVnd: 1490000, tier: 'PRO', monthlyCredits: 500, algorithmTier: 'EP_DBLF_GA',
  features: '["OPTIMIZATION_3D"]', billingCycle: 'MONTHLY', maxVehicles: 20, maxMonthlyJobs: 500, active: true, activeCompanyCount: 1,
}
const ACTIVE: CurrentSubscriptionDto = {
  subscriptionId: 1, planId: 2, planName: 'Pro', tier: 'PRO', status: 'ACTIVE', startedAt: '2026-10-01T08:00:00', expiresAt: '2026-11-01T08:00:00',
  autoRenew: true, creditsBalance: 1200, creditsMonthlyGrant: 500, algorithmTier: 'EP_DBLF_GA',
}
const NONE: CurrentSubscriptionDto = { ...ACTIVE, subscriptionId: null, planId: null, planName: null, tier: null, status: null, startedAt: null, expiresAt: null, autoRenew: null }

function freezeAt(iso: string) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(iso))
}

test('nguồn backend: hoá đơn thay lịch sử thanh toán, giá credit 5.000 đ, xác nhận ở trang của app', () => {
  expect(BILLING_CAPABILITIES).toStrictEqual({ payments: false, invoices: true, simulation: false, serverPayment: true, creditPriceVnd: 5000 })
})

test('gói đang dùng: đọc gói hiện tại rồi gói cước của nó, giờ Việt Nam đổi sang ISO', async () => {
  freezeAt('2026-10-17T03:00:00Z')
  backend.replies = [envelope(ACTIVE), PRO]
  const view = await getSubscriptionView()
  expect(backend.calls.map((call) => `${call.method} ${call.url} ${call.auth}`)).toStrictEqual([
    'GET http://be.test/api/subscription/current Bearer token-1',
    'GET http://be.test/api/subscription/plans/2 Bearer token-1',
  ])
  expect(view).toStrictEqual({
    lapsed: false,
    current: {
      subscription: { id: '1', companyId: '', planId: '2', status: 'ACTIVE', startedAt: '2026-10-01T01:00:00.000Z', expiresAt: '2026-11-01T01:00:00.000Z', autoRenew: true },
      plan: expect.objectContaining({ id: '2', name: 'Pro', tier: 'PRO', priceVnd: 1490000, monthlyCredits: 500, provisional: false }),
    },
  })
})

test('huỷ ở backend chỉ tắt tự gia hạn: ACTIVE tắt tự gia hạn là "đã huỷ — còn hiệu lực"; quá hạn mà backend chưa đổi là hết hạn', async () => {
  freezeAt('2026-10-17T03:00:00Z')
  backend.replies = [envelope({ ...ACTIVE, autoRenew: false }), PRO, envelope({ ...ACTIVE, expiresAt: '2026-10-17T09:00:00' }), PRO]
  expect((await getSubscriptionView()).current?.subscription.status).toBe('CANCELLED')
  expect((await getSubscriptionView()).current?.subscription.status).toBe('EXPIRED')
})

test('gói đã hết hạn chỉ còn trạng thái: không có gói, nói là đã hết hạn; chưa từng có gói thì không', async () => {
  backend.replies = [envelope({ ...NONE, status: 'EXPIRED' }), envelope(NONE)]
  expect(await getSubscriptionView()).toStrictEqual({ current: null, lapsed: true })
  expect(await getSubscriptionView()).toStrictEqual({ current: null, lapsed: false })
  expect(backend.calls).toHaveLength(2)
})

test('gói đang bán: danh sách của backend theo thứ tự hạng', async () => {
  backend.replies = [[{ ...PRO, id: 3, tier: 'ULTIMATE', name: 'Ultimate', monthlyCredits: null }, PRO]]
  expect((await listPlansOnSale()).map((plan) => [plan.id, plan.monthlyCredits])).toStrictEqual([['2', 500], ['3', null]])
})

test('đăng ký: gửi mã gói dạng số qua cổng MOCK, trang kế tiếp là trang xác nhận của app', async () => {
  backend.replies = [envelope({ id: 7, transactionId: 'MOCK_ABC123', paymentUrl: '/api/payment/mock-checkout?txnRef=MOCK_ABC123', status: 'PENDING' })]
  expect(await subscribe('1')).toStrictEqual({ kind: 'confirm', reference: 'MOCK_ABC123', purpose: 'SUBSCRIBE' })
  expect(backend.calls[0]).toMatchObject({ method: 'POST', url: 'http://be.test/api/subscription/subscribe', body: { planId: 1, gateway: 'MOCK' } })
})

test('đăng ký gói miễn phí: backend kích hoạt ngay; đang có gói (409) và gói không bán (404) thành mã nghiệp vụ', async () => {
  backend.replies = [envelope({ id: null, transactionId: null, paymentUrl: null, status: 'ACTIVE' }), failure(409), failure(404)]
  expect(await subscribe('4')).toStrictEqual({ kind: 'activated' })
  await expect(subscribe('2')).rejects.toMatchObject({ code: 'ACTIVE_SUBSCRIPTION_ALREADY_EXISTS', status: 409 })
  await expect(subscribe('9')).rejects.toMatchObject({ code: 'SUBSCRIPTION_PLAN_NOT_FOUND', status: 404 })
})

test('huỷ gói: POST rồi đọc lại gói để biết hạn; không có gói đang dùng (404) là NO_ACTIVE_SUBSCRIPTION', async () => {
  freezeAt('2026-10-17T03:00:00Z')
  backend.replies = [{ success: true, message: 'Subscription cancelled successfully' }, envelope({ ...ACTIVE, autoRenew: false }), PRO, failure(404)]
  expect(await cancelSubscription()).toMatchObject({ status: 'CANCELLED', expiresAt: '2026-11-01T01:00:00.000Z', autoRenew: false })
  expect(backend.calls.map((call) => `${call.method} ${call.url}`).slice(0, 2)).toStrictEqual([
    'POST http://be.test/api/subscription/cancel',
    'GET http://be.test/api/subscription/current',
  ])
  await expect(cancelSubscription()).rejects.toMatchObject({ code: 'NO_ACTIVE_SUBSCRIPTION' })
})

test('số dư: không giới hạn theo cờ của backend', async () => {
  backend.replies = [envelope({ companyId: 1, balance: 1200, isUnlimited: false }), envelope({ companyId: 3, balance: 0, isUnlimited: true })]
  expect(await getCreditBalance()).toStrictEqual({ balance: 1200, unlimited: false })
  expect(await getCreditBalance()).toStrictEqual({ balance: 0, unlimited: true })
})

test('sổ cái: đọc hết các trang, lượt dùng là "đã trừ" hoặc "đã hoàn", mới nhất trước', async () => {
  const page = (content: unknown[], last: boolean) => envelope({ content, last, number: last ? 1 : 0, totalPages: 2 })
  backend.replies = [
    page([{ id: 4, amount: 200, type: 'PURCHASE', reference: 'MOCK_X', refunded: false, createdAt: '2026-10-10T14:21:00' }], false),
    page([
      { id: 5, amount: -1, type: 'USAGE', reference: 'JOB-1', refunded: true, createdAt: '2026-10-12T09:00:00.123456' },
      { id: 1, amount: 500, type: 'MONTHLY_GRANT', reference: null, refunded: false, createdAt: '2026-10-01T07:55:00' },
    ], true),
  ]
  const rows = await listCreditTransactions()
  expect(backend.calls.map((call) => call.url)).toStrictEqual([
    'http://be.test/api/credits/transactions?page=0&size=100',
    'http://be.test/api/credits/transactions?page=1&size=100',
  ])
  expect(rows).toStrictEqual([
    { id: '5', companyId: '', type: 'USAGE', amount: -1, reference: 'JOB-1', refunded: true, usageStatus: 'REFUNDED', createdAt: '2026-10-12T02:00:00.123Z' },
    { id: '4', companyId: '', type: 'PURCHASE', amount: 200, reference: 'MOCK_X', refunded: false, createdAt: '2026-10-10T07:21:00.000Z' },
    { id: '1', companyId: '', type: 'MONTHLY_GRANT', amount: 500, reference: '', refunded: false, createdAt: '2026-10-01T00:55:00.000Z' },
  ])
})

test('nạp credit: gửi số credit qua cổng MOCK', async () => {
  backend.replies = [envelope({ id: 8, transactionId: 'MOCK_TOPUP1', paymentUrl: '/api/payment/mock-checkout?txnRef=MOCK_TOPUP1', status: 'PENDING' })]
  expect(await topUpCredits(50)).toStrictEqual({ kind: 'confirm', reference: 'MOCK_TOPUP1', purpose: 'TOPUP' })
  expect(backend.calls[0]).toMatchObject({ method: 'POST', url: 'http://be.test/api/credits/topup', body: { credits: 50, gateway: 'MOCK' } })
})

test('hoá đơn: mảng trần của backend, mới nhất trước, không đọc paidAt', async () => {
  backend.replies = [[
    { id: 1, invoiceNumber: 'INV-1-1', companyId: 1, companyName: 'Vận tải Long Bình', companySubscriptionId: 1, planName: 'Pro', amount: 1490000.0, status: 'PAID', billingPeriod: '2026-09', createdAt: '2026-09-01T01:05:00Z', paidAt: '2026-09-01T08:05:00' },
    { id: 2, invoiceNumber: 'INV-1-2', companyId: 1, companyName: 'Vận tải Long Bình', companySubscriptionId: 1, planName: 'Pro', amount: '1490000.00', status: 'UNPAID', billingPeriod: '2026-10', createdAt: '2026-10-01T01:05:00Z', paidAt: null },
  ]]
  expect(await listInvoices()).toStrictEqual([
    { id: '2', number: 'INV-1-2', planName: 'Pro', amountVnd: 1490000, status: 'UNPAID', period: '2026-10', createdAt: '2026-10-01T01:05:00.000Z' },
    { id: '1', number: 'INV-1-1', planName: 'Pro', amountVnd: 1490000, status: 'PAID', period: '2026-09', createdAt: '2026-09-01T01:05:00.000Z' },
  ])
  expect(backend.calls[0]).toMatchObject({ method: 'GET', url: 'http://be.test/api/company/invoices' })
})
