import { api, type QueryValue } from '@/lib/api-client'
import { getMockDb } from '@/lib/mock-db'

export type SubscriptionContract = {
  id: number
  companyId?: number | null
  companyCode?: string | null
  companyName?: string | null
  planId?: number | null
  planCode?: string | null
  planName?: string | null
  planTier?: string | null
  price?: number | null
  billingCycle?: 'MONTHLY' | 'YEARLY' | null
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED'
  startedAt?: string | null
  expiresAt?: string | null
  autoRenew?: boolean | null
  adminName?: string | null
  adminEmail?: string | null
  adminPhone?: string | null
  creditsGranted?: number | null
}

export type ListContractsParams = {
  companyId?: number
  status?: 'ACTIVE' | 'EXPIRED' | 'CANCELLED'
  planId?: number
}

export async function listContracts(params: ListContractsParams = {}): Promise<SubscriptionContract[]> {
  if (import.meta.env.MODE === 'test') {
    const mockCompanies = await getMockDb().listCompanyOverview()
    return mockCompanies
      .filter((c) => c.current)
      .map((c, idx) => ({
        id: idx + 1,
        companyId: idx + 1,
        companyCode: c.company.id,
        companyName: c.company.name,
        planId: idx + 1,
        planCode: c.current!.plan.id,
        planName: c.current!.plan.name,
        planTier: c.current!.plan.tier,
        price: c.current!.plan.priceVnd,
        billingCycle: 'MONTHLY',
        status: (c.planStatus as any) || 'ACTIVE',
        startedAt: c.current!.startedAt || new Date().toISOString(),
        expiresAt: c.current!.expiresAt || '',
        autoRenew: c.current!.autoRenew,
        adminName: c.adminUser?.fullName,
        adminEmail: c.adminUser?.email,
        adminPhone: c.adminUser?.phone,
        creditsGranted: c.current!.plan.monthlyCredits,
      }))
  }

  const query: Record<string, QueryValue> = {}
  if (params.companyId) query.companyId = params.companyId
  if (params.status) query.status = params.status
  if (params.planId) query.planId = params.planId

  try {
    const res = await api().get<SubscriptionContract[]>('/api/contracts', { query })
    return Array.isArray(res) ? res : []
  } catch (error) {
    console.warn('Failed to fetch contracts, fallback to empty list:', error)
    return []
  }
}
