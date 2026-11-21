import { api, isApiError } from '@/lib/api-client'
import { usesBackend } from '@/lib/backend-config'

export const DISPATCHER_PAYROLL_CAPABILITIES = { server: usesBackend('payroll') } as const

export type DispatcherPayrollRate = {
  readonly id: number
  readonly effectiveFrom: string
  readonly baseSalaryVnd: number
  readonly overtimeVndPerHour: number
  readonly overtimeHoursPerDay: number
  readonly overtimeDaysPerMonth: number
  readonly kpiAmountVnd: number
  readonly periodStatus?: 'DRAFT' | 'LOCKED' | null
}

export type DispatcherPayrollSummary = {
  readonly dispatcherId: number
  readonly dispatcherName: string
  readonly baseSalaryVnd: number
  readonly overtimeDays: number
  readonly overtimeAmountVnd: number
  readonly kpiAmountVnd: number
  readonly totalSalaryVnd: number
}

export type DispatcherPayrollPeriod = {
  readonly period: string
  readonly status: 'DRAFT' | 'LOCKED'
  readonly kpiAmountVnd?: number
  readonly dispatchers: readonly DispatcherPayrollSummary[]
}

type DispatcherStatementBase = {
  readonly period: string
  readonly dispatcherId: number
  readonly dispatcherName: string
}

export type DispatcherPayrollStatement =
  | (DispatcherStatementBase & {
      readonly calculated: true
      readonly status: 'DRAFT' | 'LOCKED'
      readonly baseSalaryVnd: number
      readonly overtimeVndPerHour: number
      readonly overtimeHoursPerDay: number
      readonly overtimeDays: number
      readonly overtimeAmountVnd: number
      readonly kpiAmountVnd: number
      readonly totalSalaryVnd: number
    })
  | (DispatcherStatementBase & {
      readonly calculated: false
      readonly status: 'DRAFT' | 'LOCKED' | null
    })

export type DispatcherPayrollRateInput = Omit<DispatcherPayrollRate, 'id' | 'periodStatus'>

export function kpiBonusForPeriod(
  period: string,
  rates: readonly DispatcherPayrollRate[],
  periodKpiAmountVnd?: number,
): number {
  const fromPeriod = Number(periodKpiAmountVnd ?? 0)
  if (fromPeriod > 0) return fromPeriod
  const applicable = rates
    .filter((rate) => rate.effectiveFrom.slice(0, 7) <= period)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0]
  return Number(applicable?.kpiAmountVnd ?? 0)
}

export type SetDispatcherBaseSalaryInput = {
  readonly dispatcherId: number
  readonly effectiveFrom: string
  readonly baseSalaryVnd: number
}

export type DispatcherPayrollLineInput = {
  readonly overtimeDays: number
  readonly kpiAmountVnd: number
}

export function fetchDispatcherPayrollRates(): Promise<DispatcherPayrollRate[]> {
  return api().get('/api/company/dispatcher-payroll/settings')
}

export function createDispatcherPayrollRate(input: DispatcherPayrollRateInput): Promise<DispatcherPayrollRate> {
  return api().put('/api/company/dispatcher-payroll/settings', { body: input })
}

export async function fetchDispatcherPayrollPeriod(period: string): Promise<DispatcherPayrollPeriod | null> {
  try {
    return await api().get(`/api/company/dispatcher-payroll/periods/${encodeURIComponent(period)}`)
  } catch (error) {
    if (isApiError(error) && error.code === 'PAYROLL_PERIOD_NOT_FOUND') return null
    throw error
  }
}

export function calculateDispatcherPayrollPeriod(period: string): Promise<DispatcherPayrollPeriod> {
  return api().post(`/api/company/dispatcher-payroll/periods/${encodeURIComponent(period)}/calculate`)
}

export function lockDispatcherPayrollPeriod(period: string): Promise<DispatcherPayrollPeriod> {
  return api().post(`/api/company/dispatcher-payroll/periods/${encodeURIComponent(period)}/lock`)
}

export function unlockDispatcherPayrollPeriod(period: string): Promise<DispatcherPayrollPeriod> {
  return api().post(`/api/company/dispatcher-payroll/periods/${encodeURIComponent(period)}/unlock`)
}

export function deleteDraftDispatcherPayrollPeriod(period: string): Promise<void> {
  return api().delete(`/api/company/dispatcher-payroll/periods/${encodeURIComponent(period)}`)
}

export function fetchDispatcherPayrollStatement(period: string, dispatcherId: string): Promise<DispatcherPayrollStatement> {
  return api().get(
    `/api/company/dispatcher-payroll/periods/${encodeURIComponent(period)}/dispatchers/${encodeURIComponent(dispatcherId)}`,
  )
}

export function updateDispatcherPayrollLine(
  period: string,
  dispatcherId: number,
  input: DispatcherPayrollLineInput,
): Promise<DispatcherPayrollPeriod> {
  return api().put(`/api/company/dispatcher-payroll/periods/${encodeURIComponent(period)}/dispatchers/${dispatcherId}`, {
    body: input,
  })
}

export function setDispatcherBaseSalary(input: SetDispatcherBaseSalaryInput): Promise<unknown> {
  return api().put(`/api/company/dispatcher-payroll/dispatchers/${input.dispatcherId}/base-salary`, {
    body: {
      effectiveFrom: input.effectiveFrom,
      baseSalaryVnd: input.baseSalaryVnd,
    },
  })
}

export function fetchOwnDispatcherPayroll(period: string): Promise<DispatcherPayrollStatement> {
  return api().get('/api/dispatcher/payroll', { query: { period } })
}
