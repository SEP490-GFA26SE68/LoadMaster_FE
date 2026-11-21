import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  DISPATCHER_PAYROLL_CAPABILITIES,
  calculateDispatcherPayrollPeriod,
  createDispatcherPayrollRate,
  deleteDraftDispatcherPayrollPeriod,
  fetchDispatcherPayrollPeriod,
  fetchDispatcherPayrollRates,
  fetchDispatcherPayrollStatement,
  fetchOwnDispatcherPayroll,
  lockDispatcherPayrollPeriod,
  unlockDispatcherPayrollPeriod,
  setDispatcherBaseSalary,
  updateDispatcherPayrollLine,
  type DispatcherPayrollLineInput,
  type DispatcherPayrollRateInput,
  type SetDispatcherBaseSalaryInput,
} from './dispatcher-payroll-api'

const KEY = ['dispatcher-payroll'] as const
const RATES_KEY = [...KEY, 'rates'] as const
const periodKey = (period: string) => [...KEY, 'period', period] as const
const statementKey = (period: string, dispatcherId: string | null) => [...KEY, 'statement', period, dispatcherId] as const
const ownKey = (period: string) => [...KEY, 'own', period] as const

export function useDispatcherPayrollRatesQuery(enabled = true) {
  return useQuery({
    queryKey: RATES_KEY,
    queryFn: fetchDispatcherPayrollRates,
    enabled: DISPATCHER_PAYROLL_CAPABILITIES.server && enabled,
    staleTime: 0,
  })
}

export function useDispatcherPayrollPeriodQuery(period: string, enabled = true) {
  return useQuery({
    queryKey: periodKey(period),
    queryFn: () => fetchDispatcherPayrollPeriod(period),
    enabled: DISPATCHER_PAYROLL_CAPABILITIES.server && enabled && period.length === 7,
    staleTime: 0,
  })
}

export function useDispatcherPayrollStatementQuery(period: string, dispatcherId: string | null, enabled = true) {
  return useQuery({
    queryKey: statementKey(period, dispatcherId),
    queryFn: () => fetchDispatcherPayrollStatement(period, dispatcherId as string),
    enabled: DISPATCHER_PAYROLL_CAPABILITIES.server && enabled && dispatcherId !== null,
    staleTime: 0,
  })
}

export function useOwnDispatcherPayrollQuery(period: string) {
  return useQuery({
    queryKey: ownKey(period),
    queryFn: () => fetchOwnDispatcherPayroll(period),
    enabled: DISPATCHER_PAYROLL_CAPABILITIES.server && period.length === 7,
    staleTime: 0,
  })
}

export function useCreateDispatcherPayrollRateMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: DispatcherPayrollRateInput) => createDispatcherPayrollRate(input),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  })
}

export function useCalculateDispatcherPayrollPeriodMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: calculateDispatcherPayrollPeriod,
    onSuccess: (period) => {
      client.setQueryData(periodKey(period.period), period)
      return client.invalidateQueries({ queryKey: [...KEY, 'statement', period.period] })
    },
  })
}

export function useLockDispatcherPayrollPeriodMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: lockDispatcherPayrollPeriod,
    onSuccess: (period) => {
      client.setQueryData(periodKey(period.period), period)
      return client.invalidateQueries({ queryKey: KEY })
    },
  })
}

export function useUnlockDispatcherPayrollPeriodMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: unlockDispatcherPayrollPeriod,
    onSuccess: (period) => {
      client.setQueryData(periodKey(period.period), period)
      return client.invalidateQueries({ queryKey: KEY })
    },
  })
}

export function useDeleteDraftDispatcherPayrollPeriodMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: deleteDraftDispatcherPayrollPeriod,
    onSuccess: async (_result, period) => {
      await client.cancelQueries({ queryKey: periodKey(period) })
      client.setQueryData(periodKey(period), null)
      await client.invalidateQueries({ queryKey: [...KEY, 'statement', period] })
    },
  })
}

export function useUpdateDispatcherPayrollLineMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({
      period,
      dispatcherId,
      input,
    }: {
      readonly period: string
      readonly dispatcherId: number
      readonly input: DispatcherPayrollLineInput
    }) => updateDispatcherPayrollLine(period, dispatcherId, input),
    onSuccess: (result) => {
      client.setQueryData(periodKey(result.period), result)
      return client.invalidateQueries({ queryKey: [...KEY, 'statement', result.period] })
    },
  })
}

export function useSetDispatcherBaseSalaryMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: SetDispatcherBaseSalaryInput) => setDispatcherBaseSalary(input),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  })
}
