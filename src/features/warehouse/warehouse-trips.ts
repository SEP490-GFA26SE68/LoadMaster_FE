import { latestApproved, missingIds, plannedStops, tripStatus, tripSubStatus, type Revision, type Trip } from '@/lib/mock-db'
import type { TripStatus, TripSubStatus } from '@/types/trip'

/** Giai đoạn của chuyến ở danh sách kho (D-46): đang xếp, chờ xếp, và bản duyệt lỗi thời chờ điều phối viên tối ưu lại và duyệt. */
export type WarehouseStage = 'loading' | 'waiting' | 'stale'

/** Một chuyến và các revision của nó theo thứ tự kho trả (cũ trước). */
export type TripRevisions = { readonly trip: Trip; readonly revisions: readonly Revision[] }

export type WarehouseTripRow = {
  readonly id: string
  readonly name: string
  /** Ngày chạy `YYYY-MM-DD`. */
  readonly scheduledDate: string
  /** Tên xe (có biển số); xe không còn trong kho thì là mã xe. */
  readonly vehicleName: string
  /** Trạng thái chuyến (chip) và dòng phụ (đã duyệt, lỗi thời, tiến độ kho) như mọi màn (FE-0-05). */
  readonly status: TripStatus
  readonly sub: TripSubStatus | null
  readonly stage: WarehouseStage
  /** Kiện của phương án kho xếp theo. */
  readonly total: number
  /** Kiện đã có kết quả ở kho: đã xếp hoặc báo thiếu. */
  readonly recorded: number
  readonly missing: number
}

/**
 * Đường dẫn phiên xếp của một chuyến. Nút thoát của phiên truyền nó làm `screenHome`: khác màn chính `/kho` nên nhân viên kho thoát
 * là về danh sách chuyến, không đăng xuất (`exitAction`).
 */
export function loadingSessionPath(tripId: string): string {
  return `/kho?chuyen=${encodeURIComponent(tripId)}`
}

/** Đang xếp trước (làm tiếp cho xong), rồi chờ xếp, cuối cùng chuyến đang chặn chờ duyệt lại. */
const STAGE_ORDER: Readonly<Record<WarehouseStage, number>> = { loading: 0, waiting: 1, stale: 2 }

/**
 * Chuyến kho cần thấy: đang xếp, đã duyệt chờ xếp, hoặc bản duyệt lỗi thời trong pha lập kế hoạch; còn lại không hiện. Pha lập kế
 * hoạch đọc dòng phụ của chuyến (`tripSubStatus`): "đã duyệt" là chờ xếp, "lỗi thời" là chờ tối ưu và duyệt lại.
 */
function warehouseStage(trip: Trip, revisions: readonly Revision[]): WarehouseStage | null {
  if (trip.phase === 'loading') return 'loading'
  if (trip.phase !== 'planning') return null
  const plan = tripSubStatus(trip, revisions)?.kind
  if (plan === 'stale') return 'stale'
  return plan === 'approved' ? 'waiting' : null
}

/**
 * Phương án kho xếp theo (D-47): bản duyệt được ghi lúc bắt đầu xếp; chưa bắt đầu thì bản duyệt mới nhất. Không có bản duyệt
 * thì `undefined` — kho không xếp theo bản chưa duyệt.
 */
export function warehousePlan<R extends Pick<Revision, 'id' | 'approvedAt'>>(trip: Pick<Trip, 'loading'>, revisions: readonly R[]): R | undefined {
  const startedWith = trip.loading?.revisionId
  return startedWith === undefined ? latestApproved(revisions) : revisions.find((revision) => revision.id === startedWith)
}

/**
 * Danh sách chuyến của màn kho (LM-086, D-46): chuyến đã duyệt chờ xếp, đang xếp, và chuyến có bản duyệt lỗi thời (hiện để kho biết
 * nhưng không bắt đầu được). Chuyến lỗi thời mà chưa từng có bản duyệt thì không có gì để xếp nên không hiện.
 */
export function warehouseTripRows(entries: readonly TripRevisions[], vehicleNames: ReadonlyMap<string, string>): WarehouseTripRow[] {
  const rows: WarehouseTripRow[] = []
  for (const { trip, revisions } of entries) {
    const stage = warehouseStage(trip, revisions)
    const plan = warehousePlan(trip, revisions)
    if (!plan || !stage) continue
    rows.push({
      id: trip.id,
      name: trip.name,
      scheduledDate: trip.scheduledDate,
      vehicleName: vehicleNames.get(trip.vehicleId) ?? trip.vehicleId,
      status: tripStatus(trip, revisions),
      sub: tripSubStatus(trip, revisions),
      stage,
      total: plannedStops(plan).size,
      recorded: trip.loading?.steps.length ?? 0,
      missing: missingIds(trip).size,
    })
  }
  return rows.toSorted((a, b) =>
    STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] || a.scheduledDate.localeCompare(b.scheduledDate) || a.id.localeCompare(b.id))
}
