import { expect, test, vi } from 'vitest'
import type { PlanDto } from '@/lib/billing-backend-api'
import { failure, noContent, useFakeBackend } from '@/test/billing-backend-fetch'
import {
  createSubscriptionPlan,
  deleteSubscriptionPlan,
  listSubscriptionPlans,
  PLAN_CATALOG_CAPABILITIES,
  setSubscriptionPlanActive,
  updateSubscriptionPlan,
} from './subscription-plans-api'

/**
 * Danh mục gói nối backend (`usesBackend('billing')`): endpoint, thân gửi đi và DTO đổi sang kiểu của app. `SubscriptionPlanController`
 * trả thân trần (không phong bì), danh sách mọi gói là `PageResponse` khi hỏi `paged=true`; PUT thay cả gói nên luôn gửi lại đủ trường.
 */
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
const ULTIMATE: PlanDto = { ...PRO, id: 3, planCode: 'ULTIMATE', name: 'Ultimate', priceVnd: 3990000, tier: 'ULTIMATE', monthlyCredits: null, algorithmTier: 'EP_DBLF_GA_AI', activeCompanyCount: 0 }

test('backend: credit Ultimate theo hạng (không có công tắc không giới hạn)', () => {
  expect(PLAN_CATALOG_CAPABILITIES).toStrictEqual({ unlimitedByTier: true })
})

const pageOf = (data: readonly PlanDto[], page: number, last: boolean) => ({ success: true, data, page, size: 100, totalElements: 3, totalPages: 2, last })

test('danh sách: mọi gói kể cả gói đã ngừng bán, đọc hết các trang, số công ty dùng và mã gói của backend', async () => {
  const oldPro: PlanDto = { ...PRO, id: 4, planCode: 'PRO-OLD', name: 'Pro cũ', priceVnd: 1290000, active: false, activeCompanyCount: 0 }
  backend.replies = [pageOf([ULTIMATE, oldPro], 0, false), pageOf([PRO], 1, true)]
  const rows = await listSubscriptionPlans()
  expect(backend.calls.map((call) => [call.method, call.url, call.auth])).toStrictEqual([
    ['GET', 'http://be.test/api/subscription/plans?paged=true&page=0&size=100', 'Bearer token-1'],
    ['GET', 'http://be.test/api/subscription/plans?paged=true&page=1&size=100', 'Bearer token-1'],
  ])
  expect(rows.map((row) => [row.plan.id, row.code, row.companies, row.plan.monthlyCredits, row.plan.active])).toStrictEqual([
    ['4', 'PRO-OLD', 0, 500, false],
    ['2', 'PRO', 1, 500, true],
    ['3', 'ULTIMATE', 0, null, true],
  ])
})

test('thêm: mã gói theo hạng, thuật toán và tính năng của hạng, cờ bán theo form; Ultimate gửi credit rỗng', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(1_760_000_000_000)
  backend.replies = [{ ...ULTIMATE, id: 9, planCode: 'ULTIMATE-MGJ6K3CW', name: 'QA Ultimate' }]
  const plan = await createSubscriptionPlan({ name: 'QA Ultimate', tier: 'ULTIMATE', priceVnd: 4990000, monthlyCredits: 50, active: false })
  expect(backend.calls[0]).toMatchObject({
    method: 'POST',
    url: 'http://be.test/api/subscription/plans',
    body: {
      planCode: 'ULTIMATE-MGJ6K3CW', name: 'QA Ultimate', priceVnd: 4990000, tier: 'ULTIMATE', monthlyCredits: null, algorithmTier: 'EP_DBLF_GA_AI',
      features: '["OPTIMIZATION_3D","ROUTE_OPTIMIZATION","ADVANCED_ALGORITHM","UNLIMITED_CREDITS"]', billingCycle: 'MONTHLY', active: false,
    },
  })
  expect(plan).toMatchObject({ id: '9', name: 'QA Ultimate', monthlyCredits: null, provisional: false })
  vi.restoreAllMocks()
})

