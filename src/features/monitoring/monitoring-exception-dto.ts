import { REROUTE_ROUTES } from '@/domain/routing'
import { ApiError } from '@/lib/api-client'
import { isoFromBackend } from '@/lib/backend-time'
import {
  EXCEPTION_ESCALATIONS,
  TRIP_EXCEPTION_STATUSES,
  TRIP_EXCEPTION_TYPES,
  type RerouteChoice,
  type TripException,
  type TripReroute,
} from '@/lib/mock-db'
import type { LiveRerouteProposal } from './exceptions-api'

/**
 * DTO sự cố cấp chuyến và tuyến thay thế của `MonitoringController` backend, cùng hàm đổi sang kiểu của màn; chỉ `monitoring-dto.ts` và
 * `monitoring-backend-api.ts` import file này. Giá trị ngoài các tập của hợp đồng (loại, trạng thái sự cố, tuyến) là lỗi của máy chủ.
 */

export const pick = <T extends string>(values: readonly T[], value: string | null | undefined): T | undefined => values.find((item) => item === value)

function required<T extends string>(values: readonly T[], value: string | null | undefined): T {
  const found = pick(values, value)
  if (found === undefined) throw new ApiError('SERVER_ERROR')
  return found
}

export type TripExceptionDto = {
  readonly id: string
  readonly tripId?: string | null
  readonly type: string
  readonly description?: string | null
  readonly delayMinutes?: number | null
  readonly status: string
  readonly stopNumber?: number | null
  readonly reportedAt: string
  readonly reportedBy?: string | null
  readonly escalation?: { readonly reason?: string | null; readonly at?: string | null; readonly by?: string | null } | null
  readonly resolution?: { readonly at?: string | null; readonly by?: string | null; readonly note?: string | null } | null
}

type RerouteOptionDto = {
  readonly index: number
  readonly route: string
  readonly distanceKm: number
  readonly durationMinutes: number
  readonly extraMs?: number | null
  readonly eta: string
}

export type TripRerouteDto = RerouteOptionDto & {
  readonly stopNumber?: number | null
  readonly confirmedAt?: string | null
  readonly confirmedBy?: string | null
}

export type RerouteProposalDto = {
  readonly tripId: string
  readonly requestedAt: string
  readonly stopId: string | number
  readonly stopNumber: number
  readonly options?: readonly RerouteOptionDto[] | null
  readonly isMockResult?: boolean | null
}

export function exceptionOf(dto: TripExceptionDto): TripException {
  const reason = pick(EXCEPTION_ESCALATIONS, dto.escalation?.reason)
  const escalatedAt = dto.escalation?.at
  const resolution = dto.resolution
  return {
    id: dto.id,
    tripId: dto.tripId ?? '',
    type: required(TRIP_EXCEPTION_TYPES, dto.type),
    description: dto.description ?? '',
    delayMinutes: dto.delayMinutes ?? 0,
    status: required(TRIP_EXCEPTION_STATUSES, dto.status),
    ...(typeof dto.stopNumber === 'number' ? { stopNumber: dto.stopNumber } : {}),
    reportedAt: isoFromBackend(dto.reportedAt),
    reportedBy: dto.reportedBy ?? null,
    ...(reason && escalatedAt ? { escalation: { reason, at: isoFromBackend(escalatedAt), by: dto.escalation?.by ?? null } } : {}),
    ...(resolution?.at
      ? { resolution: { at: isoFromBackend(resolution.at), by: resolution.by ?? null, ...(resolution.note ? { note: resolution.note } : {}) } }
      : {}),
  }
}

function choiceOf(dto: RerouteOptionDto): RerouteChoice {
  return {
    index: dto.index,
    route: required(REROUTE_ROUTES, dto.route),
    distanceKm: dto.distanceKm,
    durationMinutes: dto.durationMinutes,
    extraMs: dto.extraMs ?? 0,
    eta: isoFromBackend(dto.eta),
  }
}

/** Tuyến đã chọn; `undefined` khi bản ghi thiếu giờ chọn hoặc số điểm. */
export function rerouteOf(dto: TripRerouteDto): TripReroute | undefined {
  if (!dto.confirmedAt || typeof dto.stopNumber !== 'number') return undefined
  return { ...choiceOf(dto), stopNumber: dto.stopNumber, confirmedAt: isoFromBackend(dto.confirmedAt), confirmedBy: dto.confirmedBy ?? null }
}

export function proposalOf(dto: RerouteProposalDto): LiveRerouteProposal {
  return {
    tripId: dto.tripId,
    requestedAt: isoFromBackend(dto.requestedAt),
    stopId: String(dto.stopId),
    stopNumber: dto.stopNumber,
    options: (dto.options ?? []).map(choiceOf),
    isMockResult: dto.isMockResult === true,
  }
}
