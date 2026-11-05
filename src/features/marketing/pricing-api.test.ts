import { expect, test, vi } from 'vitest'
import type { PlanDto } from '@/lib/billing-backend-api'
import { failure, useFakeBackend } from '@/test/billing-backend-fetch'
import { listPublicPlans } from './pricing-api'

/**
 * Bảng giá công khai khi nhóm `billing` nối backend: gói đang bán của backend theo thứ tự hạng, gọi **không kèm token** dù trình duyệt
 * đang có phiên (trang của khách không phụ thuộc phiên), backend không có cờ "giá trị tạm".
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['billing']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'billing',
}))

const backend = useFakeBackend()

const BASIC: PlanDto = {
  id: 1, planCode: 'BASIC', name: 'Basic', priceVnd: 490000, tier: 'BASIC', monthlyCredits: 100, algorithmTier: 'EP_DBLF',
  features: '["OPTIMIZATION_3D","ROUTE_OPTIMIZATION"]', billingCycle: 'MONTHLY', maxVehicles: 5, maxMonthlyJobs: 100, active: true, activeCompanyCount: 1,
}
const PRO: PlanDto = { ...BASIC, id: 2, planCode: 'PRO', name: 'Pro', priceVnd: 1490000, tier: 'PRO', monthlyCredits: 500, algorithmTier: 'EP_DBLF_GA' }
const ULTIMATE: PlanDto = { ...BASIC, id: 3, planCode: 'ULTIMATE', name: 'Ultimate', priceVnd: '3990000.00', tier: 'ULTIMATE', monthlyCredits: 0, algorithmTier: 'EP_DBLF_GA_AI' }

test('the plans on sale of the backend, by tier, without the token of the session', async () => {
  backend.routes['GET /api/subscription/plans'] = [ULTIMATE, { ...BASIC, id: 7, name: 'QA cũ', active: false }, PRO, BASIC]
  const plans = await listPublicPlans()
  expect(plans.map(({ id, name, priceVnd, monthlyCredits, provisional }) => ({ id, name, priceVnd, monthlyCredits, provisional }))).toStrictEqual([
    { id: '1', name: 'Basic', priceVnd: 490000, monthlyCredits: 100, provisional: false },
    { id: '2', name: 'Pro', priceVnd: 1490000, monthlyCredits: 500, provisional: false },
    { id: '3', name: 'Ultimate', priceVnd: 3990000, monthlyCredits: null, provisional: false },
  ])
  expect(plans[0]?.features).toStrictEqual(['OPTIMIZATION_3D', 'ROUTE_OPTIMIZATION'])
  expect(backend.calls).toStrictEqual([{ method: 'GET', url: 'http://be.test/api/subscription/plans', body: undefined, auth: null }])
})

test('a backend failure reaches the page as an error code, not an empty list', async () => {
  backend.routes['GET /api/subscription/plans'] = () => failure(500)
  await expect(listPublicPlans()).rejects.toMatchObject({ code: 'SERVER_ERROR', status: 500 })
})
