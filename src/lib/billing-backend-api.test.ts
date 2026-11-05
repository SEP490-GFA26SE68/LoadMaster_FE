import { expect, test, vi } from 'vitest'
import { envelope, failure, useFakeBackend } from '@/test/billing-backend-fetch'
import { ApiError } from './api-client'
import {
  creditBalanceOf,
  fromBackendLocalDateTime,
  getCreditBalanceDto,
  getCurrentSubscriptionDto,
  getPlanDto,
  listActivePlans,
  planFromDto,
  withBusinessCode,
  type PlanDto,
} from './billing-backend-api'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['billing']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'billing',
}))

const backend = useFakeBackend()

const PRO: PlanDto = {
  id: 2, planCode: 'PRO', name: 'Pro', priceVnd: 1490000, tier: 'PRO', monthlyCredits: 500, algorithmTier: 'EP_DBLF_GA',
  features: '["OPTIMIZATION_3D","ROUTE_OPTIMIZATION","ADVANCED_ALGORITHM"]', billingCycle: 'MONTHLY', maxVehicles: 20, maxMonthlyJobs: 500,
  active: true, activeCompanyCount: 1,
}
const ULTIMATE: PlanDto = { ...PRO, id: 3, planCode: 'ULTIMATE', name: 'Ultimate', priceVnd: 3990000, tier: 'ULTIMATE', monthlyCredits: null, algorithmTier: 'EP_DBLF_GA_AI', features: null }
const BASIC: PlanDto = { ...PRO, id: 7, planCode: 'BASIC', name: 'Basic', priceVnd: '490000.00', tier: 'BASIC', monthlyCredits: 100, algorithmTier: null, features: 'OPTIMIZATION_3D, ROUTE_OPTIMIZATION' }

test('giờ của backend: LocalDateTime là giờ Việt Nam, Instant giữ múi; phần lẻ của giây cắt về mili giây', () => {
  expect(fromBackendLocalDateTime('2026-10-17T09:15:30.123456')).toBe('2026-10-17T02:15:30.123Z')
  expect(fromBackendLocalDateTime('2026-10-17T09:15')).toBe('2026-10-17T02:15:00.000Z')
  expect(fromBackendLocalDateTime('2026-10-17T02:15:30.987654Z')).toBe('2026-10-17T02:15:30.987Z')
  expect(fromBackendLocalDateTime('2026-10-17T09:15:30+07:00')).toBe('2026-10-17T02:15:30.000Z')
  expect(fromBackendLocalDateTime(null)).toBeNull()
  expect(fromBackendLocalDateTime('không phải ngày')).toBeNull()
})

test('gói: Ultimate không giới hạn theo hạng, tính năng đọc mảng JSON hoặc danh sách, giá BigDecimal thành số nguyên', () => {
  expect(planFromDto(PRO)).toStrictEqual({
    id: '2', name: 'Pro', tier: 'PRO', priceVnd: 1490000, monthlyCredits: 500, algorithmTier: 'EP_DBLF_GA',
    features: ['OPTIMIZATION_3D', 'ROUTE_OPTIMIZATION', 'ADVANCED_ALGORITHM'], active: true, provisional: false,
  })
  expect(planFromDto({ ...ULTIMATE, monthlyCredits: 9999 })).toMatchObject({ monthlyCredits: null, features: ['OPTIMIZATION_3D', 'ROUTE_OPTIMIZATION', 'ADVANCED_ALGORITHM', 'UNLIMITED_CREDITS'] })
  expect(planFromDto(BASIC)).toMatchObject({ priceVnd: 490000, algorithmTier: 'EP_DBLF', features: ['OPTIMIZATION_3D', 'ROUTE_OPTIMIZATION'] })
})

test('gói đang bán: không cần token, sắp theo hạng', async () => {
  backend.token = null
  backend.replies = [[ULTIMATE, PRO, BASIC]]
  const plans = await listActivePlans()
  expect(backend.calls).toStrictEqual([{ method: 'GET', url: 'http://be.test/api/subscription/plans', body: undefined, auth: null }])
  expect(plans.map((plan) => plan.tier)).toStrictEqual(['BASIC', 'PRO', 'ULTIMATE'])
})

test('một gói, gói hiện tại, số dư: đúng endpoint, kèm token', async () => {
  backend.replies = [PRO, envelope({ status: 'ACTIVE', planId: 2 }), envelope({ companyId: 1, balance: 486, isUnlimited: false })]
  expect(await getPlanDto('2')).toStrictEqual(PRO)
  expect(await getCurrentSubscriptionDto()).toMatchObject({ status: 'ACTIVE', planId: 2 })
  expect(creditBalanceOf(await getCreditBalanceDto())).toStrictEqual({ balance: 486, unlimited: false })
  expect(backend.calls.map((call) => `${call.method} ${call.url} ${call.auth}`)).toStrictEqual([
    'GET http://be.test/api/subscription/plans/2 Bearer token-1',
    'GET http://be.test/api/subscription/current Bearer token-1',
    'GET http://be.test/api/credits/balance Bearer token-1',
  ])
  expect(creditBalanceOf({ companyId: 1, balance: null, isUnlimited: true })).toStrictEqual({ balance: 0, unlimited: true })
})

test('mã nghiệp vụ theo HTTP: chỉ đổi mã đã khai, giữ mã HTTP', async () => {
  backend.replies = [failure(409), failure(500)]
  const conflict = withBusinessCode(getPlanDto('2'), { CONFLICT: 'PLAN_IN_USE' })
  await expect(conflict).rejects.toMatchObject({ code: 'PLAN_IN_USE', status: 409 })
  await expect(withBusinessCode(getPlanDto('2'), { CONFLICT: 'PLAN_IN_USE' })).rejects.toMatchObject({ code: 'SERVER_ERROR', status: 500 })
  await expect(withBusinessCode(Promise.reject(new Error('khác')), { CONFLICT: 'PLAN_IN_USE' })).rejects.not.toBeInstanceOf(ApiError)
})
