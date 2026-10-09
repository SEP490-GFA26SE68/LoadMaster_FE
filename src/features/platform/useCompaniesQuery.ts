import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CompanyInfo, NewCompany } from '@/lib/mock-db'
import { createCompany, listCompanies, updateCompany } from './companies-api'

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
