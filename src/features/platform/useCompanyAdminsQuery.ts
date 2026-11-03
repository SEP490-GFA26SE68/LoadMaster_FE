import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listCompanyAdmins,
  updateCompanyAdmin,
  updateCompanyAdminStatus,
  type ListCompanyAdminsParams,
} from './company-admins-api'

export const COMPANY_ADMINS_QUERY_KEY = ['company-admins'] as const

export function useCompanyAdminsQuery(params: ListCompanyAdminsParams = {}) {
  return useQuery({
    queryKey: [...COMPANY_ADMINS_QUERY_KEY, params],
    queryFn: () => listCompanyAdmins(params),
  })
}

export function useUpdateCompanyAdminMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { fullName: string; phoneNumber?: string } }) =>
      updateCompanyAdmin(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: COMPANY_ADMINS_QUERY_KEY })
    },
  })
}

export function useUpdateCompanyAdminStatusMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'ACTIVE' | 'LOCKED' }) =>
      updateCompanyAdminStatus(id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: COMPANY_ADMINS_QUERY_KEY })
    },
  })
}
