import { createPlacementLayout, lifoIssues, type PlacementLayout } from '@/domain/constraints'
import { placementToBox, type PackagePlacement } from '@/domain/models'
import type { ScenePlacement } from '@/features/viewer3d/scene-input'

export type UnloadSequence = {
  readonly ordered: ScenePlacement[]
  /** `true`: thứ tự dỡ của kết quả (service hoặc FE tính lại khi Duyệt). `false`: kết quả thiếu thứ tự dỡ (`unloadingOrder = 0`), đang dùng thứ tự suy ra. */
  readonly fromResult: boolean
}

/**
 * Thứ tự phát dỡ (LM-036): theo `unloadingOrder` của kết quả. Kết quả thiếu thứ tự dỡ
 * (`unloadingOrder = 0`, mọi màn hiện đọc revision nên không còn nguồn nào như vậy) thì suy ra tạm: điểm giao tăng, kiện cao trước, gần cửa trước — chỉ là gợi ý, UI ghi rõ như vậy.
 */
export function unloadSequence(placements: readonly ScenePlacement[]): UnloadSequence {
  const fromResult = placements.every((p) => p.unloadingOrder > 0)
  const ordered = fromResult
    ? [...placements].sort((a, b) => a.unloadingOrder - b.unloadingOrder || a.id.localeCompare(b.id))
    : [...placements].sort((a, b) => a.stop - b.stop ||
      b.position.z + b.heightCm - a.position.z - a.heightCm ||
      b.position.x + b.lengthCm - a.position.x - a.lengthCm ||
      a.position.y - b.position.y || a.id.localeCompare(b.id))
  return { ordered, fromResult }
}

/** Kết quả kiểm LIFO của domain cho một kiện; `null` khi không kiện giao sau nào che lối dỡ. */
export type LifoBlockage = {
  readonly code: 'LIFO_BLOCKED' | 'LIFO_PARTIAL'
  /** Tỷ lệ mặt sau bị che, 0–1 */
  readonly coverage: number
  /** Kiện giao sau đang che, gần kiện đích trước (theo x) */
  readonly blockers: ScenePlacement[]
} | null

export type LifoIndex = {
  /** `lifoIssues` của domain trên các kiện chưa nằm trong `removedIds` (kiện đã dỡ hoặc đang ẩn). */
  blockage(target: ScenePlacement, removedIds?: ReadonlySet<string>): LifoBlockage
  /** Mọi kiện còn lại nằm trên hành lang thẳng từ mặt sau về cửa, bất kể điểm giao — dùng cho hình ảnh, không phải kiểm LIFO. */
  corridor(target: ScenePlacement, removedIds?: ReadonlySet<string>): ScenePlacement[]
}

function toPackagePlacement(p: ScenePlacement): PackagePlacement {
  return {
    packageInstanceId: p.id, orientation: p.orientation, xCm: p.position.x, yCm: p.position.y, zCm: p.position.z,
    placedLengthCm: p.lengthCm, placedWidthCm: p.widthCm, placedHeightCm: p.heightCm,
    loadingOrder: p.step, unloadingOrder: p.unloadingOrder, supportRatio: 1, constraintWarnings: [],
  }
}

const NO_REMOVED: ReadonlySet<string> = new Set()
const byDistance = (a: ScenePlacement, b: ScenePlacement) => a.position.x - b.position.x || a.id.localeCompare(b.id)

/**
 * Dựng lưới domain một lần cho một snapshot placement (D-29) — **lười**, ở lần hỏi đầu tiên: Planner giữ một index cho mỗi bản
 * placement nhưng chỉ hỏi khi đang dỡ hoặc xem kiện chắn lối, nên chế độ Xem / Xếp không trả giá dựng lưới. Kiện đã dỡ được gỡ khỏi
 * lưới bằng `grid.remove` và thêm lại khi tua lùi, nên mỗi lần hỏi chỉ đổi phần chênh lệch của `removedIds`. Mọi `target` phải thuộc
 * `placements`.
 */
export function createLifoIndex(placements: readonly ScenePlacement[]): LifoIndex {
  let built: PlacementLayout | undefined
  const byId = new Map(placements.map((p) => [p.id, p]))
  const rules = { deliveryStopByInstanceId: new Map(placements.map((p) => [p.id, p.stop])), enforceLifo: true }
  const removed = new Set<string>()
  const sync = (next: ReadonlySet<string>): PlacementLayout => {
    const layout = built ??= createPlacementLayout({ obstacles: [] }, placements.map(toPackagePlacement))
    for (const id of removed) {
      if (next.has(id)) continue
      removed.delete(id)
      const placement = layout.placements.get(id)
      if (placement) layout.grid.update(id, placementToBox(placement))
    }
    for (const id of next) {
      if (removed.has(id) || !byId.has(id)) continue
      removed.add(id)
      layout.grid.remove(id)
    }
    return layout
  }
  const placementOf = (id: string) => byId.get(id)!
  return {
    blockage(target, removedIds = NO_REMOVED) {
      const layout = sync(removedIds)
      const [issue] = lifoIssues(toPackagePlacement(target), rules, layout)
      if (!issue) return null
      return { code: issue.code, coverage: issue.params.coverage, blockers: (issue.relatedIds ?? []).map(placementOf).sort(byDistance) }
    },
    corridor(target, removedIds = NO_REMOVED) {
      return sync(removedIds).grid.queryRearCorridor(placementToBox(toPackagePlacement(target)), { excludeId: target.id }).map(placementOf).sort(byDistance)
    },
  }
}

/** Duyệt: số kiện bị kiện giao sau che kín / che một phần lối dỡ trên toàn phương án (Spec 7.11, D-26). */
export function countLifoIssues(placements: readonly ScenePlacement[]): { blocked: number; partial: number } {
  const index = createLifoIndex(placements)
  let blocked = 0, partial = 0
  for (const p of placements) {
    const result = index.blockage(p)
    if (result?.code === 'LIFO_BLOCKED') blocked++
    else if (result) partial++
  }
  return { blocked, partial }
}
