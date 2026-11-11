import type { DeadlineStatus } from '@/domain/routing'
import { api } from '@/lib/api-client'
import { isoFromBackend } from '@/lib/backend-time'
import type { TripExceptionStatus, TripExceptionType, VerifyContext } from '@/lib/mock-db'

/**
 * Hàm → endpoint (nhóm `trips`):
 *   fetchServerTripReport → GET /api/trips/{id}/report
 *
 * Báo cáo chuyến của máy chủ: chuyến đã giao, hoặc bị huỷ lúc đang vận chuyển (chuyến khác: `TRIP_REPORT_NOT_AVAILABLE`). Mọi số máy chủ
 * đếm từ dữ liệu kho và tài xế đã ghi, không MOCK RESULT; trường máy chủ không trả thì màn bỏ dòng đó. Mốc giờ `LocalDateTime` giờ Việt
 * Nam đổi sang ISO ở đây.
 */

type Moment = string | null | undefined

type ReportDto = {
  tripId: number
  tripCode: string
  tripName?: string | null
  status: string
  vehicleName?: string | null
  licensePlate?: string | null
  driverName?: string | null
  departureTime?: Moment
  completedAt?: Moment
  cancellation?: { reason?: string | null; fromStatus?: string | null } | null
  loading?: { startedAt?: Moment; completedAt?: Moment; sealNumber?: string | null; sealedAt?: Moment } | null
  overrideReason?: string | null
  stops?: StopDto[] | null
  packages?: { total: number; staged: number; loaded: number; damaged: number; delivered: number; returned: number; withIssue: number } | null
  verifications?: { step: string; label: number; manual: number }[] | null
  manualConfirmations?: ManualDto[] | null
  exceptions?: ExceptionDto[] | null
  reroutes?: RerouteDto[] | null
}

type StopDto = {
  stopId: number
  sequence?: number | null
  stopType?: string | null
  name?: string | null
  address?: string | null
  packageCount: number
  unloaded: number
  returned: number
  issues: number
  plannedArrival?: Moment
  actualArrival?: Moment
  deadline?: Moment
  plannedStatus?: string | null
  arrivedOnTime?: boolean | null
  completed: boolean
}

type ManualDto = {
  id: number
  step?: string | null
  packageCode?: string | null
  stopSequence?: number | null
  reason?: string | null
  note?: string | null
  status?: string | null
  requestedBy?: string | null
  requestedAt?: Moment
  decidedBy?: string | null
  decidedAt?: Moment
  decisionNote?: string | null
}

type ExceptionDto = {
  id: number
  type?: string | null
  description?: string | null
  delayMinutes?: number | null
  status?: string | null
  stopNumber?: number | null
  reportedBy?: string | null
  reportedAt?: Moment
  resolvedBy?: string | null
  resolvedAt?: Moment
  resolutionNote?: string | null
}

type RerouteDto = { stopNumber?: number | null; route?: string | null; distanceKm?: number | null; durationMinutes?: number | null; confirmedAt?: Moment }

export type ServerReportStop = {
  id: string
  number: number
  pickup: boolean
  name: string
  address: string
  planned: number
  unloaded: number
  returned: number
  issues: number
  plannedEta: string | null
  arrivedAt: string | null
  deadline: string | null
  plannedStatus: DeadlineStatus | null
  arrivedOnTime: boolean | null
  completed: boolean
}

export type ServerManualConfirm = {
  id: string
  step: VerifyContext | null
  packageCode: string
  stopNumber: number | null
  reason: 'LABEL_DAMAGED' | 'QR_UNREADABLE' | 'OTHER' | null
  note: string
  status: 'MANUAL_PENDING' | 'MANUAL_APPROVED' | 'MANUAL_REJECTED'
  requestedBy: string
  requestedAt: string | null
  decidedBy: string
  decidedAt: string | null
  decisionNote: string
}

export type ServerTripException = {
  id: string
  type: TripExceptionType
  description: string
  delayMinutes: number
  status: TripExceptionStatus
  stopNumber: number | null
  reportedBy: string
  reportedAt: string | null
  resolvedBy: string
  resolvedAt: string | null
  resolutionNote: string
}

export type ServerReroute = { stopNumber: number; route: string; distanceKm: number; durationMinutes: number; confirmedAt: string }

export type ServerTripReport = {
  tripCode: string
  tripName: string
  vehicle: { name: string; plate: string }
  driverName: string | null
  plannedDeparture: string | null
  completedAt: string | null
  cancellation: { reason: string; inTransit: boolean } | null
  loading: { startedAt: string | null; completedAt: string | null; seal: { number: string; at: string | null } | null } | null
  overrideReason: string | null
  stops: ServerReportStop[]
  packages: NonNullable<ReportDto['packages']> | null
  verifications: { step: VerifyContext; label: number; manual: number }[]
  manualConfirms: ServerManualConfirm[]
  exceptions: ServerTripException[]
  reroutes: ServerReroute[]
}

const iso = (value: Moment) => (value ? isoFromBackend(value) : null)
const text = (value: string | null | undefined) => value?.trim() ?? ''
const oneOf = <T extends string>(values: readonly T[], value: string | null | undefined): T | null =>
  values.includes(value as T) ? (value as T) : null

