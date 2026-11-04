/**
 * Thông tin công ty `/cong-ty` của quản trị công ty. Hàm → endpoint:
 *   fetchCompanyProfile        GET   /api/company/profile (không nối backend: kho mẫu)
 *   fetchServerCompanyProfile  GET   /api/company/profile
 *   saveCompanyProfile         PATCH /api/company/profile (không nối backend: kho mẫu)
 *   saveServerCompanyProfile   PATCH /api/company/profile
 *   chưa có ở BE: địa chỉ, số điện thoại của công ty (PATCH nhận `address`, `contactPhone` nhưng không lưu, GET không trả), kho xuất phát (Q-19)
 * Nối backend theo `companies` trong `VITE_API_FEATURES`, cùng màn Công ty của quản trị hệ thống.
 */

import { companyOf, COMPANIES_ON_SERVER, type CompanyDto, type ServerCompany } from '@/features/platform/companies-server-api'
import { api } from '@/lib/api-client'
import { getMockDb, type Company, type CompanyProfileChanges } from '@/lib/mock-db'

export type CompanyProfileSource = 'mock' | 'server'

/** Nguồn của màn — chọn một lần lúc tải app. Hai nguồn có bộ trường khác nhau nên màn biết mình đang đọc nguồn nào. */
export const COMPANY_PROFILE_SOURCE: CompanyProfileSource = COMPANIES_ON_SERVER ? 'server' : 'mock'

export type CompanyProfile =
  | { readonly source: 'mock'; readonly company: Company }
  | { readonly source: 'server'; readonly company: ServerCompany }

/** Phần máy chủ lưu: tên và email thanh toán (gửi đi là `contactEmail`). */
export type ServerCompanyProfileChanges = { readonly name: string; readonly billingEmail: string }

/** Thay đổi gửi đi, theo nguồn: kho mẫu lưu tên, địa chỉ, số điện thoại; máy chủ lưu tên và email thanh toán. */
export type CompanyProfileSave =
  | ({ readonly source: 'mock' } & CompanyProfileChanges)
  | ({ readonly source: 'server' } & ServerCompanyProfileChanges)

// GET /api/company/profile
export async function fetchCompanyProfile(): Promise<CompanyProfile> {
  if (COMPANY_PROFILE_SOURCE === 'server') return fetchServerCompanyProfile()
  return { source: 'mock', company: await getMockDb().getCompanyProfile() }
}

// GET /api/company/profile
export async function fetchServerCompanyProfile(): Promise<CompanyProfile> {
  return { source: 'server', company: companyOf(await api().get<CompanyDto>('/api/company/profile')) }
}

// PATCH /api/company/profile
export async function saveCompanyProfile(changes: CompanyProfileSave): Promise<CompanyProfile> {
  if (changes.source === 'server') return saveServerCompanyProfile(changes)
  const company = await getMockDb().updateCompanyProfile({ name: changes.name, address: changes.address, phone: changes.phone })
  return { source: 'mock', company }
}

/**
 * Chỉ gửi hai trường máy chủ lưu. `address`, `contactPhone` gửi đi cũng bị bỏ — và gửi chuỗi rỗng sẽ xoá dữ liệu ngay khi máy chủ bắt
 * đầu lưu chúng, vì GET chưa trả hai trường đó để gửi lại.
 */
// PATCH /api/company/profile
export async function saveServerCompanyProfile({ name, billingEmail }: ServerCompanyProfileChanges): Promise<CompanyProfile> {
  const dto = await api().patch<CompanyDto>('/api/company/profile', { body: { companyName: name, contactEmail: billingEmail } })
  return { source: 'server', company: companyOf(dto) }
}
