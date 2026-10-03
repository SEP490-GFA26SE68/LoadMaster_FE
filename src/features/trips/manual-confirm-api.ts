/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm.
 *   chưa có ở BE (Q-11): fetchManualConfirmations, approveManualConfirmation, rejectManualConfirmation
 */

import { getMockDb, pendingManualConfirms, type ManualConfirmReason, type PackageVerification, type Trip, type VerifyContext } from '@/lib/mock-db'

/**
 * Lớp dữ liệu của thẻ "Xác nhận tay chờ duyệt" ở Chi tiết chuyến (FE-6-04, D-83) — nơi duy nhất của thẻ biết về kho. Xác nhận tay là
 * mức 3 của đối chiếu kiện: kho hoặc tài xế chọn kiện kèm lý do khi nhãn không đọc được; điều phối viên duyệt hoặc từ chối.
 */

/** Một xác nhận tay còn chờ duyệt, kèm tên kiện và tên người gửi để đọc. */
export type ManualConfirmRow = {
  readonly id: string
  readonly context: VerifyContext
  /** Số điểm giao, chỉ khi dỡ. */
  readonly stopNumber: number | undefined
  readonly packageInstanceId: string
  readonly packageName: string
  readonly reason: ManualConfirmReason
  readonly note: string | undefined
  /** ISO 8601 */
  readonly at: string
  /** Họ tên người gửi; `null` khi kho không còn tài khoản đó, hoặc xác nhận ghi khi không có phiên. */
  readonly senderName: string | null
}

/**
 * Xác nhận tay còn chờ duyệt của chuyến, theo thứ tự gửi. Chỉ của bước chuyến đang ở: bước soạn và bước xếp khi chuyến đang ở kho, bước
 * dỡ khi đang giao — chuyến ở pha khác (đã huỷ giữa chừng) không còn gì để duyệt. Tên người gửi lấy cùng phạm vi với nhật ký (`listAuditNames`).
 */
// chưa có ở BE (Q-11)
export async function fetchManualConfirmations(tripId: string): Promise<ManualConfirmRow[]> {
  const db = getMockDb()
  const trip = await db.getTrip(tripId)
  const contexts: readonly VerifyContext[] = trip.phase === 'loading' ? ['STAGING', 'LOADING'] : trip.phase === 'delivering' ? ['UNLOADING'] : []
  const pending: PackageVerification[] = pendingManualConfirms(trip).filter((entry) => contexts.includes(entry.context))
  if (pending.length === 0) return []
  const [labels, names] = await Promise.all([db.listTripLabels(tripId), db.listAuditNames()])
  const packageNames = new Map(labels.map((label) => [label.packageInstanceId, label.name]))
  const users = new Map(names.users.map((user) => [user.id, user.fullName]))
  return pending.map((entry) => ({
    id: entry.id,
    context: entry.context,
    stopNumber: entry.stopNumber,
    packageInstanceId: entry.packageInstanceId,
    packageName: packageNames.get(entry.packageInstanceId) ?? '',
    reason: entry.manual?.reason ?? 'OTHER',
    note: entry.manual?.note,
    at: entry.at,
    senderName: entry.by === null ? null : (users.get(entry.by) ?? null),
  }))
}

/** Duyệt: kiện giữ kết quả như đã đối chiếu. */
// chưa có ở BE (Q-11)
export function approveManualConfirmation(tripId: string, confirmationId: string): Promise<Trip> {
  return getMockDb().approveManualConfirmation(tripId, confirmationId)
}

/** Từ chối kèm lý do: kết quả của kiện bị gỡ, kho hoặc tài xế phải kiểm lại; người gửi được báo qua chuông. */
// chưa có ở BE (Q-11)
export function rejectManualConfirmation(tripId: string, confirmationId: string, reason: string): Promise<Trip> {
  return getMockDb().rejectManualConfirmation(tripId, confirmationId, reason)
}
