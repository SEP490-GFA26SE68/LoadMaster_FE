import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { CurrentSubscriptionDto } from '@/lib/billing-backend-api'
import { envelope, useFakeBackend } from '@/test/billing-backend-fetch'
import { fetchOptimizationCredit } from './optimization-api'

/**
 * Thẻ Credit của Thiết lập tối ưu khi nhóm `billing` nối backend: gói và số dư đọc từ backend, cùng luật chặn với kho mẫu — chưa có gói
 * hoặc gói hết hạn chặn trước số dư, gói không giới hạn luôn chạy được, gói đã huỷ vẫn chạy tới hết kỳ.
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['billing']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'billing',
}))

const backend = useFakeBackend()

const PRO: CurrentSubscriptionDto = {
  subscriptionId: 1, planId: 2, planName: 'Pro', tier: 'PRO', status: 'ACTIVE', startedAt: '2026-10-01T08:00:00', expiresAt: '2026-11-01T08:00:00',
  autoRenew: true, creditsBalance: 1200, creditsMonthlyGrant: 500, algorithmTier: 'EP_DBLF_GA',
}
/** Backend trả cho gói không còn ACTIVE: chỉ trạng thái và số dư. */
const statusOnly = (status: CurrentSubscriptionDto['status'], creditsBalance: number): CurrentSubscriptionDto => ({
  subscriptionId: null, planId: null, planName: null, tier: null, status, startedAt: null, expiresAt: null, autoRenew: null,
  creditsBalance, creditsMonthlyGrant: null, algorithmTier: null,
})

function serve(current: CurrentSubscriptionDto, balance: number, isUnlimited = false) {
  backend.routes['GET /api/subscription/current'] = envelope(current)
  backend.routes['GET /api/credits/balance'] = envelope({ companyId: 1, balance, isUnlimited })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-17T03:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

test('an active plan with credits: one run costs 1 credit, the tier of the plan, nothing blocks; both reads carry the token', async () => {
  serve(PRO, 1200)
  expect(await fetchOptimizationCredit()).toStrictEqual({
    planName: 'Pro', algorithmTier: 'EP_DBLF_GA', cost: 1, balance: 1200, unlimited: false, block: null, lapsed: false,
  })
  expect(backend.calls.map((call) => `${call.method} ${call.url} ${call.auth}`).sort()).toStrictEqual([
    'GET http://be.test/api/credits/balance Bearer token-1',
    'GET http://be.test/api/subscription/current Bearer token-1',
  ])
})

test('no credit left blocks with INSUFFICIENT_CREDITS; a cancelled plan (no auto-renew) still runs until its end', async () => {
  serve(PRO, 0)
  expect(await fetchOptimizationCredit()).toMatchObject({ cost: 1, balance: 0, block: 'INSUFFICIENT_CREDITS' })
  serve({ ...PRO, autoRenew: false }, 3)
  expect(await fetchOptimizationCredit()).toMatchObject({ planName: 'Pro', cost: 1, balance: 3, block: null })
})

test('an unlimited plan costs nothing and never blocks, whatever the balance', async () => {
  serve({ ...PRO, planName: 'Ultimate', tier: 'ULTIMATE', algorithmTier: 'EP_DBLF_GA_AI' }, 0, true)
  expect(await fetchOptimizationCredit()).toStrictEqual({
    planName: 'Ultimate', algorithmTier: 'EP_DBLF_GA_AI', cost: 0, balance: 0, unlimited: true, block: null, lapsed: false,
  })
})

test('a plan past its end that the backend still calls ACTIVE is expired: it keeps its name, the run is blocked', async () => {
  serve({ ...PRO, expiresAt: '2026-10-16T08:00:00' }, 1200)
  expect(await fetchOptimizationCredit()).toMatchObject({ planName: 'Pro', cost: 1, balance: 1200, block: 'SUBSCRIPTION_EXPIRED', lapsed: false })
})

test('an expired plan the backend no longer names is lapsed: the balance stays, the run is blocked', async () => {
  serve(statusOnly('EXPIRED', 40), 40)
  expect(await fetchOptimizationCredit()).toStrictEqual({
    planName: null, algorithmTier: null, cost: 1, balance: 40, unlimited: false, block: 'SUBSCRIPTION_EXPIRED', lapsed: true,
  })
})

test('a company that never had a plan (or only a trial the app does not know) has no plan: costs nothing, blocked', async () => {
  for (const status of [null, 'TRIAL'] as const) {
    serve(statusOnly(status, 0), 0)
    expect(await fetchOptimizationCredit()).toStrictEqual({
      planName: null, algorithmTier: null, cost: 0, balance: 0, unlimited: false, block: 'SUBSCRIPTION_EXPIRED', lapsed: false,
    })
  }
})