const STEPS: readonly VerifyContext[] = ['STAGING', 'LOADING', 'UNLOADING', 'PICKUP']
const PLANNED_STATUS: Readonly<Record<string, DeadlineStatus>> = { ON_TIME: 'OK', AT_RISK: 'AT_RISK', MISSED: 'MISSED' }
const CONFIRM_STATUS = { PENDING: 'MANUAL_PENDING', APPROVED: 'MANUAL_APPROVED', REJECTED: 'MANUAL_REJECTED' } as const
const EXCEPTION_TYPES: readonly TripExceptionType[] = ['TRAFFIC', 'ACCIDENT', 'ROAD_CONSTRUCTION', 'VEHICLE_BREAKDOWN', 'OTHER']
const EXCEPTION_STATUSES: readonly TripExceptionStatus[] = ['OPEN', 'ESCALATED', 'RESOLVED']

function stopOf(stop: StopDto, index: number): ServerReportStop {
  return {
    id: String(stop.stopId),
    number: stop.sequence ?? index + 1,
    pickup: stop.stopType === 'PICKUP',
    name: text(stop.name),
    address: text(stop.address),
    planned: stop.packageCount,
    unloaded: stop.unloaded,
    returned: stop.returned,
    issues: stop.issues,
    plannedEta: iso(stop.plannedArrival),
    arrivedAt: iso(stop.actualArrival),
    deadline: iso(stop.deadline),
    plannedStatus: stop.plannedStatus ? (PLANNED_STATUS[stop.plannedStatus] ?? null) : null,
    arrivedOnTime: stop.arrivedOnTime ?? null,
    completed: stop.completed,
  }
}

function manualOf(manual: ManualDto): ServerManualConfirm {
  return {
    id: String(manual.id),
    step: oneOf(STEPS, manual.step),
    packageCode: text(manual.packageCode),
    stopNumber: manual.stopSequence ?? null,
    reason: oneOf(['LABEL_DAMAGED', 'QR_UNREADABLE', 'OTHER'] as const, manual.reason),
    note: text(manual.note),
    status: CONFIRM_STATUS[manual.status as keyof typeof CONFIRM_STATUS] ?? 'MANUAL_PENDING',
    requestedBy: text(manual.requestedBy),
    requestedAt: iso(manual.requestedAt),
    decidedBy: text(manual.decidedBy),
    decidedAt: iso(manual.decidedAt),
    decisionNote: text(manual.decisionNote),
  }
}

function exceptionOf(exception: ExceptionDto): ServerTripException {
  return {
    id: String(exception.id),
    type: oneOf(EXCEPTION_TYPES, exception.type) ?? 'OTHER',
    description: text(exception.description),
    delayMinutes: exception.delayMinutes ?? 0,
    status: oneOf(EXCEPTION_STATUSES, exception.status) ?? 'OPEN',
    stopNumber: exception.stopNumber ?? null,
    reportedBy: text(exception.reportedBy),
    reportedAt: iso(exception.reportedAt),
    resolvedBy: text(exception.resolvedBy),
    resolvedAt: iso(exception.resolvedAt),
    resolutionNote: text(exception.resolutionNote),
  }
}

/** Tuyến thay thế thiếu số đo hay giờ chọn thì bỏ: câu của màn cần đủ cả bốn. */
function rerouteOf(reroute: RerouteDto): ServerReroute[] {
  const { stopNumber, route, distanceKm, durationMinutes, confirmedAt } = reroute
  if (stopNumber == null || !route || distanceKm == null || durationMinutes == null || !confirmedAt) return []
  return [{ stopNumber, route, distanceKm, durationMinutes, confirmedAt: isoFromBackend(confirmedAt) }]
}

export function serverTripReportOf(dto: ReportDto): ServerTripReport {
  const loading = dto.loading
  return {
    tripCode: dto.tripCode,
    tripName: text(dto.tripName),
    vehicle: { name: text(dto.vehicleName), plate: text(dto.licensePlate) },
    driverName: dto.driverName?.trim() || null,
    plannedDeparture: iso(dto.departureTime),
    completedAt: iso(dto.completedAt),
    cancellation: dto.cancellation
      ? { reason: text(dto.cancellation.reason), inTransit: dto.cancellation.fromStatus === 'IN_TRANSIT' }
      : null,
    loading: loading
      ? {
          startedAt: iso(loading.startedAt),
          completedAt: iso(loading.completedAt),
          seal: loading.sealNumber ? { number: loading.sealNumber, at: iso(loading.sealedAt) } : null,
        }
      : null,
    overrideReason: dto.overrideReason?.trim() || null,
    stops: (dto.stops ?? []).map(stopOf).toSorted((a, b) => a.number - b.number),
    packages: dto.packages ?? null,
    verifications: (dto.verifications ?? []).flatMap((row) => {
      const step = oneOf(STEPS, row.step)
      return step === null ? [] : [{ step, label: row.label, manual: row.manual }]
    }),
    manualConfirms: (dto.manualConfirmations ?? []).map(manualOf),
    exceptions: (dto.exceptions ?? []).map(exceptionOf),
    reroutes: (dto.reroutes ?? []).flatMap(rerouteOf),
  }
}

// GET /api/trips/{id}/report
export async function fetchServerTripReport(tripCode: string): Promise<ServerTripReport> {
  return serverTripReportOf(await api().get<ReportDto>(`/api/trips/${encodeURIComponent(tripCode)}/report`))
}
