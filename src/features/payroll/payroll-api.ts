import { api, isApiError } from '@/lib/api-client'
import { usesBackend } from '@/lib/backend-config'

export const PAYROLL_CAPABILITIES = { server: usesBackend('payroll') } as const

export type PayrollRate = {
  readonly id: number
  readonly effectiveFrom: string
  readonly baseSalaryVnd: number
  readonly rateVndPerKg: number
  readonly commissionPercent: number
  readonly handlingFeeVndPerKg: number
  readonly handlingDriverPercent: number
}

export type PayrollDriverSummary = {
  readonly driverId: number
  readonly driverName: string
  readonly baseSalaryVnd: number
  readonly totalKg: number
  readonly kgAmountVnd: number
  readonly handlingAmountVnd: number
  readonly totalSalaryVnd: number
}

export type PayrollPeriod = {
  readonly period: string
  readonly status: 'DRAFT' | 'LOCKED'
  readonly drivers: readonly PayrollDriverSummary[]
}

export type PayrollTripLine = {
  readonly tripId: number
  readonly tripCode: string
  readonly planKg: number
  readonly sharePercent: number
  readonly allocatedKg: number
  readonly kgAmountVnd: number
  readonly handlingAmountVnd: number
  readonly totalAmountVnd: number
}

type PayrollDriverStatementBase = {
  readonly period: string
  readonly driverId: number
  readonly driverName: string
  readonly trips: readonly PayrollTripLine[]
}

export type PayrollDriverStatement =
  | (PayrollDriverStatementBase & {
      readonly calculated: true
      readonly status: 'DRAFT' | 'LOCKED'
      readonly baseSalaryVnd: number
      readonly totalKg: number
      readonly rateVndPerKg: number
      readonly kgAmountVnd: number
      readonly commissionPercent: number
      readonly handlingFeeVndPerKg: number
      readonly handlingDriverPercent: number
      readonly handlingAmountVnd: number
      readonly totalSalaryVnd: number
    })
  | (PayrollDriverStatementBase & {
      readonly calculated: false
      readonly status: 'DRAFT' | 'LOCKED' | null
    })

export type TripPayrollDriver = {
  readonly driverId: number
  readonly driverName: string
  readonly sharePercent: number
}

export type SetDriverBaseSalaryInput = {
  readonly driverId: number
  readonly effectiveFrom: string
  readonly baseSalaryVnd: number
}

export type DriverBaseSalaryResponse = {
  readonly id: number
  readonly driverId: number
  readonly driverName: string
  readonly effectiveFrom: string
  readonly baseSalaryVnd: number
}

export type PayrollRateInput = Omit<PayrollRate, 'id'>

// GET /api/company/payroll/settings
export function fetchPayrollRates(): Promise<PayrollRate[]> {
  return api().get('/api/company/payroll/settings')
}

// PUT /api/company/payroll/settings — appends a rate version effective from the given date.
export function createPayrollRate(input: PayrollRateInput): Promise<PayrollRate> {
  return api().put('/api/company/payroll/settings', { body: input })
}

// GET /api/company/payroll/periods/{period}
export async function fetchPayrollPeriod(period: string): Promise<PayrollPeriod | null> {
  try {
    return await api().get(`/api/company/payroll/periods/${encodeURIComponent(period)}`)
  } catch (error) {
    if (isApiError(error) && error.code === 'PAYROLL_PERIOD_NOT_FOUND') return null
    throw error
  }
}

// POST /api/company/payroll/periods/{period}/calculate
export function calculatePayrollPeriod(period: string): Promise<PayrollPeriod> {
  return api().post(`/api/company/payroll/periods/${encodeURIComponent(period)}/calculate`)
}

// POST /api/company/payroll/periods/{period}/lock
export function lockPayrollPeriod(period: string): Promise<PayrollPeriod> {
  return api().post(`/api/company/payroll/periods/${encodeURIComponent(period)}/lock`)
}

// DELETE /api/company/payroll/periods/{period}
export function deleteDraftPayrollPeriod(period: string): Promise<void> {
  return api().delete(`/api/company/payroll/periods/${encodeURIComponent(period)}`)
}

// GET /api/company/payroll/periods/{period}/drivers/{driverId}
export function fetchPayrollDriverStatement(period: string, driverId: string): Promise<PayrollDriverStatement> {
  return api().get(`/api/company/payroll/periods/${encodeURIComponent(period)}/drivers/${encodeURIComponent(driverId)}`)
}

// GET /api/company/payroll/trips/{tripId}/drivers
export function fetchTripPayrollDrivers(tripId: number): Promise<TripPayrollDriver[]> {
  return api().get(`/api/company/payroll/trips/${tripId}/drivers`)
}

// PUT /api/company/payroll/trips/{tripId}/drivers
export function setTripPayrollDrivers(tripId: number, driverIds: readonly number[]): Promise<TripPayrollDriver[]> {
  return api().put(`/api/company/payroll/trips/${tripId}/drivers`, { body: { driverIds } })
}

// PUT /api/company/payroll/drivers/{driverId}/base-salary
export function setDriverBaseSalary(input: SetDriverBaseSalaryInput): Promise<DriverBaseSalaryResponse> {
  return api().put(`/api/company/payroll/drivers/${input.driverId}/base-salary`, {
    body: {
      effectiveFrom: input.effectiveFrom,
      baseSalaryVnd: input.baseSalaryVnd,
    },
  })
}

export function nextMonthPeriod(from: Date = new Date()): string {
  const year = from.getMonth() === 11 ? from.getFullYear() + 1 : from.getFullYear()
  const month = from.getMonth() === 11 ? 1 : from.getMonth() + 2
  return `${year}-${String(month).padStart(2, '0')}`
}
