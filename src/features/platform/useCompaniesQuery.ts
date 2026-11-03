import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CompanyInfo, NewCompany } from '@/lib/mock-db'
import { createCompany, listCompanies, updateCompany, type ListCompaniesParams } from './companies-api'

/**
 * Hook Query của màn Công ty (FE-8-06). Khoá `['companies', 'overview', params]`
 */
export function useCompaniesQuery(params?: ListCompaniesParams) {
  return useQuery({
    queryKey: ['companies', 'overview', params],
    queryFn: () => listCompanies(params),
    staleTime: 0,
  })
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
