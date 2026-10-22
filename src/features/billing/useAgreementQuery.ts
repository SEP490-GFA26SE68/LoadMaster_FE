import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchCompanyAgreement,
  fetchMyAgreement,
  signAgreement,
  type SignAgreementRequest,
} from './agreements-api'

const AGREEMENT_KEY = ['agreements'] as const

export function useMyAgreementQuery() {
  return useQuery({
    queryKey: [...AGREEMENT_KEY, 'my-agreement'],
    queryFn: fetchMyAgreement,
    staleTime: 10_000,
  })
}

export function useCompanyAgreementQuery(companyId?: number) {
  return useQuery({
    queryKey: [...AGREEMENT_KEY, 'company', companyId],
    queryFn: () => (companyId ? fetchCompanyAgreement(companyId) : Promise.resolve(null)),
    enabled: !!companyId,
    staleTime: 10_000,
  })
}

export function useSignAgreementMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (request: SignAgreementRequest) => signAgreement(request),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: AGREEMENT_KEY })
      void client.invalidateQueries({ queryKey: ['billing'] })
      void client.invalidateQueries({ queryKey: ['company-admins'] })
      void client.invalidateQueries({ queryKey: ['companies'] })
    },
  })
}
