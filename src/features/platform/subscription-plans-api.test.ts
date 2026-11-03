import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/lib/api-client'
import {
  createSubscriptionPlan,
  deleteSubscriptionPlan,
  listSubscriptionPlans,
  setSubscriptionPlanActive,
  updateSubscriptionPlan,
  type CreatePlanInput,
  type UpdatePlanInput,
} from './subscription-plans-api'

vi.mock('@/lib/api-client', () => ({
  api: vi.fn(),
}))

describe('subscription-plans-api', () => {
  const mockPageResponse = {
    success: true,
    page: 0,
    size: 10,
    totalElements: 1,
    totalPages: 1,
    last: true,
    data: [
      {
        id: 1,
        planCode: 'PLAN-PRO',
        name: 'Gói Doanh Nghiệp Pro',
        priceVnd: 4500000,
        tier: 'PRO',
        monthlyCredits: 2000,
        algorithmTier: 'EP_DBLF_GA',
        features: '["OPTIMIZATION_3D", "ROUTE_OPTIMIZATION"]',
        billingCycle: 'MONTHLY',
        maxVehicles: 20,
        maxMonthlyJobs: 500,
        active: true,
        activeCompanyCount: 3,
      },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls GET /api/subscription/plans with pagination and filters', async () => {
    const mockGet = vi.fn().mockResolvedValue(mockPageResponse)
    vi.mocked(api).mockReturnValue({
      get: mockGet,
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    })

    const result = await listSubscriptionPlans({
      page: 0,
      size: 10,
      search: 'Pro',
      active: true,
      tier: 'PRO',
    })

    expect(mockGet).toHaveBeenCalledWith('/api/subscription/plans', {
      query: {
        paged: true,
        page: 0,
        size: 10,
        search: 'Pro',
        active: true,
        tier: 'PRO',
      },
    })

    expect(result.totalElements).toBe(1)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]?.plan.planCode).toBe('PLAN-PRO')
    expect(result.rows[0]?.companies).toBe(3)
    expect(result.rows[0]?.plan.maxVehicles).toBe(20)
    expect(result.rows[0]?.plan.maxMonthlyJobs).toBe(500)
  })

  it('calls POST /api/subscription/plans to create a new plan with all fields', async () => {
    const mockPost = vi.fn().mockResolvedValue({
      id: 5,
      planCode: 'PLAN-ENTERPRISE',
      name: 'Enterprise Plan',
      priceVnd: 10000000,
      tier: 'ULTIMATE',
      monthlyCredits: 5000,
      algorithmTier: 'EP_DBLF_GA_AI',
      features: '["AI_OPTIMIZATION"]',
      billingCycle: 'YEARLY',
      maxVehicles: 50,
      maxMonthlyJobs: 2000,
      active: true,
      activeCompanyCount: 0,
    })

    vi.mocked(api).mockReturnValue({
      get: vi.fn(),
      post: mockPost,
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    })

    const input: CreatePlanInput = {
      planCode: 'PLAN-ENTERPRISE',
      name: 'Enterprise Plan',
      priceVnd: 10000000,
      tier: 'ULTIMATE',
      monthlyCredits: 5000,
      algorithmTier: 'EP_DBLF_GA_AI',
      features: '["AI_OPTIMIZATION"]',
      billingCycle: 'YEARLY',
      maxVehicles: 50,
      maxMonthlyJobs: 2000,
      active: true,
    }

    const created = await createSubscriptionPlan(input)

    expect(mockPost).toHaveBeenCalledWith('/api/subscription/plans', { body: input })
    expect(created.planCode).toBe('PLAN-ENTERPRISE')
    expect(created.priceVnd).toBe(10000000)
  })

  it('calls PUT /api/subscription/plans/{id} to update an existing plan', async () => {
    const mockPut = vi.fn().mockResolvedValue({
      id: 1,
      planCode: 'PLAN-PRO',
      name: 'Pro Updated',
      priceVnd: 5000000,
      tier: 'PRO',
      monthlyCredits: 2500,
      algorithmTier: 'EP_DBLF_GA',
      features: '["OPTIMIZATION_3D"]',
      billingCycle: 'MONTHLY',
      maxVehicles: 25,
      maxMonthlyJobs: 600,
      active: true,
      activeCompanyCount: 1,
    })

    vi.mocked(api).mockReturnValue({
      get: vi.fn(),
      post: vi.fn(),
      put: mockPut,
      patch: vi.fn(),
      delete: vi.fn(),
    })

    const patch: UpdatePlanInput = {
      name: 'Pro Updated',
      priceVnd: 5000000,
      tier: 'PRO',
      monthlyCredits: 2500,
      algorithmTier: 'EP_DBLF_GA',
      features: '["OPTIMIZATION_3D"]',
      billingCycle: 'MONTHLY',
      maxVehicles: 25,
      maxMonthlyJobs: 600,
      active: true,
    }

    const updated = await updateSubscriptionPlan('1', patch)

    expect(mockPut).toHaveBeenCalledWith('/api/subscription/plans/1', { body: patch })
    expect(updated.name).toBe('Pro Updated')
  })

  it('calls DELETE /api/subscription/plans/{id} to delete a plan', async () => {
    const mockDelete = vi.fn().mockResolvedValue(undefined)
    vi.mocked(api).mockReturnValue({
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: mockDelete,
    })

    await deleteSubscriptionPlan('1')

    expect(mockDelete).toHaveBeenCalledWith('/api/subscription/plans/1')
  })

  it('calls PUT /api/subscription/plans/{id} to toggle plan active status', async () => {
    const mockPut = vi.fn().mockResolvedValue({
      id: 1,
      planCode: 'PLAN-PRO',
      name: 'Pro Tier',
      priceVnd: 4500000,
      tier: 'PRO',
      monthlyCredits: 2000,
      algorithmTier: 'EP_DBLF_GA',
      features: null,
      billingCycle: 'MONTHLY',
      active: false,
    })

    vi.mocked(api).mockReturnValue({
      get: vi.fn(),
      post: vi.fn(),
      put: mockPut,
      patch: vi.fn(),
      delete: vi.fn(),
    })

    const updated = await setSubscriptionPlanActive('1', false, {
      name: 'Pro Tier',
      priceVnd: 4500000,
      tier: 'PRO',
      monthlyCredits: 2000,
    })

    expect(mockPut).toHaveBeenCalledWith('/api/subscription/plans/1', {
      body: expect.objectContaining({ active: false }),
    })
    expect(updated.active).toBe(false)
  })
})
