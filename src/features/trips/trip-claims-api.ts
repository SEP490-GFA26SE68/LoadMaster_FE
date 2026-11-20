/**
 * Hàm → endpoint backend của phiếu xin chuyến:
 *   fetchTripClaims → GET /api/trips/{tripId}/claims
 *   fetchPendingTripClaims → GET /api/trip-claims?status=PENDING
 *   approveTripClaim → POST /api/trips/{tripId}/claims/{claimId}/approve
 *   rejectTripClaim → POST /api/trips/{tripId}/claims/{claimId}/reject
 */
import { api, type ApiClient } from '@/lib/api-client'
import { isoFromBackend } from '@/lib/backend-time'

export type TripClaimStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

/** DTO hàng đợi phiếu đang chờ, do máy chủ trả về. */
type PendingTripClaimDto = {
  readonly claimId: number
  readonly tripId: number
  readonly tripCode: string | null
  readonly tripName: string | null
  readonly departureTime: string | null
  readonly originWarehouse: string | null
  readonly stopCount: number
  readonly driverUserId: number
  readonly driverName: string
  readonly driverPhone: string | null
  readonly note: string | null
  readonly createdAt: string
}

/** Dòng hàng đợi đã đổi ID và mốc giờ sang kiểu của app. */
export type PendingTripClaimRow = {
  readonly claimId: string
  readonly tripId: string
  readonly tripCode: string | null
  readonly tripName: string | null
  readonly departureTime: string | null
  readonly originWarehouse: string | null
  readonly stopCount: number
  readonly driverUserId: string
  readonly driverName: string
  readonly driverPhone: string | null
  readonly note: string | undefined
  readonly createdAt: string
}

/** `TripClaimResponse` của máy chủ; thời gian LocalDateTime là giờ Việt Nam. */
type TripClaimDto = {
  readonly id: number
  readonly tripId: number
  readonly driverUserId: number
  readonly driverName: string
  readonly driverPhone: string | null
  readonly status: TripClaimStatus
  readonly note: string | null
  readonly createdAt: string | null
  readonly decidedById: number | null
  readonly decidedByName: string | null
  readonly decidedAt: string | null
  readonly rejectReason: string | null
}

/** Dòng phiếu của ứng dụng; DTO backend không đi ra khỏi lớp API. */
export type TripClaimRow = {
  readonly id: string
  readonly tripId: string
  readonly driverUserId: string
  readonly driverName: string
  readonly driverPhone: string | null
  readonly status: TripClaimStatus
  readonly note: string | undefined
  readonly createdAt: string
  readonly decidedById: string | null
  readonly decidedByName: string | null
  readonly decidedAt: string | null
  readonly rejectReason: string | null
}

const claimsPath = (tripId: string) => `/api/trips/${encodeURIComponent(tripId)}/claims`
const missingTime = new Date(0).toISOString()

function tripClaimRowOf(dto: TripClaimDto): TripClaimRow {
  return {
    id: String(dto.id),
    tripId: String(dto.tripId),
    driverUserId: String(dto.driverUserId),
    driverName: dto.driverName,
    driverPhone: dto.driverPhone?.trim() || null,
    status: dto.status,
    note: dto.note?.trim() || undefined,
    createdAt: dto.createdAt ? isoFromBackend(dto.createdAt) : missingTime,
    decidedById: dto.decidedById === null ? null : String(dto.decidedById),
    decidedByName: dto.decidedByName,
    decidedAt: dto.decidedAt ? isoFromBackend(dto.decidedAt) : null,
    rejectReason: dto.rejectReason,
  }
}

function pendingTripClaimRowOf(dto: PendingTripClaimDto): PendingTripClaimRow {
  return {
    claimId: String(dto.claimId),
    tripId: String(dto.tripId),
    tripCode: dto.tripCode?.trim() || null,
    tripName: dto.tripName?.trim() || null,
    departureTime: dto.departureTime ? isoFromBackend(dto.departureTime) : null,
    originWarehouse: dto.originWarehouse?.trim() || null,
    stopCount: dto.stopCount,
    driverUserId: String(dto.driverUserId),
    driverName: dto.driverName,
    driverPhone: dto.driverPhone?.trim() || null,
    note: dto.note?.trim() || undefined,
    createdAt: isoFromBackend(dto.createdAt),
  }
}

/** Mọi phiếu của chuyến, mới nhất trước. Thẻ chỉ hiển thị trạng thái PENDING. */
// GET /api/trips/{tripId}/claims
export async function fetchTripClaims(tripId: string, client: () => ApiClient = api): Promise<TripClaimRow[]> {
  const rows = await client().get<readonly TripClaimDto[] | null>(claimsPath(tripId))
  return (rows ?? []).map(tripClaimRowOf)
}

/** Mọi phiếu đang chờ của công ty; máy chủ trả phiếu gửi sớm nhất trước. */
// GET /api/trip-claims?status=PENDING
export async function fetchPendingTripClaims(client: () => ApiClient = api): Promise<PendingTripClaimRow[]> {
  const rows = await client().get<readonly PendingTripClaimDto[] | null>('/api/trip-claims', { query: { status: 'PENDING' } })
  return (rows ?? []).map(pendingTripClaimRowOf)
}

/** Duyệt phiếu: máy chủ gán tài xế vào chuyến và tự từ chối các phiếu còn lại. */
// POST /api/trips/{tripId}/claims/{claimId}/approve
export async function approveTripClaim(tripId: string, claimId: string, client: () => ApiClient = api): Promise<void> {
  await client().post<TripClaimDto>(`${claimsPath(tripId)}/${encodeURIComponent(claimId)}/approve`)
}

/** Từ chối phiếu kèm lý do bắt buộc, tối đa 300 ký tự. */
// POST /api/trips/{tripId}/claims/{claimId}/reject
export async function rejectTripClaim(tripId: string, claimId: string, reason: string, client: () => ApiClient = api): Promise<void> {
  await client().post<TripClaimDto>(`${claimsPath(tripId)}/${encodeURIComponent(claimId)}/reject`, { body: { reason } })
}
