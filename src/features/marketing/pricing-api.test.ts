import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/lib/api-client'
import { listPublicPlans, parseFeatures, toSubscriptionPlan, type SubscriptionPlanResponse } from './pricing-api'

vi.mock('@/lib/api-client', () => ({
  api: vi.fn(),
}))

describe('pricing-api', () => {
  const mockPlans: SubscriptionPlanResponse[] = [
    {
      id: 1,
      planCode: 'PLAN-BASIC',
      name: 'Gói Tiêu Chuẩn Basic',
      priceVnd: 1500000,
      tier: 'BASIC',
      monthlyCredits: 500,
      algorithmTier: 'EP_DBLF',
      features: '["OPTIMIZATION_3D", "ROUTE_OPTIMIZATION"]',
      billingCycle: 'MONTHLY',
      maxVehicles: 5,
      maxMonthlyJobs: 100,
      active: true,
      activeCompanyCount: 0,
    },
    {
      id: 2,
      planCode: 'PLAN-INACTIVE',
      name: 'Gói Ngừng Bán',
      priceVnd: 2000000,
      tier: 'BASIC',
      monthlyCredits: 500,
      algorithmTier: 'EP_DBLF',
      features: null,
      billingCycle: 'MONTHLY',
      maxVehicles: 5,
      maxMonthlyJobs: 100,
      active: false,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('parses features with /n- and \\n- delimiters and returns empty array when null without hardcoded fallback', () => {
    // No hardcoded fallback when null or undefined
    expect(parseFeatures(null)).toEqual([])
    expect(parseFeatures(undefined)).toEqual([])
    expect(parseFeatures('')).toEqual([])
    expect(parseFeatures(null, 'BASIC')).toEqual([])

    // Delimited with /n- or /n -
    expect(parseFeatures('- Hỗ trợ 3D /n- Tối ưu lộ trình /n- Xuất báo cáo')).toEqual([
      'Hỗ trợ 3D',
      'Tối ưu lộ trình',
      'Xuất báo cáo',
    ])

    // Delimited with \n- or \r\n-
    expect(parseFeatures('- Hỗ trợ 3D\n- Tối ưu lộ trình\r\n- Xuất báo cáo')).toEqual([
      'Hỗ trợ 3D',
      'Tối ưu lộ trình',
      'Xuất báo cáo',
    ])

    // Mixed without leading dash on first line
    expect(parseFeatures('Tính năng đầu tiên/n- Tính năng thứ hai\n- Tính năng thứ ba')).toEqual([
      'Tính năng đầu tiên',
      'Tính năng thứ hai',
      'Tính năng thứ ba',
    ])

    // JSON array format remains supported
    expect(parseFeatures('["OPTIMIZATION_3D", "ROUTE_OPTIMIZATION"]')).toEqual([
      'OPTIMIZATION_3D',
      'ROUTE_OPTIMIZATION',
    ])
  })

  it('maps backend response to frontend SubscriptionPlan', () => {
    const plan = toSubscriptionPlan(mockPlans[0]!)
    expect(plan.id).toBe('1')
    expect(plan.planCode).toBe('PLAN-BASIC')
    expect(plan.name).toBe('Gói Tiêu Chuẩn Basic')
    expect(plan.priceVnd).toBe(1500000)
    expect(plan.tier).toBe('BASIC')
    expect(plan.monthlyCredits).toBe(500)
    expect(plan.algorithmTier).toBe('EP_DBLF')
    expect(plan.features).toEqual(['OPTIMIZATION_3D', 'ROUTE_OPTIMIZATION'])
    expect(plan.maxVehicles).toBe(5)
    expect(plan.maxMonthlyJobs).toBe(100)
    expect(plan.billingCycle).toBe('MONTHLY')
    expect(plan.active).toBe(true)
  })

  it('calls GET /api/subscription/plans and filters for active plans only', async () => {
    const mockGet = vi.fn().mockResolvedValue(mockPlans)
    vi.mocked(api).mockReturnValue({
      get: mockGet,
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    })

    const result = await listPublicPlans()

    expect(mockGet).toHaveBeenCalledWith('/api/subscription/plans')
    expect(result).toHaveLength(1)
    expect(result[0]?.planCode).toBe('PLAN-BASIC')
  })
})
