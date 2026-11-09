import { MANUAL_CONFIRM_REASONS, type DeliveryIssue, type DeliveryIssueKind, type ManualConfirmReason, type ManualConfirmStatus, type PackageVerification } from '@/lib/mock-db'
import type { ItemProgress } from './delivery-progress'
import type { StopPackageDto } from './driver-dto'
import type { DeliveryItem } from './driver-plan'

/** Phần tiến độ của một kiện trong `current-stop` của máy chủ: đã dỡ, sự cố, xác nhận tay. Chỉ `driver-dto.ts` import file này. */
type ServerItemState = Pick<StopPackageDto, 'unloaded' | 'issueKind' | 'issueNote' | 'manualStatus' | 'manualReason' | 'manualRejectReason'>

const ISSUE_KINDS: Readonly<Record<string, DeliveryIssueKind>> = { DAMAGED: 'damaged', MISSING: 'missing', REFUSED: 'refused', OTHER: 'other' }
const MANUAL_STATUSES: Readonly<Record<string, ManualConfirmStatus>> = { PENDING: 'MANUAL_PENDING', APPROVED: 'MANUAL_APPROVED', REJECTED: 'MANUAL_REJECTED' }
const reasonOf = (value: string | null | undefined): ManualConfirmReason => MANUAL_CONFIRM_REASONS.find((reason) => reason === value) ?? 'OTHER'

/**
 * Tiến độ một kiện theo máy chủ, như `deliveryView` của kho mẫu: sự cố mới nhất (khách từ chối mà kiện chưa dỡ thì kiện ở lại xe —
 * hoàn trả); xác nhận tay mới nhất làm cách đối chiếu của kiện đã dỡ, hoặc — bị từ chối và kiện về chưa dỡ — lý do phải kiểm lại.
 * Máy chủ không trả giờ của sự cố hay cách đối chiếu bằng nhãn: để trống, màn không hiện các phần đó. Lý do xác nhận tay lạ (máy chủ cũ) đọc là "Khác".
 */
export function itemProgressOf(item: DeliveryItem, pkg: ServerItemState | undefined, stopNumber: number): ItemProgress {
  const unloaded = pkg?.unloaded === true
  const kind = pkg?.issueKind ? ISSUE_KINDS[pkg.issueKind] : undefined
  const issue: DeliveryIssue | undefined = kind === undefined
    ? undefined
    : { id: '', stopNumber, packageInstanceId: item.id, kind, note: pkg?.issueNote ?? '', at: '', reportedBy: null }
  const manual = pkg?.manualStatus ? MANUAL_STATUSES[pkg.manualStatus] : undefined
  const verification: PackageVerification | undefined = manual === undefined || unloaded === (manual === 'MANUAL_REJECTED')
    ? undefined
    : {
        id: '',
        context: 'UNLOADING',
        stopNumber,
        packageInstanceId: item.id,
        method: 'MANUAL',
        at: '',
        by: null,
        manual: { status: manual, reason: reasonOf(pkg?.manualReason), ...(pkg?.manualRejectReason ? { rejectReason: pkg.manualRejectReason } : {}) },
      }
  return { item, unloaded, issue, returned: !unloaded && kind === 'refused', verification }
}
