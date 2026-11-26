import type { ScenePlacement } from '../scene-types'

/** Bước đang xem của lượt xếp / dỡ: n / N. */
export type StepPosition = { readonly step: number; readonly total: number }

export type CargoAtStep = {
  /** Kiện đang ở trên xe tại bước đang xem */
  readonly placements: readonly ScenePlacement[]
  /** `null` khi đó là cả phương án (xếp tới bước cuối, hoặc chưa dỡ kiện nào) */
  readonly at: StepPosition | null
}

/**
 * Hàng đang ở trên xe tại bước Planner đang xem (Spec vật lý 10.3) — tập chung cho trọng tâm G, tải trục và thẻ trọng tâm:
 * đang xếp thì các kiện có `step` ≤ bước đang xem, đang dỡ thì các kiện chưa dỡ. Xếp tới bước cuối hay chưa dỡ kiện nào thì là cả
 * phương án (kể cả bản đang chỉnh tay), không ghi bước.
 */
export function cargoAtStep(placements: readonly ScenePlacement[], input: {
  kind: 'loading' | 'unloading'
  step: number
  totalSteps: number
  unloadedIds: ReadonlySet<string>
  unloadTotal: number
}): CargoAtStep {
  if (input.kind === 'loading') {
    if (input.step >= input.totalSteps) return { placements, at: null }
    return { placements: placements.filter((p) => p.step <= input.step), at: { step: input.step, total: input.totalSteps } }
  }
  if (input.unloadedIds.size === 0) return { placements, at: null }
  return {
    placements: placements.filter((p) => !input.unloadedIds.has(p.id)),
    at: { step: input.unloadedIds.size, total: input.unloadTotal },
  }
}
