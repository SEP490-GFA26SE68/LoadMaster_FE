import { normalizeQrToken } from './qr-token'
import type { TripLabel } from './source-types'

/**
 * Đối chiếu kiện ba mức (FE-6-03, D-83), dùng chung cho kho (soạn, xếp) và tài xế (dỡ, nhận dọc đường): quét QR → gõ mã → xác nhận tay
 * có điều phối viên duyệt (FE-6-04). Kiểu và luật thuần; kho ghi qua `db-scans.ts`, `db-manual-confirm.ts`.
 */

/** Cách một kiện được đối chiếu: quét QR bằng camera, gõ mã (mã QR in dưới hình, hoặc mã của bên gửi), xác nhận tay. */
export const VERIFY_METHODS = ['QR', 'CODE', 'MANUAL'] as const
export type VerifyMethod = (typeof VERIFY_METHODS)[number]

/** Đối chiếu bằng nhãn — kiểm như quét, không cần duyệt. */
export type LabelVerifyMethod = Exclude<VerifyMethod, 'MANUAL'>

/** Bước của chuyến mà kiện được đối chiếu. Soạn hàng và nhận dọc đường thêm ở issue của hai luồng đó. */
export const VERIFY_CONTEXTS = ['LOADING', 'UNLOADING'] as const
export type VerifyContext = (typeof VERIFY_CONTEXTS)[number]

/** Lý do xác nhận tay; `OTHER` bắt buộc ghi chú. */
export const MANUAL_CONFIRM_REASONS = ['LABEL_DAMAGED', 'QR_UNREADABLE', 'OTHER'] as const
export type ManualConfirmReason = (typeof MANUAL_CONFIRM_REASONS)[number]

export const MANUAL_CONFIRM_STATUSES = ['MANUAL_PENDING', 'MANUAL_APPROVED', 'MANUAL_REJECTED'] as const
export type ManualConfirmStatus = (typeof MANUAL_CONFIRM_STATUSES)[number]

/** Ghi chú của xác nhận tay và lý do từ chối dài tối đa (ký tự). */
export const MAX_MANUAL_NOTE_LENGTH = 300

/** Phần chỉ xác nhận tay có: lý do, trạng thái duyệt, và quyết định của điều phối viên. */
export type ManualConfirm = {
  status: ManualConfirmStatus
  reason: ManualConfirmReason
  note?: string
  /** ISO 8601 */
  decidedAt?: string
  decidedBy?: string | null
  /** Chỉ khi bị từ chối: lý do điều phối viên ghi. */
  rejectReason?: string
}

/**
 * Một lần đối chiếu một kiện của chuyến: cách, người, thời điểm. Nằm ở `Trip.verifications` theo thứ tự ghi; lần mới nhất của một kiện
 * trong một bước là lần có hiệu lực. Xác nhận tay bị từ chối ở lại làm lịch sử cho tới khi kiện được đối chiếu lại.
 */
export type PackageVerification = {
  /** `VF-NNN`, duy nhất trong chuyến. */
  id: string
  context: VerifyContext
  /** Số điểm giao, chỉ khi dỡ. */
  stopNumber?: number
  packageInstanceId: string
  method: VerifyMethod
  /** ISO 8601 */
  at: string
  /** Người đối chiếu; `null` khi không có phiên (seed, test). */
  by: string | null
  manual?: ManualConfirm
}

export type ManualConfirmInput = { packageInstanceId: string; reason: ManualConfirmReason; note?: string }

type Verified = { readonly verifications?: readonly PackageVerification[] }

/** Xác nhận tay còn chờ điều phối viên duyệt; `context` và `stopNumber` thu hẹp về một bước hoặc một điểm giao. */
export function pendingManualConfirms(trip: Verified, context?: VerifyContext, stopNumber?: number): PackageVerification[] {
  return (trip.verifications ?? []).filter((entry) =>
    entry.manual?.status === 'MANUAL_PENDING'
    && (context === undefined || entry.context === context)
    && (stopNumber === undefined || entry.stopNumber === stopNumber))
}

