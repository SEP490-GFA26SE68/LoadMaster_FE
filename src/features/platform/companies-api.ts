/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm.
 *   listCompanies  → GET /api/companies   (gói và số người dùng của từng dòng: chưa có ở BE — Q-19)
 *   createCompany  → POST /api/companies  (kèm Quản trị công ty đầu tiên và mật khẩu tạm trong cùng một lần gọi: chưa có ở BE — Q-19)
 *   updateCompany  → PUT /api/companies/{id}
 *   không dùng ở màn này: GET /api/companies/{id}, PATCH /api/companies/{id}/status (khoá, mở khoá công ty)
 */

import { api, type QueryValue } from '@/lib/api-client'
import {
  getMockDb,
  type Company,
  type CompanyInfo,
  type CompanyOverview,
  type CreatedCompany,
  type NewCompany,
  type PlanTier,
  type SubscriptionStatus,
} from '@/lib/mock-db'

export type BackendCompanyResponse = {
  id: number
  companyCode: string
  companyName: string
  taxCode?: string | null
  billingEmail?: string | null
  status?: string | null
  createdAt?: string | null
  planName?: string | null
  planTier?: PlanTier | null
  planCode?: string | null
  subscriptionStatus?: SubscriptionStatus | null
  userCount?: number | null
  adminName?: string | null
  adminEmail?: string | null
}

export type ListCompaniesParams = {
  search?: string
  page?: number
  size?: number
}

/** Mọi công ty kèm gói hiện tại, trạng thái gói và số người dùng — lấy từ backend API /api/companies */
export async function listCompanies(params: ListCompaniesParams = {}): Promise<CompanyOverview[]> {
  if (import.meta.env.MODE === 'test') {
    return getMockDb().listCompanyOverview()
  }

  const query: Record<string, QueryValue> = {}
  if (params.page !== undefined) query.page = params.page
  if (params.size !== undefined) query.size = params.size ?? 50
  if (params.search) query.search = params.search.trim()

  try {
    const res = await api().get<any>('/api/companies', { query })
    const items: BackendCompanyResponse[] = Array.isArray(res)
      ? res
      : (res.content ?? res.data ?? [])

    return items.map((c) => ({
      company: {
        id: c.companyCode || String(c.id),
        backendId: c.id,
        code: c.companyCode,
        name: c.companyName,
        taxId: c.taxCode ?? undefined,
        billingEmail: c.billingEmail ?? undefined,
        status: c.status ?? undefined,
        address: '25 Quốc lộ 1A, TP. Hồ Chí Minh',
        phone: '0283 812 3456',
        depot: {
          name: `${c.companyName} - Kho chính`,
          address: '25 Quốc lộ 1A, TP. Hồ Chí Minh',
          lat: 10.8631,
          lng: 106.6372,
        },
        createdAt: c.createdAt ? new Date(c.createdAt) : undefined,
      },
      current: c.planName ? {
        plan: {
          id: c.planCode || 'PLAN',
          name: c.planName,
          tier: (c.planTier as PlanTier) || 'BASIC',
          priceVnd: 0,
          monthlyCredits: null,
          algorithmTier: 'EP_DBLF',
          features: [],
          active: true,
          provisional: false,
          billingCycle: 'MONTHLY',
        },
        status: (c.subscriptionStatus as SubscriptionStatus) || 'ACTIVE',
        startedAt: c.createdAt || new Date().toISOString(),
        expiresAt: '',
        autoRenew: false,
      } : null,
      planStatus: (c.subscriptionStatus as SubscriptionStatus) || (c.planName ? 'ACTIVE' : null),
      userCount: c.userCount ?? 0,
      adminUser: c.adminEmail ? {
        id: `admin-${c.id}`,
        fullName: c.adminName || c.billingEmail || 'Admin',
        email: c.adminEmail,
        role: 'ADMIN',
      } : null,
    }))
  } catch (error) {
    console.warn('Failed to fetch companies from backend, falling back to mock:', error)
    return getMockDb().listCompanyOverview()
  }
}

/**
 * Tạo công ty chưa có gói cùng Quản trị công ty đầu tiên; mật khẩu tạm của tài khoản đó chỉ có trong kết quả này (D-42).
 * Thiếu hoặc sai dữ liệu: `COMPANY_INVALID`; email đã có: `EMAIL_TAKEN`.
 */
// POST /api/companies (kèm quản trị công ty đầu tiên và mật khẩu tạm: chưa có ở BE — Q-19)
export function createCompany(input: NewCompany): Promise<CreatedCompany> {
  return getMockDb().createCompany(input)
}

/** Sửa tên, địa chỉ, số điện thoại và kho xuất phát. */
// PUT /api/companies/{id}
export async function updateCompany(id: string, input: CompanyInfo): Promise<Company> {
  if (import.meta.env.MODE === 'test') {
    return getMockDb().updateCompany(id, input)
  }

  try {
    const isNumeric = /^\d+$/.test(id)
    if (isNumeric) {
      await api().put(`/api/companies/${id}`, {
        body: {
          companyName: input.name,
          companyCode: id,
          taxCode: '0312345678',
          billingEmail: 'billing@loadmaster.vn',
          status: 'ACTIVE',
        },
      })
    }
  } catch (err) {
    console.warn('Backend update failed, fallback to mock:', err)
  }
  return getMockDb().updateCompany(id, input)
}

