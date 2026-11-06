/**
 * Hàm → endpoint backend của thẻ "Xác nhận tay chờ duyệt" khi nhóm `driver` nối backend (xác nhận tay khi dỡ do tài xế gửi lên máy chủ):
 *   fetchServerManualConfirmations → GET /api/trips/{id}/manual-confirmations
 *   approveServerManualConfirmation → POST /api/trips/{id}/manual-confirmations/{cid}/approve
 *   rejectServerManualConfirmation  → POST /api/trips/{id}/manual-confirmations/{cid}/reject
 */
import { api, type ApiClient } from '@/lib/api-client'
import { usesBackend } from '@/lib/backend-config'
import { isoFromBackend } from '@/lib/backend-time'
import { MANUAL_CONFIRM_REASONS, type ManualConfirmReason } from '@/lib/mock-db'
import type { ManualConfirmRow } from './manual-confirm-api'

/** Xác nhận tay nằm ở máy chủ khi luồng tài xế nối backend: Chi tiết chuyến của máy chủ có thẻ này. */
export const SERVER_MANUAL_CONFIRMS = usesBackend('driver')

/** Một xác nhận tay của máy chủ (`ManualConfirmationResponse`); mốc giờ là `LocalDateTime` giờ Việt Nam. */
type ManualConfirmationDto = {
  readonly id: number
  readonly stopSequence: number | null
  readonly packageId: number | null
  readonly packageCode: string | null
  readonly trackingBarcode: string | null
  readonly packageName: string | null
  readonly reason: string | null
  readonly note: string | null
  readonly requestedByName: string | null
  readonly requestedAt: string | null
}

const reasonOf = (value: string | null): ManualConfirmReason => MANUAL_CONFIRM_REASONS.find((reason) => reason === value) ?? 'OTHER'

/** Dòng của thẻ: mã đứng đầu là mã in trên nhãn (mã của bên gửi, không thì mã vạch, không thì mã của kho kiện). */
export function manualConfirmRowOf(dto: ManualConfirmationDto): ManualConfirmRow {
  const code = dto.packageCode?.trim() || dto.trackingBarcode?.trim() || (dto.packageId === null ? '' : String(dto.packageId))
  return {
    id: String(dto.id),
    context: 'UNLOADING',
    stopNumber: dto.stopSequence ?? undefined,
    packageInstanceId: code,
    packageName: dto.packageName ?? '',
    reason: reasonOf(dto.reason),
    note: dto.note?.trim() || undefined,
    at: dto.requestedAt ? isoFromBackend(dto.requestedAt) : new Date(0).toISOString(),
    senderName: dto.requestedByName,
  }
}

const base = (tripId: string) => `/api/trips/${encodeURIComponent(tripId)}/manual-confirmations`

/** Xác nhận tay còn chờ duyệt của chuyến (máy chủ chỉ trả khi chuyến Đang vận chuyển), theo thứ tự gửi. */
// GET /api/trips/{id}/manual-confirmations
export async function fetchServerManualConfirmations(tripId: string, client: () => ApiClient = api): Promise<ManualConfirmRow[]> {
  const rows = await client().get<readonly ManualConfirmationDto[] | null>(base(tripId))
  return (rows ?? []).map(manualConfirmRowOf)
}

/** Duyệt: kiện giữ kết quả đã dỡ. */
// POST /api/trips/{id}/manual-confirmations/{cid}/approve
export async function approveServerManualConfirmation(tripId: string, confirmationId: string, client: () => ApiClient = api): Promise<void> {
  await client().post<ManualConfirmationDto>(`${base(tripId)}/${encodeURIComponent(confirmationId)}/approve`)
}

/** Từ chối kèm lý do: kiện về chưa dỡ, tài xế phải đối chiếu lại. */
// POST /api/trips/{id}/manual-confirmations/{cid}/reject
export async function rejectServerManualConfirmation(tripId: string, confirmationId: string, reason: string, client: () => ApiClient = api): Promise<void> {
  await client().post<ManualConfirmationDto>(`${base(tripId)}/${encodeURIComponent(confirmationId)}/reject`, { body: { reason } })
}
