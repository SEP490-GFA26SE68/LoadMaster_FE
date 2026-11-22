import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  WAREHOUSE_PAYROLL_CAPABILITIES,
  calculateWarehousePayrollPeriod,
  createWarehousePayrollRate,
  deleteDraftWarehousePayrollPeriod,
  fetchOwnWarehousePayroll,
  fetchWarehousePayrollPeriod,
  fetchWarehousePayrollRates,
  fetchWarehousePayrollStatement,
  lockWarehousePayrollPeriod,
  setWarehouseWorkerBaseSalary,
  unlockWarehousePayrollPeriod,
  type SetWarehouseBaseSalaryInput,
  type WarehousePayrollPeriod,
  type WarehousePayrollRateInput,
} from './warehouse-payroll-api'

const KEY = ['warehouse-payroll'] as const
const RATES_KEY = [...KEY, 'rates'] as const
const periodKey = (period: string) => [...KEY, 'period', period] as const
const statementKey = (period: string, workerId: string | null) => [...KEY, 'statement', period, workerId] as const
const ownKey = (period: string) => [...KEY, 'own', period] as const

export function useWarehousePayrollRatesQuery() {
  return useQuery({ queryKey: RATES_KEY, queryFn: fetchWarehousePayrollRates, enabled: WAREHOUSE_PAYROLL_CAPABILITIES.server, staleTime: 0 })
}

export function useWarehousePayrollPeriodQuery(period: string, enabled = true) {
  return useQuery({
    queryKey: periodKey(period),
    queryFn: () => fetchWarehousePayrollPeriod(period),
    enabled: WAREHOUSE_PAYROLL_CAPABILITIES.server && enabled && period.length === 7,
    staleTime: 0,
  })
}

export function useWarehousePayrollStatementQuery(period: string, workerId: string | null) {
  return useQuery({
    queryKey: statementKey(period, workerId),
    queryFn: () => fetchWarehousePayrollStatement(period, workerId as string),
    enabled: WAREHOUSE_PAYROLL_CAPABILITIES.server && workerId !== null,
    staleTime: 0,
  })
}

export function useOwnWarehousePayrollQuery(period: string) {
  return useQuery({
    queryKey: ownKey(period),
    queryFn: () => fetchOwnWarehousePayroll(period),
    enabled: WAREHOUSE_PAYROLL_CAPABILITIES.server && period.length === 7,
    staleTime: 0,
  })
}

export function useCreateWarehousePayrollRateMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: WarehousePayrollRateInput) => createWarehousePayrollRate(input),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  })
}

/** Tính, chốt, mở chốt: máy chủ trả lại bảng của kỳ — đặt thẳng vào cache rồi làm mới phần còn lại (phiên bản, phiếu lương). */
function usePeriodMutation(run: (period: string) => Promise<WarehousePayrollPeriod>, refresh: 'statements' | 'all') {
  const client = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSuccess: (period) => {
      client.setQueryData(periodKey(period.period), period)
      return client.invalidateQueries({ queryKey: refresh === 'all' ? KEY : [...KEY, 'statement', period.period] })
    },
  })
}

export function useCalculateWarehousePayrollPeriodMutation() {
  return usePeriodMutation(calculateWarehousePayrollPeriod, 'statements')
}

export function useLockWarehousePayrollPeriodMutation() {
  return usePeriodMutation(lockWarehousePayrollPeriod, 'all')
}

export function useUnlockWarehousePayrollPeriodMutation() {
  return usePeriodMutation(unlockWarehousePayrollPeriod, 'all')
}

export function useDeleteDraftWarehousePayrollPeriodMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: deleteDraftWarehousePayrollPeriod,
    onSuccess: async (_result, period) => {
      await client.cancelQueries({ queryKey: periodKey(period) })
      client.setQueryData(periodKey(period), null)
      await client.invalidateQueries({ queryKey: [...KEY, 'statement', period] })
    },
  })
}

export function useSetWarehouseBaseSalaryMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: SetWarehouseBaseSalaryInput) => setWarehouseWorkerBaseSalary(input),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  })
}
