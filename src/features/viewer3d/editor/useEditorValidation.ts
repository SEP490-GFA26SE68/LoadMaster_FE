import { useCallback, useMemo } from 'react'
import type { ConstraintIssue } from '@/domain/constraints'
import { formatIssue, useFormat, useT } from '@/lib/i18n'
import type { ScenePlacement, ViewerSceneModel } from '../scene-input'
import { createEditorEngine } from './editor-engine'
import type { GeometryResult } from './geometry'

/** Vật cản mà issue nói tới: kiện chồng lên vật cản, hoặc tựa lên mặt vật cản không chịu tải. */
function obstacleIdsOf(issues: readonly ConstraintIssue[]): string[] {
  const ids = issues.flatMap((issue) => issue.code === 'OBSTACLE_OVERLAP' || issue.code === 'NON_BEARING_SUPPORT' ? [issue.params.obstacleId] : [])
  return [...new Set(ids)]
}

/**
 * Kiểm một tư thế kiện bằng constraint engine của domain (LM-035) và dịch issue sang câu qua `formatIssue`. Engine dựng một lần
 * cho mỗi snapshot; mỗi lần kiểm đồng bộ engine với placement hiệu lực (sau commit, undo, redo, reset chỉ dời kiện đã đổi).
 * Lời gọi trong lúc kéo đã được `preview-store` giới hạn tần suất. Kiện đã dời mà hợp lệ không còn là "cảnh báo": `manual` riêng để
 * UI gắn nhãn xám "Đã chỉnh thủ công" (V2.3 quyết định 3) — chỉ ràng buộc thật mới tô hổ phách.
 */
export function useEditorValidation(model: ViewerSceneModel, placements: readonly ScenePlacement[]) {
  const t = useT()
  const format = useFormat()
  const engine = useMemo(() => createEditorEngine(model), [model])
  return useCallback((p: ScenePlacement): GeometryResult => {
    const source = model.placementById.get(p.id)
    const manual = !source || p.orientation !== source.orientation ||
      p.position.x !== source.position.x || p.position.y !== source.position.y || p.position.z !== source.position.z
    if (!engine) return { valid: true, errors: [], advisories: [], manual, supportRatio: 1, overlapIds: [], obstacleIds: [] }
    engine.sync(placements)
    const check = engine.check(p)
    return {
      valid: check.valid,
      errors: check.errors.map((issue) => formatIssue(issue, t, format)),
      advisories: check.warnings.map((issue) => formatIssue(issue, t, format)),
      manual,
      supportRatio: check.supportRatio,
      overlapIds: check.overlapIds,
      obstacleIds: obstacleIdsOf([...check.errors, ...check.warnings]),
    }
  }, [engine, model, placements, t, format])
}
