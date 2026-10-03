import { latestVerifications, leftOutIds, pendingManualConfirms, type DeliveryIssue, type PackageVerification, type Trip, type TripPhase } from '@/lib/mock-db'
import type { DeliveryItem, StopDelivery } from './driver-plan'

/**
 * Màn điểm giao làm gì theo pha chuyến (D-45, D-84): `preview` — kho chưa xếp xong, chỉ xem; `ready` — kho đã xếp xong, chờ tài xế bấm
 * Xuất phát; `delivering` — đang vận chuyển: tới từng điểm thì bấm "Đã đến" rồi mới dỡ hàng, báo sự cố theo kiện và hoàn tất điểm
 * (`DeliveryView.arrivedAt`, FE-6-06).
 */
export type DeliveryMode = 'preview' | 'ready' | 'delivering'

export function deliveryMode(phase: TripPhase): DeliveryMode {
  if (phase === 'delivering') return 'delivering'
  return phase === 'loaded' ? 'ready' : 'preview'
}

export type ItemProgress = {
  readonly item: DeliveryItem
  readonly unloaded: boolean
  /** Sự cố mới nhất tài xế báo cho kiện này ở điểm này. */
  readonly issue: DeliveryIssue | undefined
  /** Khách từ chối nhận kiện này (sự cố mới nhất là "khách từ chối"): kiện ở lại xe, hoàn tất điểm thì thành Hoàn trả (D-84). */
  readonly returned: boolean
  /**
   * Lần đối chiếu mới nhất của kiện khi dỡ (FE-6-03): cách đối chiếu của kiện đã dỡ; kiện chưa dỡ mà lần mới nhất là xác nhận tay bị
   * từ chối thì phải kiểm lại (FE-6-04).
   */
  readonly verification: PackageVerification | undefined
}

export type DeliveryView = {
  readonly mode: DeliveryMode
  /** Điểm đang giao: điểm chưa hoàn tất đầu tiên; chưa giao thì điểm 1. */
  readonly stop: StopDelivery
  /** Giờ tài xế bấm "Đã đến" ở điểm này (ISO 8601); chưa bấm thì `undefined` — chưa dỡ, chưa hoàn tất điểm được. */
  readonly arrivedAt: string | undefined
  /** Kiện phải dỡ ở điểm này theo thứ tự dỡ: kiện của phương án trừ kiện hỏng bị bỏ lại kho (không có trên xe). */
  readonly items: readonly ItemProgress[]
  /** Kiện của điểm này hỏng lúc xếp, bị bỏ lại kho. */
  readonly leftAtWarehouse: readonly string[]
  readonly unloadedCount: number
  readonly issueCount: number
  /** Kiện chưa dỡ và chưa có sự cố: còn kiện như vậy thì chưa hoàn tất được điểm (D-47). */
  readonly remaining: number
  /** Xác nhận tay của điểm này còn chờ điều phối viên duyệt: còn chờ thì chưa hoàn tất được điểm (FE-6-04). */
  readonly pendingConfirms: number
  /** Số các điểm đã hoàn tất. */
  readonly completedStops: ReadonlySet<number>
}

/**
 * Tiến độ ở điểm giao hiện tại, đọc từ kho: kiện đã dỡ và sự cố của điểm. Mở lại màn là về đúng điểm chưa hoàn tất đầu tiên.
 * Chuyến không có điểm giao nào thì `undefined`.
 */
export function deliveryView(trip: Pick<Trip, 'phase' | 'loading' | 'delivery' | 'verifications'>, stops: readonly StopDelivery[]): DeliveryView | undefined {
  const mode = deliveryMode(trip.phase)
  const progress = trip.delivery
  const currentNumber = mode === 'delivering' ? progress?.stops.find((item) => item.completedAt === undefined)?.number : 1
  const stop = stops.find((item) => item.number === currentNumber)
  if (!stop) return undefined
  const leftOut = leftOutIds(trip)
  const stopProgress = progress?.stops.find((item) => item.number === stop.number)
  const unloadedIds = new Set(stopProgress?.unloadedIds)
  const stopIssues = progress?.issues.filter((issue) => issue.stopNumber === stop.number) ?? []
  const verified = latestVerifications(trip, 'UNLOADING')
  const items = stop.items
    .filter((item) => !leftOut.has(item.id))
    .map((item): ItemProgress => {
      const unloaded = unloadedIds.has(item.id)
      const verification = verified.get(item.id)
      const issue = stopIssues.findLast((entry) => entry.packageInstanceId === item.id)
      return {
        item,
        unloaded,
        issue,
        returned: !unloaded && issue?.kind === 'refused',
        // Kiện bị khách từ chối sau khi dỡ không còn mang cách đối chiếu cũ; lần xác nhận tay bị từ chối thì giữ để nói lý do kiểm lại
        verification: unloaded !== (verification?.manual?.status === 'MANUAL_REJECTED') ? verification : undefined,
      }
    })
  return {
    mode,
    stop,
    arrivedAt: mode === 'delivering' ? stopProgress?.arrivedAt : undefined,
    items,
    leftAtWarehouse: stop.items.filter((item) => leftOut.has(item.id)).map((item) => item.id),
    unloadedCount: items.filter((item) => item.unloaded).length,
    issueCount: items.filter((item) => item.issue !== undefined).length,
    remaining: items.filter((item) => !item.unloaded && item.issue === undefined).length,
    pendingConfirms: mode === 'delivering' ? pendingManualConfirms(trip, 'UNLOADING', stop.number).length : 0,
    completedStops: new Set(progress?.stops.filter((item) => item.completedAt !== undefined).map((item) => item.number)),
  }
}

export type DeliverySummary = {
  readonly stopCount: number
  /** Kiện đã dỡ ở mọi điểm. */
  readonly delivered: number
  readonly issues: readonly DeliveryIssue[]
  readonly startedAt: string | undefined
  readonly completedAt: string | undefined
}

/** Tổng kết chuyến (LM-087): mọi số đọc từ tiến độ giao trong kho. */
export function deliverySummary(trip: Pick<Trip, 'stops' | 'delivery'>): DeliverySummary {
  return {
    stopCount: trip.stops.length,
    delivered: trip.delivery?.stops.reduce((sum, stop) => sum + stop.unloadedIds.length, 0) ?? 0,
    issues: trip.delivery?.issues ?? [],
    startedAt: trip.delivery?.startedAt,
    completedAt: trip.delivery?.completedAt,
  }
}
