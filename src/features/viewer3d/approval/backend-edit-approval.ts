import { createConstraintEngine, type ConstraintIssue } from '@/domain/constraints'
import { rotationTypeOf } from '../backend-plan-scene'
import type { ScenePlacement, ViewerSceneModel } from '../scene-input'
import type { BackendPlacementEdit } from '../viewer-backend-api'
import type { ViewerDraft } from '../viewer-draft'
import { planApproval } from './plan-approval'

export type BackendEditApproval = {
  /** Chỗ xếp đã dời hoặc xoay, theo mã số placement của máy chủ. */
  readonly edits: readonly BackendPlacementEdit[]
  /** Mã số placement đang ghim của bản sẽ duyệt — chỉ gửi khi draft đổi ghim; vắng là giữ ghim của phương án nguồn. */
  readonly pinnedPlacementIds: readonly string[] | undefined
  /** Draft có dời / xoay hoặc đổi ghim — thứ "Duyệt bản chỉnh" gửi đi. */
  readonly hasEdits: boolean
  /** Lỗi ràng buộc mới do bản chỉnh gây ra (lỗi có sẵn trong phương án của máy chủ không tính: máy chủ đã nhận nó). */
  readonly errors: readonly ConstraintIssue[]
}

function issueKey(issue: ConstraintIssue): string {
  return `${issue.code}|${issue.packageInstanceId ?? ''}|${[...(issue.relatedIds ?? [])].sort().join(',')}`
}

/** Lỗi của phương án máy chủ trước khi chỉnh — tính một lần mỗi snapshot. */
export function baselineErrorKeys(model: ViewerSceneModel): ReadonlySet<string> {
  if (!model.engineInput) return new Set()
  const { issues } = createConstraintEngine(model.engineInput).evaluateAll()
  return new Set(issues.filter(({ severity }) => severity !== 'warning').map(issueKey))
}

/**
 * "Duyệt bản chỉnh" của Planner bản máy chủ: patch của draft đổi sang mã số placement và mã hướng đặt của máy chủ
 * (`POST /api/load-plans/{id}/approve-edits`), cùng các lỗi ràng buộc bản chỉnh mới gây ra để chặn trước khi gửi. Máy chủ kiểm lại.
 */
export function backendEditApproval(
  model: ViewerSceneModel,
  placements: readonly ScenePlacement[],
  draft: ViewerDraft,
  placementIds: ReadonlyMap<string, string>,
  baseline: ReadonlySet<string>,
): BackendEditApproval | null {
  const approval = planApproval(model, placements, draft)
  if (!approval) return null
  const edits = approval.patches.flatMap((patch): BackendPlacementEdit[] => {
    const placementId = placementIds.get(patch.packageInstanceId)
    return placementId === undefined ? [] : [{
      placementId, x: patch.xCm, y: patch.yCm, z: patch.zCm, rotationType: rotationTypeOf(patch.orientation),
    }]
  })
  const pinnedPlacementIds = approval.pinsChanged
    ? approval.pinned.flatMap((id) => { const placementId = placementIds.get(id); return placementId === undefined ? [] : [placementId] })
    : undefined
  return {
    edits,
    pinnedPlacementIds,
    hasEdits: edits.length > 0 || approval.pinsChanged,
    errors: approval.blockers.issues.filter((issue) => issue.code !== 'MUST_LOAD_UNPLACED' && !baseline.has(issueKey(issue))),
  }
}
