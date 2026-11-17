import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { PAYROLL_CAPABILITIES } from './payroll-api'
import {
  calculatePayrollPeriod,
  createPayrollRate,
  deleteDraftPayrollPeriod,
  fetchPayrollDriverStatement,
  fetchPayrollPeriod,
  fetchPayrollRates,
  fetchTripPayrollDrivers,
  lockPayrollPeriod,
  setDriverBaseSalary,
  setTripPayrollDrivers,
  type PayrollRateInput,
  type SetDriverBaseSalaryInput,
} from './payroll-api'

const KEY = ['payroll'] as const
const RATES_KEY = [...KEY, 'rates'] as const
const periodKey = (period: string) => [...KEY, 'period', period] as const
const statementKey = (period: string, driverId: string | null) => [...KEY, 'statement', period, driverId] as const
const tripDriversKey = (tripId: number) => [...KEY, 'trip-drivers', tripId] as const

export function usePayrollRatesQuery() {
  return useQuery({ queryKey: RATES_KEY, queryFn: fetchPayrollRates, enabled: PAYROLL_CAPABILITIES.server, staleTime: 0 })
}

export function usePayrollPeriodQuery(period: string) {
  return useQuery({ queryKey: periodKey(period), queryFn: () => fetchPayrollPeriod(period), enabled: PAYROLL_CAPABILITIES.server, staleTime: 0 })
}

export function usePayrollDriverStatementQuery(period: string, driverId: string | null) {
  return useQuery({
    queryKey: statementKey(period, driverId),
    queryFn: () => fetchPayrollDriverStatement(period, driverId as string),
    enabled: PAYROLL_CAPABILITIES.server && driverId !== null,
    staleTime: 0,
  })
}

export function useTripPayrollDriversQuery(tripId: number) {
  return useQuery({
    queryKey: tripDriversKey(tripId),
    queryFn: () => fetchTripPayrollDrivers(tripId),
    enabled: PAYROLL_CAPABILITIES.server,
    staleTime: 0,
  })
}

export function useCreatePayrollRateMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: PayrollRateInput) => createPayrollRate(input),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  })
}

export function useCalculatePayrollPeriodMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: calculatePayrollPeriod,
    onSuccess: (period) => {
      client.setQueryData(periodKey(period.period), period)
      return client.invalidateQueries({ queryKey: [...KEY, 'statement', period.period] })
    },
  })
}

export function useLockPayrollPeriodMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: lockPayrollPeriod,
    onSuccess: (period) => {
      client.setQueryData(periodKey(period.period), period)
      return client.invalidateQueries({ queryKey: [...KEY, 'statement', period.period] })
    },
  })
}

export function useDeleteDraftPayrollPeriodMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: deleteDraftPayrollPeriod,
    onSuccess: async (_result, period) => {
      await client.cancelQueries({ queryKey: periodKey(period) })
      client.setQueryData(periodKey(period), null)
      await client.invalidateQueries({ queryKey: [...KEY, 'statement', period] })
    },
  })
}

export function useSetTripPayrollDriversMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ tripId, driverIds }: { readonly tripId: number; readonly driverIds: readonly number[] }) =>
      setTripPayrollDrivers(tripId, driverIds),
    onSuccess: (_shares, { tripId }) => {
      void client.invalidateQueries({ queryKey: tripDriversKey(tripId) })
      return client.invalidateQueries({ queryKey: KEY })
    },
  })
}

export function useSetDriverBaseSalaryMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: SetDriverBaseSalaryInput) => setDriverBaseSalary(input),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  })
}
