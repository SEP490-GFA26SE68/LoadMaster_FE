import type { ScenePlacement } from '@/features/viewer3d/scene-input'
import { createLifoIndex, type LifoBlockage, type LifoIndex } from './unloading'

export type CargoAppearance = {
  visibility: 'opaque' | 'dim' | 'hidden'
  tone: 'normal' | 'muted' | 'current' | 'blocker'
  state: 'loaded' | 'current' | 'next' | 'future' | 'removed'
}
export type SceneSemantics = {
  appearanceById: ReadonlyMap<string, CargoAppearance>
  currentId: string | null
  nextId: string | null
  /** Kiện giao sau che lối dỡ của kiện đang xem, gần kiện đó trước (`lifo.blockers`) */
  blockers: readonly ScenePlacement[]
  /** Kiểm LIFO của domain cho kiện đang xem trên các kiện còn hiện */
  lifo: LifoBlockage
  massPlacements: readonly ScenePlacement[]
  inspectionId: string | null
}
export type OperationsInput = {
  kind: 'loading' | 'unloading'
  step: number
  /** Kiện không còn trên xe — đã dỡ, hoặc kho báo thiếu (kho và tài xế, LM-100): vẽ như đã gỡ, không tính trọng tâm. */
  unloadedIds?: ReadonlySet<string>
  currentId?: string | null
  nextId?: string | null
  focusStop?: number | null
  inspectId?: string | null
  isolateId?: string | null
  /** Chỉ mục LIFO dựng từ đúng `placements` này (dùng lại của mô phỏng dỡ); thiếu thì dựng khi có kiện cần xem. */
  lifo?: LifoIndex
}

/** Shared semantic state for planner/warehouse/driver, with no Three.js or role-specific branches. */
export function deriveSceneSemantics(placements: readonly ScenePlacement[], input: OperationsInput): SceneSemantics {
  const currentId = input.kind === 'loading' ? placements.find((p) => p.step === input.step)?.id ?? null : input.currentId ?? null
  // Kiện kế tiếp: bước nhỏ nhất sau bước đang xem (trùng bước thì kiện đứng trước) — một lượt quét, không chép và sắp cả nghìn kiện mỗi bước
  let next: ScenePlacement | undefined
  if (input.kind === 'loading') for (const p of placements) if (p.step > input.step && (!next || p.step < next.step)) next = p
  const nextId = input.kind === 'loading' ? next?.id ?? null : input.nextId ?? null
  const massPlacements = placements.filter((p) => !input.unloadedIds?.has(p.id) &&
    (input.focusStop != null ? p.stop >= input.focusStop : input.kind === 'loading' ? p.step <= input.step : true))
  const appearanceById = new Map<string, CargoAppearance>()
  for (const p of placements) {
    const removed = input.unloadedIds?.has(p.id) || (input.focusStop != null && p.stop < input.focusStop)
    const current = p.id === currentId, next = p.id === nextId
    let visibility: CargoAppearance['visibility'] = removed ? 'hidden'
      : input.kind === 'loading' && p.step > input.step ? next ? 'dim' : 'hidden' : 'opaque'
    if (!removed && input.focusStop != null) visibility = p.stop === input.focusStop ? 'opaque' : 'dim'
    const tone = current ? 'current' : input.focusStop != null && p.stop === input.focusStop ? 'normal' : 'muted'
    appearanceById.set(p.id, { visibility, tone, state: removed ? 'removed' : current ? 'current' : next ? 'next'
      : input.kind === 'loading' && p.step < input.step ? 'loaded' : 'future' })
  }
  const target = placements.find((p) => p.id === input.inspectId && appearanceById.get(p.id)?.visibility !== 'hidden')
  // Kiện đang ẩn (đã dỡ, chưa xếp, điểm trước) được coi như không còn trên xe
  const hiddenIds = target ? new Set([...appearanceById].filter(([, a]) => a.visibility === 'hidden').map(([id]) => id)) : undefined
  const lifo = target ? (input.lifo ?? createLifoIndex(placements)).blockage(target, hiddenIds) : null
  const blockers = lifo?.blockers ?? []
  if (target) {
    const ids = new Set(blockers.map((p) => p.id))
    for (const [id, appearance] of appearanceById) {
      if (appearance.visibility === 'hidden') continue
      appearance.visibility = id === target.id || ids.has(id) ? 'opaque' : 'dim'
      appearance.tone = id === target.id ? 'current' : ids.has(id) ? 'blocker' : 'muted'
    }
  }
  if (input.isolateId) for (const [id, appearance] of appearanceById) {
    appearance.visibility = id === input.isolateId ? 'opaque' : 'hidden'
  }
  return { appearanceById, currentId, nextId, blockers, lifo, massPlacements, inspectionId: target?.id ?? null }
}
