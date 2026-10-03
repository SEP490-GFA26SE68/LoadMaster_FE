import { expandPackages } from '@/domain/cargo'
import { latestApproved, stopItemIds, tripStatus, tripSubStatus, type Revision, type Trip } from '@/lib/mock-db'
import type { TripStatus, TripSubStatus } from '@/types/trip'

/** Chuyến kèm mọi revision của nó theo thứ tự kho trả (cũ trước). */
export type TripWithRevisions = { readonly trip: Trip; readonly revisions: readonly Revision[] }

/** Revision Planner mở cho chuyến (`plannerPath`). */
export type PlanLink = { readonly tripId: string; readonly jobId: string; readonly revisionId: string }

/**
 * Số của một chuyến mà bảng điều khiển gộp theo kỳ (LM-090). Mọi trường đọc thẳng từ chuyến và revision trong kho (D-48).
 */
export type TripFacts = {
  readonly id: string
  readonly name: string
  readonly scheduledDate: string
  readonly vehicleId: string
  readonly driverId: string | null
  readonly status: TripStatus
  /** Dòng phụ của trạng thái (FE-0-05): phương án chờ duyệt / đã duyệt / lỗi thời, tiến độ kho. */
  readonly sub: TripSubStatus | null
  readonly cancelled: boolean
  /** Số kiện vật lý (đã mở rộng `quantity`) và tổng khối lượng hàng của chuyến, kg. */
  readonly packageCount: number
  readonly cargoWeightKg: number
  /** Tỷ lệ lấp đầy thể tích của bản đã duyệt mới nhất; `null` khi chưa duyệt. */
  readonly volumePercent: number | null
  readonly isMockResult: boolean
  /** Bản đã duyệt mới nhất, không có thì bản mới nhất; vắng khi chưa tối ưu. */
  readonly plan: PlanLink | undefined
  /** Khối lượng các kiện tài xế đã dỡ, kg. */
  readonly deliveredWeightKg: number
  /** Kiện của các điểm giao đã hoàn tất, và số kiện trong đó không dính sự cố. */
  readonly finishedItems: number
  readonly cleanItems: number
  readonly issueCount: number
}

export function tripFacts({ trip, revisions }: TripWithRevisions): TripFacts {
  const instances = expandPackages(trip.packages).instances
  const weightById = new Map(instances.map((instance) => [instance.packageInstanceId, instance.weightKg]))
  const approved = latestApproved(revisions)
  const shown = approved ?? revisions.at(-1)
  return {
    id: trip.id,
    name: trip.name,
    scheduledDate: trip.scheduledDate,
    vehicleId: trip.vehicleId,
    driverId: trip.driverId,
    status: tripStatus(trip),
    sub: tripSubStatus(trip, revisions),
    cancelled: trip.phase === 'cancelled',
    packageCount: instances.length,
    cargoWeightKg: instances.reduce((sum, instance) => sum + instance.weightKg, 0),
    volumePercent: approved ? approved.result.metrics.volumeUtilizationPercent : null,
    isMockResult: approved?.result.isMockResult ?? false,
    plan: shown ? { tripId: trip.id, jobId: shown.jobId, revisionId: shown.id } : undefined,
    deliveredWeightKg: (trip.delivery?.stops ?? [])
      .flatMap((stop) => stop.unloadedIds)
      .reduce((sum, id) => sum + (weightById.get(id) ?? 0), 0),
    ...finishedStops(trip, revisions),
    issueCount: trip.delivery?.issues.length ?? 0,
  }
}

/**
 * Kiện của các điểm giao đã hoàn tất (kiện kho báo thiếu không tính): kiện sạch là kiện không có sự cố gắn vào, và điểm đó
 * không có sự cố chung của cả điểm. Điểm chưa hoàn tất chưa có kết cục nên không tính.
 */
function finishedStops(trip: Trip, revisions: readonly Revision[]): Pick<TripFacts, 'finishedItems' | 'cleanItems'> {
  const followed = revisions.find((revision) => revision.id === trip.loading?.revisionId)
  if (!trip.delivery || !followed) return { finishedItems: 0, cleanItems: 0 }
  let finishedItems = 0
  let cleanItems = 0
  for (const stop of trip.delivery.stops) {
    if (stop.completedAt === undefined) continue
    const issues = trip.delivery.issues.filter((issue) => issue.stopNumber === stop.number)
    const wholeStop = issues.some((issue) => issue.packageInstanceId === undefined)
    const flagged = new Set(issues.map((issue) => issue.packageInstanceId))
    const items = stopItemIds(trip, followed, stop.number)
    finishedItems += items.length
    cleanItems += wholeStop ? 0 : items.filter((id) => !flagged.has(id)).length
  }
  return { finishedItems, cleanItems }
}
