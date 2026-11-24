import type { DeliveryView } from './delivery-progress'
import type { DeliveryItem, StopDelivery } from './driver-plan'

/**
 * Hoàn tất điểm đang giao sẽ ghi gì vào kho (FE-6-06) — hộp hỏi lại đọc từ đây, mọi số lấy từ tiến độ của điểm trên màn. Kho
 * làm đúng như vậy khi hoàn tất: kiện đã dỡ thành Đã giao, kiện của điểm chưa dỡ (khách từ chối, sự cố khác) ở lại xe và thành Hoàn trả.
 */
export type StopCompletion = {
  /** Kiện đã dỡ ở điểm. */
  readonly delivered: number
  /** Kiện của phương án chưa dỡ: ở lại xe. */
  readonly returned: readonly DeliveryItem[]
  /** Kiện đã báo sự cố ở điểm này. */
  readonly issues: number
  /** Điểm kế tiếp sau khi hoàn tất; vắng là điểm cuối — hoàn tất là giao xong chuyến. */
  readonly next: StopDelivery | undefined
}

export function stopCompletion(view: DeliveryView, stops: readonly StopDelivery[]): StopCompletion {
  return {
    delivered: view.items.filter((entry) => entry.unloaded).length,
    returned: view.items.filter((entry) => !entry.unloaded).map((entry) => entry.item),
    issues: view.issueCount,
    next: stops.find((stop) => stop.number > view.stop.number && !view.completedStops.has(stop.number)),
  }
}
