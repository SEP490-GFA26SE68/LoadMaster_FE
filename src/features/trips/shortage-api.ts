/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm.
 *   chưa có ở BE (Q-11): fetchStagingShortages, resolveStagingShortage
 */

import { getMockDb, type ShortageDecision, type Trip } from '@/lib/mock-db'

/**
 * Lớp dữ liệu của thẻ "Kiện kho báo thiếu" ở Chi tiết chuyến (FE-6-02, D-82) — nơi duy nhất của thẻ biết về kho. Kho báo thiếu một kiện
 * lúc soạn hàng; điều phối viên quyết tìm tiếp, hoặc bỏ kiện khỏi chuyến.
 */

/** Một kiện kho đang báo thiếu, kèm tên kiện và tên người báo để đọc. */
export type ShortageRow = {
  readonly packageInstanceId: string
  readonly packageName: string
  /** Mã kiện của bên gửi. */
  readonly packageCode: string
  readonly stopNumber: number
  /** ISO 8601 */
  readonly at: string
  /** Họ tên người báo; `null` khi kho không còn tài khoản đó, hoặc báo thiếu ghi khi không có phiên. */
  readonly reporterName: string | null
}

/** Kiện kho đang báo thiếu của chuyến, theo thứ tự báo. Chuyến không ở bước soạn thì không có dòng nào. */
// chưa có ở BE (Q-11)
export async function fetchStagingShortages(tripId: string): Promise<ShortageRow[]> {
  const db = getMockDb()
  const trip = await db.getTrip(tripId)
  const shortages = trip.phase === 'loading' ? (trip.loading?.shortages ?? []) : []
  if (shortages.length === 0) return []
  const [labels, names] = await Promise.all([db.listTripLabels(tripId), db.listAuditNames()])
  const labelOf = new Map(labels.map((label) => [label.packageInstanceId, label]))
  const users = new Map(names.users.map((user) => [user.id, user.fullName]))
  return shortages.map((shortage) => {
    const label = labelOf.get(shortage.packageInstanceId)
    return {
      packageInstanceId: shortage.packageInstanceId,
      packageName: label?.name ?? '',
      packageCode: label?.packageCode ?? shortage.packageInstanceId,
      stopNumber: label?.deliveryStop ?? 0,
      at: shortage.at,
      reporterName: shortage.by === null ? null : (users.get(shortage.by) ?? null),
    }
  })
}

/**
 * Quyết một kiện kho báo thiếu: `KEEP_SEARCHING` — kho tìm tiếp; `DROP` — bỏ kiện khỏi chuyến: kiện về kho kiện kèm cờ "Không tìm
 * thấy", chuyến về Đã lập kế hoạch với phương án lỗi thời.
 */
// chưa có ở BE (Q-11)
export function resolveStagingShortage(tripId: string, packageInstanceId: string, decision: ShortageDecision): Promise<Trip> {
  return getMockDb().resolveStagingShortage(tripId, packageInstanceId, decision)
}
