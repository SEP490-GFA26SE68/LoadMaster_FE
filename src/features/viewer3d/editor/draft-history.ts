import { createViewerDraft, patchPlacement, type PlacementPatch, type ViewerDraft } from '../viewer-draft'
import type { ViewerSceneModel } from '@/features/viewer3d/scene-input'
import { EDITOR_RULES } from './geometry'

export type CommandType = 'MOVE' | 'ROTATE' | 'PIN' | 'UNPIN' | 'RESET_PLACEMENT' | 'RESET_DRAFT' | 'GRAVITY_MOVE'
type Change = { id: string; before?: PlacementPatch; after?: PlacementPatch }
type Command = { type: CommandType; changes: Change[] }
export type DraftHistory = { draft: ViewerDraft; past: Command[]; future: Command[] }
export const createDraftHistory = (): DraftHistory => ({ draft: createViewerDraft(), past: [], future: [] })

/** History holds only changed patches. One gesture creates one command, never 1,000 placements. */
export function commitCommand(
  model: ViewerSceneModel, history: DraftHistory, type: CommandType, id?: string, patch: PlacementPatch = {},
): DraftHistory {
  let next = history.draft
  if (type === 'RESET_DRAFT') next = createViewerDraft()
  else if (id) next = patchPlacement(model, next, id, type === 'RESET_PLACEMENT'
    ? { position: undefined, orientation: undefined, pinned: undefined } : patch)
  const ids = type === 'RESET_DRAFT' ? [...history.draft.patches.keys()] : id ? [id] : []
  const changes = ids.filter((key) => history.draft.patches.get(key) !== next.patches.get(key))
    .map((key) => ({ id: key, before: history.draft.patches.get(key), after: next.patches.get(key) }))
  if (!changes.length) return history
  return { draft: next, past: [...history.past, { type, changes }].slice(-EDITOR_RULES.historyLimit), future: [] }
}

/**
 * Commit một gravity-move: item chính + các items bị rớt xuống đều được record
 * trong 1 command duy nhất để undo/redo hoạt động đúng.
 */
export function commitGravityMove(
  model: ViewerSceneModel,
  history: DraftHistory,
  primaryId: string,
  primaryPatch: PlacementPatch,
  fallenItems: Array<{ id: string; patch: PlacementPatch }>,
): DraftHistory {
  let next = history.draft
  next = patchPlacement(model, next, primaryId, primaryPatch)
  for (const { id, patch } of fallenItems) {
    next = patchPlacement(model, next, id, patch)
  }
  const allIds = [primaryId, ...fallenItems.map((f) => f.id)]
  const changes = allIds
    .filter((id) => history.draft.patches.get(id) !== next.patches.get(id))
    .map((id) => ({ id, before: history.draft.patches.get(id), after: next.patches.get(id) }))
  if (!changes.length) return history
  return {
    draft: next,
    past: [...history.past, { type: 'GRAVITY_MOVE', changes }].slice(-EDITOR_RULES.historyLimit),
    future: [],
  }
}

export function travelHistory(history: DraftHistory, direction: 'undo' | 'redo'): DraftHistory {
  const source = direction === 'undo' ? history.past : history.future
  const command = source.at(-1)
  if (!command) return history
  const patches = new Map(history.draft.patches)
  for (const change of command.changes) {
    const patch = direction === 'undo' ? change.before : change.after
    if (patch) patches.set(change.id, patch)
    else patches.delete(change.id)
  }
  return {
    draft: Object.freeze({ patches }),
    past: direction === 'undo' ? history.past.slice(0, -1) : [...history.past, command],
    future: direction === 'undo' ? [...history.future, command] : history.future.slice(0, -1),
  }
}
