import { useQuery } from '@tanstack/react-query'
import { listContracts, type ListContractsParams } from './contracts-api'

export const CONTRACTS_QUERY_KEY = ['contracts'] as const

export function useContractsQuery(params: ListContractsParams = {}) {
  return useQuery({
    queryKey: [...CONTRACTS_QUERY_KEY, params],
    queryFn: () => listContracts(params),
  })
}
