/**
 * Hàm → endpoint backend của thẻ "Kiện kho báo thiếu" khi nhóm `warehouse` nối backend (kho báo thiếu lúc soạn hàng trên máy chủ):
 *   fetchServerStagingShortages → GET /api/trips/{id}/staging-shortages
 *   resolveServerStagingShortage → POST /api/trips/{id}/staging-shortages/{shortageId}/resolve
 */
import { api, type ApiClient } from '@/lib/api-client'
import { usesBackend } from '@/lib/backend-config'
import { isoFromBackend } from '@/lib/backend-time'
import type { ShortageDecision } from '@/lib/mock-db'
import type { ShortageRow } from './shortage-api'

/** Báo thiếu nằm ở máy chủ khi luồng kho nối backend: Chi tiết chuyến của máy chủ có thẻ này. */
export const SERVER_SHORTAGES = usesBackend('warehouse')

/** Một báo thiếu của máy chủ (`StagingShortageResponse`); mốc giờ là `LocalDateTime` giờ Việt Nam. */
type StagingShortageDto = {
  readonly id: number
  readonly packageId: number | null
  readonly packageCode: string | null
  readonly trackingBarcode: string | null
  readonly packageName: string | null
  readonly stopSequence: number | null
  readonly reportedByName: string | null
  readonly reportedAt: string | null
}

/** Dòng của thẻ: mã đứng đầu là mã in trên nhãn (mã của bên gửi, không thì mã vạch, không thì mã của kho kiện). */
export function shortageRowOf(dto: StagingShortageDto): ShortageRow {
  const code = dto.packageCode?.trim() || dto.trackingBarcode?.trim() || (dto.packageId === null ? '' : String(dto.packageId))
  return {
    id: String(dto.id),
    packageInstanceId: code,
    packageName: dto.packageName ?? '',
    packageCode: code,
    stopNumber: dto.stopSequence ?? null,
    at: dto.reportedAt ? isoFromBackend(dto.reportedAt) : new Date(0).toISOString(),
    reporterName: dto.reportedByName?.trim() || null,
  }
}

const base = (tripId: string) => `/api/trips/${encodeURIComponent(tripId)}/staging-shortages`

/** Báo thiếu còn chờ quyết của chuyến (máy chủ chỉ trả khi chuyến Đang xếp hàng), theo thứ tự báo. */
// GET /api/trips/{id}/staging-shortages
export async function fetchServerStagingShortages(tripId: string, client: () => ApiClient = api): Promise<ShortageRow[]> {
  const rows = await client().get<readonly StagingShortageDto[] | null>(base(tripId))
  return (rows ?? []).map(shortageRowOf)
}

/** `KEEP_SEARCHING`: kho tìm tiếp. `DROP`: kiện rời chuyến, chuyến về Đã lập kế hoạch và phương án lỗi thời. */
// POST /api/trips/{id}/staging-shortages/{shortageId}/resolve
export async function resolveServerStagingShortage(tripId: string, shortageId: string, decision: ShortageDecision, client: () => ApiClient = api): Promise<void> {
  await client().post(`${base(tripId)}/${encodeURIComponent(shortageId)}/resolve`, { body: { decision } })
}
