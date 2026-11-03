import { api, type QueryValue } from '@/lib/api-client'
import { getMockDb } from '@/lib/mock-db'

export type CompanyAdminUser = {
  id: number
  keycloakId?: string
  email: string
  fullName: string
  phoneNumber?: string | null
  status: 'ACTIVE' | 'LOCKED'
  companyId?: number | null
  companyName?: string | null
  companyCode?: string | null
  taxCode?: string | null
  planName?: string | null
  planTier?: string | null
  planCode?: string | null
  subscriptionStatus?: string | null
  subscriptionExpiresAt?: string | null
  creditBalance?: number | null
  createdAt?: string | null
}

export type ListCompanyAdminsParams = {
  search?: string
  status?: 'ACTIVE' | 'LOCKED'
  page?: number
  size?: number
}

export type PageResponse<T> = {
  success: boolean
  message?: string
  data: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

export async function listCompanyAdmins(params: ListCompanyAdminsParams = {}): Promise<{
  items: CompanyAdminUser[]
  totalElements: number
}> {
  if (import.meta.env.MODE === 'test') {
    // Generate from mock DB companies
    const mockCompanies = await getMockDb().listCompanyOverview()
    const admins: CompanyAdminUser[] = mockCompanies
      .filter((c) => c.adminUser)
      .map((c, idx) => ({
        id: idx + 1,
        email: c.adminUser!.email,
        fullName: c.adminUser!.fullName,
        phoneNumber: c.adminUser!.phone || '0901234567',
        status: 'ACTIVE',
        companyId: idx + 1,
        companyName: c.company.name,
        companyCode: c.company.id,
        taxCode: c.company.taxId,
        planName: c.current?.plan.name ?? null,
        planTier: c.current?.plan.tier ?? null,
        planCode: c.current?.plan.id ?? null,
        subscriptionStatus: c.planStatus ?? null,
        creditBalance: c.current?.plan.monthlyCredits ?? 0,
        createdAt: c.company.createdAt ? c.company.createdAt.toISOString() : new Date().toISOString(),
      }))

    let filtered = admins
    if (params.search?.trim()) {
      const q = params.search.trim().toLowerCase()
      filtered = filtered.filter(
        (a) =>
          a.fullName.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q) ||
          (a.companyName && a.companyName.toLowerCase().includes(q)),
      )
    }
    if (params.status) {
      filtered = filtered.filter((a) => a.status === params.status)
    }
    return { items: filtered, totalElements: filtered.length }
  }

  const query: Record<string, QueryValue> = {
    role: 'ADMIN',
    page: params.page ?? 0,
    size: params.size ?? 25,
  }
  if (params.search?.trim()) {
    query.search = params.search.trim()
  }
  if (params.status) {
    query.status = params.status
  }

  try {
    const res = await api().get<PageResponse<CompanyAdminUser>>('/api/users', { query })
    return {
      items: res.data ?? [],
      totalElements: res.totalElements ?? (res.data ? res.data.length : 0),
    }
  } catch (error) {
    console.warn('Failed to fetch company admins, fallback to mock:', error)
    return { items: [], totalElements: 0 }
  }
}

export async function updateCompanyAdmin(
  id: number,
  data: { fullName: string; phoneNumber?: string; companyId?: number },
): Promise<CompanyAdminUser> {
  const res = await api().put<{ success: boolean; data: CompanyAdminUser }>(`/api/users/${id}`, {
    body: {
      fullName: data.fullName,
      phoneNumber: data.phoneNumber,
      role: 'ADMIN',
      companyId: data.companyId,
    },
  })
  return res.data
}

export async function updateCompanyAdminStatus(
  id: number,
  status: 'ACTIVE' | 'LOCKED',
): Promise<CompanyAdminUser> {
  const res = await api().patch<{ success: boolean; data: CompanyAdminUser }>(`/api/users/${id}/status`, {
    body: { status },
  })
  return res.data
}
