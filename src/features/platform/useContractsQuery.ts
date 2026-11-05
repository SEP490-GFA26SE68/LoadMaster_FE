import { useQuery } from '@tanstack/react-query'
import { listContracts } from './contracts-api'

/** Lịch sử gói cước của nền tảng. Khoá dưới `['billing']` nên mọi lần ghi gói cước làm mới nó; `staleTime: 0` — gói đổi ở màn khác. */
export function useContractsQuery() {
  return useQuery({ queryKey: ['billing', 'contracts'], queryFn: listContracts, staleTime: 0 })
}
