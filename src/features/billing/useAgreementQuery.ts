import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BILLING_CAPABILITIES } from './billing-api'
import { fetchCompanyAgreement, fetchMyAgreement, signAgreement, type SignAgreementRequest } from './agreements-api'

/** Thoả thuận dịch vụ của công ty dùng thử (chỉ backend: `BILLING_CAPABILITIES.agreements`). Ký xong làm mới gói cước và công ty. */
const KEY = ['billing', 'agreements'] as const

export function useMyAgreementQuery() {
  return useQuery({ queryKey: [...KEY, 'mine'], queryFn: fetchMyAgreement, enabled: BILLING_CAPABILITIES.agreements, staleTime: 0 })
}

export function useCompanyAgreementQuery(companyId: string | undefined) {
  return useQuery({
    queryKey: [...KEY, 'company', companyId ?? ''],
    queryFn: () => fetchCompanyAgreement(companyId ?? ''),
    enabled: BILLING_CAPABILITIES.agreements && Boolean(companyId),
    staleTime: 0,
  })
}

export function useSignAgreementMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (request: SignAgreementRequest) => signAgreement(request),
    onSuccess: () => Promise.all([client.invalidateQueries({ queryKey: ['billing'] }), client.invalidateQueries({ queryKey: ['companies'] })]),
  })
}
