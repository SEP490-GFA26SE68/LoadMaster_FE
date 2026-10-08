import type { PackagePlacement } from '@/domain/models'
import { createPlacementLayout } from './layout'
import { lifoIssues } from './lifo'

/** Một kiện còn phải dỡ và thứ hạng giao của điểm giao của nó **theo thứ tự đang kiểm** (1 = giao đầu tiên). */
export type ReorderCargo = {
  readonly placement: PackagePlacement
  readonly rank: number
}

export type ReorderBlockage = {
  readonly packageInstanceId: string
  /** Kiện giao muộn hơn đang che lối dỡ, theo thứ tự của lưới. */
  readonly blockerIds: readonly string[]
  /** Tỷ lệ mặt sau bị che, 0–1. */
  readonly coverage: number
}

export type ReorderCheck = {
  /** Mặt sau bị che kín: không dỡ được theo thứ tự này. */
  readonly blocked: readonly ReorderBlockage[]
  /** Che một phần: chỉ là cảnh báo. */
  readonly partial: readonly ReorderBlockage[]
}

/**
 * Đổi thứ tự điểm giao khi xe đang chạy (FE-BL-03, D-87, luật của Luồng BE): với phương án như đã xếp, các kiện còn trên xe có còn dỡ
 * được theo thứ tự mới không. Đây là `lifoIssues` của Spec 7.11 chạy trên đúng các kiện còn phải dỡ, với điểm giao thay bằng thứ hạng
 * giao trong thứ tự được kiểm — kiện đã dỡ không có mặt (đã rời xe), kiện chắn là kiện giao **muộn hơn** nằm giữa kiện đó và cửa sau.
 * Che kín mặt sau là `blocked`; che một phần chỉ là `partial`. Hàm thuần, không đọc gì ngoài tham số.
 */
export function checkStopReorder(cargo: readonly ReorderCargo[]): ReorderCheck {
  const layout = createPlacementLayout({ obstacles: [] }, cargo.map(({ placement }) => placement))
  const rules = { deliveryStopByInstanceId: new Map(cargo.map(({ placement, rank }) => [placement.packageInstanceId, rank])), enforceLifo: true }
  const blocked: ReorderBlockage[] = []
  const partial: ReorderBlockage[] = []
  for (const { placement } of cargo) {
    for (const issue of lifoIssues(placement, rules, layout)) {
      const blockage = { packageInstanceId: placement.packageInstanceId, blockerIds: issue.relatedIds ?? [], coverage: issue.params.coverage }
      if (issue.code === 'LIFO_BLOCKED') blocked.push(blockage)
      else partial.push(blockage)
    }
  }
  return { blocked, partial }
}
