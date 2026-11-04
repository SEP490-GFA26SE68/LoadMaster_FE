import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CompanyInfo, NewCompany } from '@/lib/mock-db'
import { createCompany, listCompanies, updateCompany } from './companies-api'
import {
  COMPANIES_ON_SERVER,
  createServerCompany,
  createServerCompanyAdmin,
  listServerCompanies,
  setServerCompanyStatus,
  updateServerCompany,
  type NewServerCompany,
  type NewServerCompanyAdmin,
  type ServerCompany,
  type ServerCompanyInput,
} from './companies-server-api'

/** Màn Công ty đọc backend (`companies` trong `VITE_API_FEATURES`) hay kho mẫu — chọn một lần lúc tải app. */
export const companiesOnServer = COMPANIES_ON_SERVER

/**
 * Hook Query của màn Công ty (FE-8-06). Khoá `['companies', 'overview']` dưới `['companies']` — khoá tên công ty của màn Người dùng và
 * Nhật ký (`staleTime: Infinity`), nên mọi lần ghi làm mới cả nhóm đó, cùng người dùng (tạo công ty tạo thêm một tài khoản) và nhật ký.
 * `staleTime: 0` — gói và số người dùng đổi ở màn khác.
 */
export function useCompaniesQuery() {
  return useQuery({ queryKey: ['companies', 'overview'], queryFn: listCompanies, staleTime: 0 })
}

function useRefreshCompanies() {
  const client = useQueryClient()
  return () => Promise.all(['companies', 'users', 'audit'].map((key) => client.invalidateQueries({ queryKey: [key] })))
}

export function useCreateCompanyMutation() {
  const refresh = useRefreshCompanies()
  return useMutation({ mutationFn: (input: NewCompany) => createCompany(input), onSuccess: refresh })
}

export function useUpdateCompanyMutation() {
  const refresh = useRefreshCompanies()
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: CompanyInfo }) => updateCompany(id, input), onSuccess: refresh })
}

/** Bản nối backend: khoá riêng `['companies', 'server']` vì dòng của backend có cột khác bản kho mẫu. */
export function useServerCompaniesQuery() {
  return useQuery({ queryKey: ['companies', 'server'], queryFn: listServerCompanies, staleTime: 0 })
}

/** Tạo công ty xong mà tạo quản trị hỏng vẫn là "thành công" của lần ghi đầu: công ty đã có, danh sách phải làm mới. */
export function useCreateServerCompanyMutation() {
  const refresh = useRefreshCompanies()
  return useMutation({
    mutationFn: ({ company, admin }: { company: NewServerCompany; admin: NewServerCompanyAdmin }) => createServerCompany(company, admin),
    onSuccess: refresh,
  })
}

export function useCreateServerCompanyAdminMutation() {
  const refresh = useRefreshCompanies()
  return useMutation({
    mutationFn: ({ companyId, admin }: { companyId: string; admin: NewServerCompanyAdmin }) => createServerCompanyAdmin(companyId, admin),
    onSuccess: refresh,
  })
}

export function useUpdateServerCompanyMutation() {
  const refresh = useRefreshCompanies()
  return useMutation({
    mutationFn: ({ current, input }: { current: ServerCompany; input: ServerCompanyInput }) => updateServerCompany(current, input),
    onSuccess: refresh,
  })
}

export function useServerCompanyStatusMutation() {
  const refresh = useRefreshCompanies()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'SUSPENDED' }) => setServerCompanyStatus(id, status),
    onSuccess: refresh,
  })
}
