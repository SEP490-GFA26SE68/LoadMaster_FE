import { isoFromBackend } from '@/lib/backend-time'

import type {
  PayrollPeriodStatus,
  WarehousePayrollRate,
  WarehousePayrollStatement,
  WarehousePayrollSummary,
  WarehousePayrollTripLine,
} from './warehouse-payroll-api'

/** DTO của bảng lương kho trên máy chủ — chỉ `warehouse-payroll-api.ts` dùng. Mã số đổi thành chuỗi, tiền và kg (BigDecimal) thành số. */

type Decimal = number | string

export type WarehousePayrollRateDto = {
  readonly id: number
  readonly effectiveFrom: string
  readonly baseSalaryVnd: Decimal
  readonly rateVndPerKg: Decimal
  readonly kpiTargetKg?: Decimal | null
  readonly kpiBonusVnd?: Decimal | null
  readonly periodStatus?: PayrollPeriodStatus | null
}

export type WarehousePayrollSummaryDto = {
  readonly workerId: number
  readonly workerName: string
  readonly baseSalaryVnd: Decimal
  readonly loadedPackages: number
  readonly loadedKg: Decimal
  readonly loadedAmountVnd: Decimal
  readonly kpiAchieved: boolean
  readonly kpiBonusVnd: Decimal
  readonly totalSalaryVnd: Decimal
}

export type WarehousePayrollPeriodDto = {
  readonly period: string
  readonly status: PayrollPeriodStatus
  readonly workers: readonly WarehousePayrollSummaryDto[]
}

export type WarehousePayrollTripLineDto = {
  readonly tripId: number
  readonly tripCode: string
  /** `LocalDate` `yyyy-MM-dd`. */
  readonly loadedDate: string
  readonly loadedPackages: number
  readonly loadedKg: Decimal
}

/** `@JsonInclude(NON_NULL)`: trường rỗng bị bỏ hẳn; kỳ chưa chốt chỉ có `calculated`, `period`, `status`, người và lương cứng. */
export type WarehousePayrollStatementDto = {
  readonly calculated: boolean
  readonly period: string
  readonly status?: PayrollPeriodStatus
  readonly workerId: number
  readonly workerName: string
  readonly baseSalaryVnd?: Decimal
  readonly loadedPackages?: number
  readonly loadedKg?: Decimal
  readonly rateVndPerKg?: Decimal
  readonly loadedAmountVnd?: Decimal
  readonly kpiTargetKg?: Decimal
  readonly kpiAchieved?: boolean
  readonly kpiBonusVnd?: Decimal
  readonly totalSalaryVnd?: Decimal
  readonly trips?: readonly WarehousePayrollTripLineDto[]
}

const amount = (value: Decimal | null | undefined): number => Number(value ?? 0)

export function fromRateDto(dto: WarehousePayrollRateDto): WarehousePayrollRate {
  return {
    id: String(dto.id),
    effectiveFrom: dto.effectiveFrom,
    baseSalaryVnd: amount(dto.baseSalaryVnd),
    rateVndPerKg: amount(dto.rateVndPerKg),
    kpiTargetKg: dto.kpiTargetKg == null ? null : Number(dto.kpiTargetKg),
    kpiBonusVnd: amount(dto.kpiBonusVnd),
    periodStatus: dto.periodStatus ?? null,
  }
}

export function fromSummaryDto(dto: WarehousePayrollSummaryDto): WarehousePayrollSummary {
  return {
    workerId: String(dto.workerId),
    workerName: dto.workerName,
    baseSalaryVnd: amount(dto.baseSalaryVnd),
    loadedPackages: dto.loadedPackages,
    loadedKg: amount(dto.loadedKg),
    loadedAmountVnd: amount(dto.loadedAmountVnd),
    kpiAchieved: dto.kpiAchieved,
    kpiBonusVnd: amount(dto.kpiBonusVnd),
    totalSalaryVnd: amount(dto.totalSalaryVnd),
  }
}

function fromTripLineDto(dto: WarehousePayrollTripLineDto): WarehousePayrollTripLine {
  return {
    tripId: String(dto.tripId),
    tripCode: dto.tripCode,
    loadedAt: isoFromBackend(`${dto.loadedDate}T12:00`),
    loadedPackages: dto.loadedPackages,
    loadedKg: amount(dto.loadedKg),
  }
}

export function fromStatementDto(dto: WarehousePayrollStatementDto): WarehousePayrollStatement {
  const base = { period: dto.period, workerId: String(dto.workerId), workerName: dto.workerName }
  if (!dto.calculated || dto.status == null) {
    return { ...base, calculated: false, status: dto.status ?? null, baseSalaryVnd: dto.baseSalaryVnd == null ? null : Number(dto.baseSalaryVnd) }
  }
  return {
    ...base,
    calculated: true,
    status: dto.status,
    baseSalaryVnd: amount(dto.baseSalaryVnd),
    loadedPackages: dto.loadedPackages ?? 0,
    loadedKg: amount(dto.loadedKg),
    rateVndPerKg: amount(dto.rateVndPerKg),
    loadedAmountVnd: amount(dto.loadedAmountVnd),
    kpiTargetKg: dto.kpiTargetKg == null ? null : Number(dto.kpiTargetKg),
    kpiAchieved: dto.kpiAchieved ?? false,
    kpiBonusVnd: amount(dto.kpiBonusVnd),
    totalSalaryVnd: amount(dto.totalSalaryVnd),
    trips: (dto.trips ?? []).map(fromTripLineDto),
  }
}
