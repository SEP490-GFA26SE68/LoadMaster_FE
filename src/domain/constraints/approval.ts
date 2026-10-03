import { expandPackages } from '@/domain/cargo'
import type { CargoPackage, UnplacedPackage } from '@/domain/models'
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
