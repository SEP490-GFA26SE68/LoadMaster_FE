/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm.
 *   listCompanies  → GET /api/companies   (gói và số người dùng của từng dòng: chưa có ở BE — Q-19)
 *   createCompany  → POST /api/companies  (kèm Quản trị công ty đầu tiên và mật khẩu tạm trong cùng một lần gọi: chưa có ở BE — Q-19)
 *   updateCompany  → PUT /api/companies/{id}
 *   không dùng ở màn này: GET /api/companies/{id}, PATCH /api/companies/{id}/status (khoá, mở khoá công ty)
 */

import { getMockDb, type Company, type CompanyInfo, type CompanyOverview, type CreatedCompany, type NewCompany } from '@/lib/mock-db'

/** Mọi công ty kèm gói hiện tại, trạng thái gói và số người dùng — việc của quản trị hệ thống (`ROLE_NOT_ALLOWED` với vai trò khác). */
// GET /api/companies (gói, trạng thái gói, số người dùng: chưa có ở BE — Q-19)
export function listCompanies(): Promise<CompanyOverview[]> {
  return getMockDb().listCompanyOverview()
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
export function updateCompany(id: string, input: CompanyInfo): Promise<Company> {
  return getMockDb().updateCompany(id, input)
}
