import {
  approvalBlockers,
  createConstraintEngine,
  type ApprovalBlockers,
  type ConstraintIssue,
  type PlacementPatch,
} from '@/domain/constraints'
import type { ScenePlacement, ViewerSceneModel } from '../scene-input'
import type { ViewerDraft } from '../viewer-draft'

export type PlanApproval = {
  readonly blockers: ApprovalBlockers
  /** Cảnh báo còn lại của phương án sau khi áp draft — không chặn Duyệt, chỉ tóm tắt trong hộp thoại. */
  readonly warnings: readonly ConstraintIssue[]
  /** Patch gửi `approveRevision`: tư thế hiệu lực của mọi kiện draft đã dời hoặc xoay (ghim đi riêng, `pinned`). */
  readonly patches: readonly PlacementPatch[]
  /** Mã các kiện ghim của bản sẽ duyệt (tư thế hiệu lực của draft); gửi kèm Duyệt để ghim lưu cùng phương án (FE-BL-02). */
  readonly pinned: readonly string[]
  /** Draft có ghim hoặc bỏ ghim kiện nào so với phương án đang xem — thứ cần Duyệt để lưu, dù không dời kiện nào. */
  readonly pinsChanged: boolean
}

/**
 * Kiểm Duyệt cho Planner (LM-050): dựng constraint engine trên request + result của revision, áp tư thế draft, rồi
 * `approvalBlockers` của domain — còn `error`/`blockApproval`, kiện `mustLoad` chưa xếp, hoặc revision lỗi thời (D-24, D-31).
 * Phương án không có đầu vào engine (fixture benchmark) thì không Duyệt được: trả `null`.
 */
export function planApproval(
  model: ViewerSceneModel,
  placements: readonly ScenePlacement[],
  draft: ViewerDraft,
): PlanApproval | null {
  if (!model.engineInput) return null
  const byId = new Map(placements.map((placement) => [placement.id, placement]))
  const patches = [...draft.patches]
    .filter(([, patch]) => patch.position !== undefined || patch.orientation !== undefined)
    .flatMap(([id]): PlacementPatch[] => {
      const placement = byId.get(id)
      if (!placement) return []
      const { position, orientation } = placement
      return [{ packageInstanceId: id, xCm: position.x, yCm: position.y, zCm: position.z, orientation }]
    })

  const engine = createConstraintEngine(model.engineInput)
  for (const { packageInstanceId, ...pose } of patches) engine.commitMove(packageInstanceId, pose)
  const { issues } = engine.evaluateAll()

  const blockers = approvalBlockers({
    issues,
    packages: model.engineInput.packages,
    unplacedPackages: model.unplaced.map(({ id, reasonCode = 'UNKNOWN', message }) => ({
      packageInstanceId: id,
      reasonCode,
      message: message ?? reasonCode,
    })),
    stale: model.revision?.stale ?? false,
  })
  return {
    blockers,
    warnings: issues.filter(({ severity }) => severity === 'warning'),
    patches,
    pinned: placements.filter(({ pinned }) => pinned).map(({ id }) => id),
    pinsChanged: [...draft.patches.values()].some(({ pinned }) => pinned !== undefined),
  }
}
