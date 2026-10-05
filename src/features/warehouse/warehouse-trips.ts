import {
  latestApproved,
  leftOutIds,
  plannedStops,
  rejectedConfirms,
  tripManualSubStatus,
  tripStatus,
  tripSubStatus,
  type ReplanReason,
  type Revision,
  type Trip,
} from '@/lib/mock-db'
import type { TripStatus, TripSubStatus } from '@/types/trip'

/**
 * Nhóm của chuyến ở danh sách kho (FE-6-01, PRD v2 mục 8.5), theo trạng thái của backend và dòng phụ:
 * - `loading`: Đang xếp hàng, kho đang soạn hoặc đang xếp (tiến độ x / y) — làm tiếp cho xong;
 * - `waiting`: Đã lập kế hoạch, phương án đã duyệt còn hiệu lực — "Chờ soạn";
 * - `loaded`: Đang xếp hàng, dòng phụ "Xếp xong — chờ xuất phát" — còn ghi được số seal tới khi tài xế xuất phát;
 * - `stale`: Đã lập kế hoạch, bản duyệt lỗi thời — "Chờ điều phối tối ưu lại", kho không bắt đầu được; gồm cả chuyến vừa từ Đang xếp
 *   hàng quay về vì bỏ kiện thiếu hoặc kiện hỏng (FE-6-02, FE-6-05).
 * Thứ tự ở đây là thứ tự nhóm trên màn.
 */
export const WAREHOUSE_STAGES = ['loading', 'waiting', 'loaded', 'stale'] as const
export type WarehouseStage = (typeof WAREHOUSE_STAGES)[number]

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
  /** Dòng phụ thứ hai: còn xác nhận tay chờ điều phối viên duyệt (FE-6-04). */
  readonly manualSub: TripSubStatus | null
  readonly stage: WarehouseStage
  /** Bước của chuyến đang ở kho: còn kiện chưa soạn là `staging`, soạn đủ là `loading`. Chỉ có nghĩa ở nhóm `loading`. */
  readonly step: 'staging' | 'loading'
  /** Kiện của phương án kho xếp theo. */
  readonly total: number
  /** Kiện đã xong ở bước hiện tại: đã soạn (bước soạn), hoặc đã có kết quả xếp — đã xếp hay hỏng bị bỏ lại (bước xếp). */
  readonly recorded: number
  /** Kiện hỏng lúc xếp, bị bỏ lại kho. */
  readonly damaged: number
  /** Kiện kho báo thiếu lúc soạn, chờ điều phối viên quyết. */
  readonly shortages: number
  /** Chuyến vừa từ Đang xếp hàng quay về Đã lập kế hoạch: lý do, và có phải dỡ kiện đã xếp ra không. */
  readonly replan: { readonly reason: ReplanReason; readonly unload: boolean } | undefined
  /** Xác nhận tay bị điều phối viên từ chối mà kiện chưa được kiểm lại (FE-6-04). */
  readonly recheck: number
  /** Số seal đã ghi khi xếp xong; chưa ghi thì `undefined`. */
  readonly seal: string | undefined
}

/**
 * Đường dẫn phiên xếp của một chuyến. Nút thoát của phiên truyền nó làm `screenHome`: khác màn chính `/kho` nên nhân viên kho thoát
 * là về danh sách chuyến, không đăng xuất (`exitAction`).
 */
export function loadingSessionPath(tripId: string): string {
  return `/kho?chuyen=${encodeURIComponent(tripId)}`
}

/**
 * Nhóm của chuyến, hoặc `null` khi kho không cần thấy nó (nháp, chờ duyệt, đang vận chuyển, đã giao, đã huỷ). Pha lập kế hoạch đọc
 * dòng phụ của chuyến (`tripSubStatus`): "đã duyệt" là chờ soạn, "lỗi thời" là chờ tối ưu và duyệt lại.
 */
function warehouseStage(trip: Trip, revisions: readonly Revision[]): WarehouseStage | null {
  if (trip.phase === 'loading') return 'loading'
  if (trip.phase === 'loaded') return 'loaded'
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
 * Danh sách chuyến của màn kho (LM-086, D-46; nhóm theo trạng thái từ FE-6-01): theo nhóm (`WAREHOUSE_STAGES`), trong nhóm thì ngày
 * chạy sớm trước, rồi mã chuyến. Chuyến lỗi thời mà chưa từng có bản duyệt thì không có gì để xếp nên không hiện.
 */
export function warehouseTripRows(entries: readonly TripRevisions[], vehicleNames: ReadonlyMap<string, string>): WarehouseTripRow[] {
  const rows: WarehouseTripRow[] = []
  for (const { trip, revisions } of entries) {
    const stage = warehouseStage(trip, revisions)
    const plan = warehousePlan(trip, revisions)
    if (!plan || !stage) continue
    const total = plannedStops(plan).size
    const staged = new Set(trip.loading?.stagedIds)
    const recorded = new Set(trip.loading?.steps.map((step) => step.packageInstanceId))
    const step = staged.size < total ? 'staging' : 'loading'
    rows.push({
      id: trip.id,
      name: trip.name,
      scheduledDate: trip.scheduledDate,
      vehicleName: vehicleNames.get(trip.vehicleId) ?? trip.vehicleId,
      status: tripStatus(trip),
      sub: tripSubStatus(trip, revisions),
      manualSub: tripManualSubStatus(trip),
      stage,
      step,
      total,
      recorded: step === 'staging' ? staged.size : recorded.size,
      damaged: leftOutIds(trip).size,
      shortages: trip.loading?.shortages?.length ?? 0,
      replan: trip.replan === undefined ? undefined : { reason: trip.replan.reason, unload: trip.replan.unload },
      recheck: stage === 'loading' ? rejectedConfirms(trip, 'STAGING', staged).length + rejectedConfirms(trip, 'LOADING', recorded).length : 0,
      seal: trip.loading?.seal?.number,
    })
  }
  return rows.toSorted((a, b) =>
    WAREHOUSE_STAGES.indexOf(a.stage) - WAREHOUSE_STAGES.indexOf(b.stage) || a.scheduledDate.localeCompare(b.scheduledDate) || a.id.localeCompare(b.id))
}

/** Các nhóm có chuyến, theo thứ tự trên màn; `rows` đã sắp như `warehouseTripRows` trả. */
export function warehouseGroups(rows: readonly WarehouseTripRow[]): { readonly stage: WarehouseStage; readonly rows: readonly WarehouseTripRow[] }[] {
  return WAREHOUSE_STAGES.map((stage) => ({ stage, rows: rows.filter((row) => row.stage === stage) })).filter((group) => group.rows.length > 0)
}