test('thêm không nói cờ bán: gói mới đang bán', async () => {
  backend.replies = [{ ...PRO, id: 10 }]
  await createSubscriptionPlan({ name: 'Pro 3', tier: 'PRO', priceVnd: 1, monthlyCredits: 10 })
  expect(backend.calls[0]?.body).toMatchObject({ tier: 'PRO', monthlyCredits: 10, active: true })
})

test('thêm vào hạng đã có gói đang bán: 409 thành SUBSCRIPTION_TIER_ALREADY_EXISTS', async () => {
  backend.replies = [failure(409)]
  await expect(createSubscriptionPlan({ name: 'Pro 2', tier: 'PRO', priceVnd: 1, monthlyCredits: 10 })).rejects.toMatchObject({ code: 'SUBSCRIPTION_TIER_ALREADY_EXISTS', status: 409 })
})

test('sửa: đọc gói rồi gửi lại đủ trường, chỉ đổi phần sửa', async () => {
  backend.replies = [PRO, { ...PRO, name: 'Pro mới', priceVnd: 1590000, monthlyCredits: 600 }]
  const plan = await updateSubscriptionPlan('2', { name: 'Pro mới', priceVnd: 1590000, monthlyCredits: 600 })
  expect(backend.calls.map((call) => `${call.method} ${call.url}`)).toStrictEqual([
    'GET http://be.test/api/subscription/plans/2',
    'PUT http://be.test/api/subscription/plans/2',
  ])
  expect(backend.calls[1]?.body).toStrictEqual({
    planCode: 'PRO', name: 'Pro mới', priceVnd: 1590000, tier: 'PRO', monthlyCredits: 600, algorithmTier: 'EP_DBLF_GA',
    features: '["OPTIMIZATION_3D","ROUTE_OPTIMIZATION","ADVANCED_ALGORITHM"]', billingCycle: 'MONTHLY', maxVehicles: 20, maxMonthlyJobs: 500, active: true,
  })
  expect(plan).toMatchObject({ name: 'Pro mới', priceVnd: 1590000, monthlyCredits: 600 })
})

test('sửa gói Ultimate: credit giữ như backend (không giới hạn theo hạng)', async () => {
  backend.replies = [ULTIMATE, ULTIMATE]
  await updateSubscriptionPlan('3', { name: 'Ultimate', priceVnd: 3990000, monthlyCredits: null })
  expect(backend.calls[1]?.body).toMatchObject({ tier: 'ULTIMATE', monthlyCredits: null })
})

test('bật / tắt bán: cùng PUT với cờ active', async () => {
  backend.replies = [PRO, { ...PRO, active: false }]
  expect(await setSubscriptionPlanActive('2', false)).toMatchObject({ active: false })
  expect(backend.calls[1]).toMatchObject({ method: 'PUT', body: { planCode: 'PRO', active: false } })
})

test('mở bán khi hạng đã có gói khác đang bán: 409 thành SUBSCRIPTION_TIER_ALREADY_EXISTS', async () => {
  backend.replies = [{ ...PRO, active: false }, failure(409)]
  await expect(setSubscriptionPlanActive('2', true)).rejects.toMatchObject({ code: 'SUBSCRIPTION_TIER_ALREADY_EXISTS', status: 409 })
  expect(backend.calls[1]).toMatchObject({ method: 'PUT', body: { active: true } })
})

test('xoá: 204; còn công ty dùng (409) thành PLAN_IN_USE', async () => {
  backend.replies = [noContent(), failure(409)]
  await deleteSubscriptionPlan('3')
  expect(backend.calls[0]).toMatchObject({ method: 'DELETE', url: 'http://be.test/api/subscription/plans/3' })
  await expect(deleteSubscriptionPlan('2')).rejects.toMatchObject({ code: 'PLAN_IN_USE', status: 409 })
})
