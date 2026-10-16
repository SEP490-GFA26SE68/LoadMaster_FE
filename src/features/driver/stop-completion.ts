import type { DeliveryView } from './delivery-progress'
import type { DeliveryItem, StopDelivery } from './driver-plan'

/**
 * Hoàn tất điểm đang giao sẽ ghi gì vào kho (FE-6-06, FE-7-05) — hộp hỏi lại đọc từ đây, mọi số lấy từ tiến độ của điểm trên màn. Kho
 * làm đúng như vậy khi hoàn tất: kiện đã dỡ thành Đã giao, kiện của điểm chưa dỡ (khách từ chối, sự cố khác) ở lại xe và thành Hoàn trả,
 * kiện nhận dọc đường đã đối chiếu lên xe thành Đang vận chuyển.
 */
export type StopCompletion = {
  /** Kiện đã dỡ ở điểm, kể cả kiện nhận dọc đường giao ở đây. */
  readonly delivered: number
  /** Kiện của phương án chưa dỡ: ở lại xe. */
  readonly returned: readonly DeliveryItem[]
  /** Kiện nhận dọc đường đã đối chiếu lên xe ở điểm này. */
  readonly picked: number
  /** Kiện đã báo sự cố ở điểm này. */
  readonly issues: number
  /** Điểm kế tiếp sau khi hoàn tất; vắng là điểm cuối — hoàn tất là giao xong chuyến. */
  readonly next: StopDelivery | undefined
}

export function stopCompletion(view: DeliveryView, stops: readonly StopDelivery[]): StopCompletion {
  const done = (role: 'pick' | 'deliver') => view.pickupItems.filter((entry) => entry.done && entry.item.role === role).length
  return {
    delivered: view.items.filter((entry) => entry.unloaded).length + done('deliver'),
    returned: view.items.filter((entry) => !entry.unloaded).map((entry) => entry.item),
    picked: done('pick'),
    issues: view.issueCount,
    next: stops.find((stop) => stop.number > view.stop.number && !view.completedStops.has(stop.number)),
  }
}