/** Lần đối chiếu mới nhất của từng kiện trong bước `context`: mã instance → lần đối chiếu. */
export function latestVerifications(trip: Verified, context: VerifyContext): Map<string, PackageVerification> {
  const latest = new Map<string, PackageVerification>()
  for (const entry of trip.verifications ?? []) if (entry.context === context) latest.set(entry.packageInstanceId, entry)
  return latest
}

/**
 * Kiện phải kiểm lại (FE-6-04): lần đối chiếu mới nhất là xác nhận tay bị từ chối và kiện chưa được ghi lại (`recordedIds` — kiện đang
 * có kết quả xếp, hoặc đang được đánh dấu đã dỡ).
 */
export function rejectedConfirms(trip: Verified, context: VerifyContext, recordedIds: ReadonlySet<string>): PackageVerification[] {
  return [...latestVerifications(trip, context).values()].filter((entry) =>
    entry.manual?.status === 'MANUAL_REJECTED' && !recordedIds.has(entry.packageInstanceId))
}

function sameSubject(entry: PackageVerification, context: VerifyContext, packageInstanceId: string): boolean {
  return entry.context === context && entry.packageInstanceId === packageInstanceId
}

/** Danh sách sau khi bỏ xác nhận tay còn chờ của kiện trong bước `context`: kiện vừa được ghi lại bằng cách khác, hoặc bỏ đánh dấu. */
export function withoutPendingConfirm(list: readonly PackageVerification[] | undefined, context: VerifyContext, packageInstanceId: string): PackageVerification[] {
  return (list ?? []).filter((entry) => !(entry.manual?.status === 'MANUAL_PENDING' && sameSubject(entry, context, packageInstanceId)))
}

/**
 * Danh sách sau khi ghi thêm một lần đối chiếu: mã `VF-NNN` kế tiếp của chuyến. Xác nhận tay còn chờ của cùng kiện trong cùng bước bị
 * thay — lần đối chiếu mới nói kiện đã được kiểm bằng cách nào.
 */
export function withVerification(list: readonly PackageVerification[] | undefined, entry: Omit<PackageVerification, 'id'>): PackageVerification[] {
  const numbers = (list ?? []).map((item) => Number(/^VF-(\d+)$/.exec(item.id)?.[1] ?? 0))
  const id = `VF-${String(Math.max(0, ...numbers) + 1).padStart(3, '0')}`
  return [...withoutPendingConfirm(list, entry.context, entry.packageInstanceId), { id, ...entry }]
}

export type CodeMatch =
  | { readonly kind: 'matched'; readonly label: TripLabel }
  /** Mã của bên gửi khớp `count` kiện của chuyến: không biết là kiện nào, phải gõ mã QR. */
  | { readonly kind: 'ambiguous'; readonly count: number }
  | { readonly kind: 'unknown' }

function sameCode(a: string, b: string): boolean {
  return a.trim().toLocaleUpperCase('vi') === b.trim().toLocaleUpperCase('vi')
}

/**
 * Kiện của chuyến ứng với mã người dùng đưa (D-83). Quét (`QR`) chỉ khớp mã QR. Gõ mã (`CODE`) khớp mã QR in dưới hình trước; không
 * khớp thì thử **mã của bên gửi** — chỉ nhận khi mã đó duy nhất trong chuyến, vì nhập file không cấm hai kiện trùng mã của bên gửi.
 */
export function resolveVerifyCode(labels: readonly TripLabel[], code: string, method: LabelVerifyMethod): CodeMatch {
  const token = normalizeQrToken(code)
  const byToken = labels.find((label) => label.qrToken === token)
  if (byToken) return { kind: 'matched', label: byToken }
  if (method === 'QR') return { kind: 'unknown' }
  const bySenderCode = labels.filter((label) => sameCode(label.packageCode, code))
  if (bySenderCode.length > 1) return { kind: 'ambiguous', count: bySenderCode.length }
  const [only] = bySenderCode
  return only ? { kind: 'matched', label: only } : { kind: 'unknown' }
}
