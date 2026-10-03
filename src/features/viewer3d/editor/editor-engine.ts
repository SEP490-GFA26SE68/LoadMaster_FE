import { createConstraintEngine, type ConstraintIssue, type PlacementPose } from '@/domain/constraints'
import type { ScenePlacement, ViewerSceneModel } from '../scene-input'

/** Kết quả kiểm một tư thế của kiện trong editor, theo mã domain; UI dịch qua `formatIssue`. */
export type EditorCheck = {
  /** Không có issue `error` nào dính tới kiện — chỉ khi đó mới commit (LM-035). */
  readonly valid: boolean
  readonly errors: readonly ConstraintIssue[]
  readonly warnings: readonly ConstraintIssue[]
  readonly supportRatio: number
  /** Kiện chồng lấn với kiện đang kiểm, dù issue `OVERLAP` báo ở kiện nào. */
  readonly overlapIds: readonly string[]
}

export type EditorEngine = {
  /** Đưa engine về đúng các placement hiệu lực (snapshot + draft): chỉ dời kiện có tư thế khác. Gọi sau commit, undo, redo, reset. */
  sync(placements: readonly ScenePlacement[]): void
  /** Kiểm kiện ở tư thế `placement` mà không đổi trạng thái engine (preview kéo, trước khi commit). */
  check(placement: ScenePlacement): EditorCheck
}

const poseOf = ({ position, orientation }: ScenePlacement): PlacementPose =>
  ({ xCm: position.x, yCm: position.y, zCm: position.z, orientation })

/**
 * Constraint engine của domain (LM-023) cho editor: dựng một lần cho mỗi snapshot, sau đó chỉ dời cục bộ. Issue của kiện là issue
 * có kiện làm chủ thể hoặc nằm trong `relatedIds`; issue toàn phương án không dính kiện (trọng tâm, tải trục) không chặn thao tác.
 * Scene không có đầu vào engine thì trả `null`; kho và tài xế không có editor.
 */
export function createEditorEngine(model: ViewerSceneModel): EditorEngine | null {
  if (!model.engineInput) return null
  const engine = createConstraintEngine(model.engineInput)
  const current = new Map(model.placements.map((placement) => [placement.id, poseOf(placement)]))

  return {
    sync(placements) {
      for (const placement of placements) {
        const pose = poseOf(placement), before = current.get(placement.id)
        if (before && before.xCm === pose.xCm && before.yCm === pose.yCm && before.zCm === pose.zCm && before.orientation === pose.orientation) continue
        engine.commitMove(placement.id, pose)
        current.set(placement.id, pose)
      }
    },
    check(placement) {
      const { id } = placement
      const evaluation = engine.evaluateMove(id, poseOf(placement))
      const issues = evaluation.byInstanceId.get(id) ?? []
      const overlapIds = issues
        .filter(({ code }) => code === 'OVERLAP')
        .flatMap((issue) => (issue.packageInstanceId === id ? (issue.relatedIds ?? []) : issue.packageInstanceId ? [issue.packageInstanceId] : []))
      const errors = issues.filter(({ severity }) => severity === 'error')
      return {
        valid: errors.length === 0,
        errors,
        warnings: issues.filter(({ severity }) => severity === 'warning'),
        supportRatio: evaluation.supportRatioById.get(id) ?? 0,
        overlapIds: [...new Set(overlapIds)],
      }
    },
  }
}
