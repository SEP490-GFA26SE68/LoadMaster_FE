import type { ScenePlacement } from '../scene-types'
import type { CargoAppearance, SceneSemantics } from './scene-semantics'

/** Selection is inspection, never execution progress. Confirmed IDs come only from server outcomes. */
export function previewSemantics(placements: readonly ScenePlacement[], selectedId: string | null,
  confirmedIds: ReadonlySet<string> = new Set(), isolate = false): SceneSemantics {
  return {
    appearanceById: new Map(placements.map((p) => [p.id, {
      visibility: isolate && selectedId !== null && p.id !== selectedId ? 'hidden' : 'opaque',
      tone: p.id === selectedId ? 'current' : 'normal',
      state: confirmedIds.has(p.id) ? 'loaded' : 'future',
    } satisfies CargoAppearance])),
    currentId: null, nextId: null, blockers: [], lifo: null,
    massPlacements: placements, inspectionId: null,
  }
}
