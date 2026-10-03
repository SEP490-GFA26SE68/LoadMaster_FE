import { expandPackages } from '@/domain/cargo'
import type { CargoPackage, UnplacedPackage } from '@/domain/models'
import type { DeadlineStatus } from '@/domain/routing'
import type { ConstraintIssue } from './issues'

export type ApprovalInput = {
  /** Issue hiện tại của phương án (thường là `evaluateAll().issues` của constraint engine). */
  readonly issues: readonly ConstraintIssue[]
  readonly packages: readonly CargoPackage[]
  readonly unplacedPackages: readonly UnplacedPackage[]
  /** Revision lỗi thời — xe hoặc kiện đổi sau khi tối ưu (`isStale` của mock repository, LM-026). */
  readonly stale: boolean
}

export type ApprovalBlockers = {
  readonly canApprove: boolean
  /** `error` và `blockApproval` của phương án, rồi `MUST_LOAD_UNPLACED` theo thứ tự kiện của request. */
  readonly issues: readonly ConstraintIssue[]
  readonly stale: boolean
}

/**
 * Lý do không được Duyệt (D-24, D-31): còn issue `error`/`blockApproval` — kể cả `AXLE_OVERLOAD` khi tải nhóm trục vượt giới hạn
 * (D-78) —, còn kiện `mustLoad` có instance chưa xếp (một `MUST_LOAD_UNPLACED` cho mỗi kiện gốc), hoặc revision lỗi thời. Cảnh báo
 * (trọng tâm lệch, tỷ lệ đỡ thấp…) không chặn.
 */
export function approvalBlockers({ issues, packages, unplacedPackages, stale }: ApprovalInput): ApprovalBlockers {
  const { packageIdByInstanceId } = expandPackages(packages)
  const unplacedPackageIds = new Set(unplacedPackages.map(({ packageInstanceId }) => packageIdByInstanceId.get(packageInstanceId)))
  const blocking = [
    ...issues.filter(({ severity }) => severity !== 'warning'),
    ...packages
      .filter(({ id, mustLoad }) => mustLoad && unplacedPackageIds.has(id))
      .map(({ id }): ConstraintIssue => ({ code: 'MUST_LOAD_UNPLACED', severity: 'blockApproval', params: { packageId: id } })),
  ]
  return { canApprove: blocking.length === 0 && !stale, issues: blocking, stale }
}

/** Số lý do chặn Duyệt theo từng loại (D-80) — nút Duyệt nói đúng loại lý do thay vì một con số chung. */
export type BlockerSummary = {
  readonly stale: boolean
  /** Số kiện gốc `mustLoad` còn instance chưa xếp. */
  readonly mustLoadUnplaced: number
  /** Số nhóm trục vượt giới hạn (trước, sau). */
  readonly axleOverload: number
  /** Lỗi ràng buộc còn lại của phương án (chồng lấn, vượt biên, tải đè…). */
  readonly constraintErrors: number
}

export function blockerSummary({ issues, stale }: Pick<ApprovalBlockers, 'issues' | 'stale'>): BlockerSummary {
  const mustLoadUnplaced = issues.filter(({ code }) => code === 'MUST_LOAD_UNPLACED').length
  const axleOverload = issues.filter(({ code }) => code === 'AXLE_OVERLOAD').length
  return { stale, mustLoadUnplaced, axleOverload, constraintErrors: issues.length - mustLoadUnplaced - axleOverload }
}

export type DeadlineReview<Stop> = {
  /** Điểm tới nơi sau hạn (`MISSED`), theo thứ tự đã nhận. */
  readonly missed: Stop[]
  /** Điểm sát hạn (`AT_RISK`): chỉ để hiện, không hỏi thêm. */
  readonly atRisk: Stop[]
  /** Điểm có hạn và kịp hạn (`OK`). */
  readonly onTime: Stop[]
  /** Có điểm trễ hạn: Duyệt cần người duyệt xác nhận (`force`). */
  readonly needsConfirmation: boolean
}

/**
 * Mức hạn của các điểm giao lúc Duyệt (D-80): điểm trễ hạn dự kiến không chặn nhưng phải được xác nhận, điểm sát hạn chỉ hiện thông
 * tin. Điểm không có hạn, hoặc chuyến chưa tối ưu tuyến (không điểm nào có mức hạn), không tính.
 */
export function deadlineReview<Stop extends { readonly deadlineStatus?: DeadlineStatus }>(stops: readonly Stop[]): DeadlineReview<Stop> {
  const withStatus = (status: DeadlineStatus) => stops.filter(({ deadlineStatus }) => deadlineStatus === status)
  const missed = withStatus('MISSED')
  return { missed, atRisk: withStatus('AT_RISK'), onTime: withStatus('OK'), needsConfirmation: missed.length > 0 }
}
