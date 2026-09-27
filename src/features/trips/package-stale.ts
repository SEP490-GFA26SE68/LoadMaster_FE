import { isStale, latestApproved, type Revision, type Trip } from '@/lib/mock-db'

export type StaleOnSave = {
  /** Revision đang hiển thị sẽ thành lỗi thời (`REV-002`). */
  readonly revisionId: string
  /** Bản đã duyệt: phải duyệt lại trước khi kho xếp; chưa duyệt thì chỉ cần xem lại phương án. */
  readonly approved: boolean
}

/**
 * Lưu một thay đổi kiện làm revision nào lỗi thời (D-31)? Cùng cách `tripStatus` chọn revision hiển thị: bản duyệt mới nhất, không có
 * thì bản mới nhất. Đã lỗi thời sẵn, chưa tối ưu hay chuyến đã rời pha lập kế hoạch thì không còn gì để cảnh báo.
 */
export function staleOnSave(
  trip: Pick<Trip, 'phase' | 'inputVersion'>,
  revisions: readonly Pick<Revision, 'id' | 'approvedAt' | 'inputVersion'>[],
): StaleOnSave | null {
  if (trip.phase !== 'planning') return null
  const shown = latestApproved(revisions) ?? revisions.at(-1)
  if (!shown || isStale(shown, trip)) return null
  return { revisionId: shown.id, approved: shown.approvedAt !== undefined }
}
