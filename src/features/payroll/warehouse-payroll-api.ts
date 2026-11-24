import { api, isApiError } from '@/lib/api-client'
import { usesBackend } from '@/lib/backend-config'

import {
  fromRateDto,
  fromStatementDto,
  fromSummaryDto,
  type WarehousePayrollPeriodDto,
  type WarehousePayrollRateDto,
  type WarehousePayrollStatementDto,
} from './warehouse-payroll-dto'

/**
 * Bảng lương nhân viên kho — chỉ có ở máy chủ (nhóm `payroll`), như lương tài xế và điều phối; kho mẫu không có bảng lương.
 *
 * | Hàm                                  | Endpoint                                                              |
 * |--------------------------------------|-----------------------------------------------------------------------|
 * | fetchWarehousePayrollRates           | GET /api/company/warehouse-payroll/settings                           |
 * | createWarehousePayrollRate           | PUT /api/company/warehouse-payroll/settings                           |
 * | setWarehouseWorkerBaseSalary         | PUT /api/company/warehouse-payroll/workers/{workerId}/base-salary     |
 * | fetchWarehousePayrollPeriod          | GET /api/company/warehouse-payroll/periods/{period}                   |
 * | calculateWarehousePayrollPeriod      | POST /api/company/warehouse-payroll/periods/{period}/calculate        |
 * | lockWarehousePayrollPeriod           | POST /api/company/warehouse-payroll/periods/{period}/lock             |
 * | unlockWarehousePayrollPeriod         | POST /api/company/warehouse-payroll/periods/{period}/unlock           |
 * | deleteDraftWarehousePayrollPeriod    | DELETE /api/company/warehouse-payroll/periods/{period}                |
 * | fetchWarehousePayrollStatement       | GET /api/company/warehouse-payroll/periods/{period}/workers/{workerId}|
 * | fetchOwnWarehousePayroll             | GET /api/warehouse/payroll?period=                                    |
 */
export const WAREHOUSE_PAYROLL_CAPABILITIES = { server: usesBackend('payroll') } as const

export type PayrollPeriodStatus = 'DRAFT' | 'LOCKED'

export type WarehousePayrollRate = {
  readonly id: string
  readonly effectiveFrom: string
  readonly baseSalaryVnd: number
  readonly rateVndPerKg: number
  readonly kpiTargetKg: number | null
  readonly kpiBonusVnd: number
  readonly periodStatus: PayrollPeriodStatus | null
}

export type WarehousePayrollSummary = {
  readonly workerId: string
  readonly workerName: string
  readonly baseSalaryVnd: number
  readonly loadedPackages: number
  readonly loadedKg: number
  readonly loadedAmountVnd: number
  readonly kpiAchieved: boolean
  readonly kpiBonusVnd: number
  readonly totalSalaryVnd: number
}

export type WarehousePayrollPeriod = {
  readonly period: string
  readonly status: PayrollPeriodStatus
  readonly workers: readonly WarehousePayrollSummary[]
}

export type WarehousePayrollTripLine = {
  readonly tripId: string
  readonly tripCode: string
  /** Ngày xếp xong (ISO, giữa ngày giờ Việt Nam để ngày không lệch theo múi giờ của máy). */
  readonly loadedAt: string
  readonly loadedPackages: number
  readonly loadedKg: number
}

type StatementBase = {
  readonly period: string
  readonly workerId: string
  readonly workerName: string
}

/** Phiếu lương một nhân viên kho: đã tính thì đủ số; chưa tính (hoặc nhân viên xem kỳ chưa chốt) chỉ còn lương cứng nếu có. */
export type WarehousePayrollStatement =
  | (StatementBase & {
      readonly calculated: true
      readonly status: PayrollPeriodStatus
      readonly baseSalaryVnd: number
      readonly loadedPackages: number
      readonly loadedKg: number
      readonly rateVndPerKg: number
      readonly loadedAmountVnd: number
      readonly kpiTargetKg: number | null
      readonly kpiAchieved: boolean
      readonly kpiBonusVnd: number
      readonly totalSalaryVnd: number
      readonly trips: readonly WarehousePayrollTripLine[]
    })
  | (StatementBase & {
      readonly calculated: false
      readonly status: PayrollPeriodStatus | null
      readonly baseSalaryVnd: number | null
    })

export type WarehousePayrollRateInput = {
  /** Ngày đầu tháng `yyyy-MM-01`. */
  readonly effectiveFrom: string
  readonly baseSalaryVnd: number
  readonly rateVndPerKg: number
  /** `null` là công ty không dùng KPI cho nhân viên kho. */
  readonly kpiTargetKg: number | null
  readonly kpiBonusVnd: number | null
}

export type SetWarehouseBaseSalaryInput = {
  readonly workerId: string
  readonly effectiveFrom: string
  readonly baseSalaryVnd: number
}

const BASE = '/api/company/warehouse-payroll'
const periodPath = (period: string) => `${BASE}/periods/${encodeURIComponent(period)}`

function fromPeriodDto(dto: WarehousePayrollPeriodDto): WarehousePayrollPeriod {
  return { period: dto.period, status: dto.status, workers: dto.workers.map(fromSummaryDto) }
}

// GET /api/company/warehouse-payroll/settings
export async function fetchWarehousePayrollRates(): Promise<WarehousePayrollRate[]> {
  const rates = await api().get<WarehousePayrollRateDto[]>(`${BASE}/settings`)
  return rates.map(fromRateDto)
}

// PUT /api/company/warehouse-payroll/settings
export async function createWarehousePayrollRate(input: WarehousePayrollRateInput): Promise<WarehousePayrollRate> {
  const usesKpi = input.kpiTargetKg != null
  const rate = await api().put<WarehousePayrollRateDto>(`${BASE}/settings`, {
    body: {
      effectiveFrom: input.effectiveFrom,
      baseSalaryVnd: input.baseSalaryVnd,
      rateVndPerKg: input.rateVndPerKg,
      kpiTargetKg: usesKpi ? input.kpiTargetKg : null,
      kpiBonusVnd: usesKpi ? input.kpiBonusVnd : null,
    },
  })
  return fromRateDto(rate)
}

// PUT /api/company/warehouse-payroll/workers/{workerId}/base-salary
export async function setWarehouseWorkerBaseSalary(input: SetWarehouseBaseSalaryInput): Promise<void> {
  await api().put(`${BASE}/workers/${encodeURIComponent(input.workerId)}/base-salary`, {
    body: { effectiveFrom: input.effectiveFrom, baseSalaryVnd: input.baseSalaryVnd },
  })
}

// GET /api/company/warehouse-payroll/periods/{period}
export async function fetchWarehousePayrollPeriod(period: string): Promise<WarehousePayrollPeriod | null> {
  try {
    return fromPeriodDto(await api().get<WarehousePayrollPeriodDto>(periodPath(period)))
  } catch (error) {
    if (isApiError(error) && error.code === 'PAYROLL_PERIOD_NOT_FOUND') return null
    throw error
  }
}

// POST /api/company/warehouse-payroll/periods/{period}/calculate
export async function calculateWarehousePayrollPeriod(period: string): Promise<WarehousePayrollPeriod> {
  return fromPeriodDto(await api().post<WarehousePayrollPeriodDto>(`${periodPath(period)}/calculate`))
}

// POST /api/company/warehouse-payroll/periods/{period}/lock
export async function lockWarehousePayrollPeriod(period: string): Promise<WarehousePayrollPeriod> {
  return fromPeriodDto(await api().post<WarehousePayrollPeriodDto>(`${periodPath(period)}/lock`))
}

// POST /api/company/warehouse-payroll/periods/{period}/unlock
export async function unlockWarehousePayrollPeriod(period: string): Promise<WarehousePayrollPeriod> {
  return fromPeriodDto(await api().post<WarehousePayrollPeriodDto>(`${periodPath(period)}/unlock`))
}

// DELETE /api/company/warehouse-payroll/periods/{period}
export async function deleteDraftWarehousePayrollPeriod(period: string): Promise<void> {
  await api().delete(periodPath(period))
}

// GET /api/company/warehouse-payroll/periods/{period}/workers/{workerId}
export async function fetchWarehousePayrollStatement(period: string, workerId: string): Promise<WarehousePayrollStatement> {
  const dto = await api().get<WarehousePayrollStatementDto>(`${periodPath(period)}/workers/${encodeURIComponent(workerId)}`)
  return fromStatementDto(dto)
}

// GET /api/warehouse/payroll?period=
export async function fetchOwnWarehousePayroll(period: string): Promise<WarehousePayrollStatement> {
  const dto = await api().get<WarehousePayrollStatementDto>('/api/warehouse/payroll', { query: { period } })
  return fromStatementDto(dto)
}
