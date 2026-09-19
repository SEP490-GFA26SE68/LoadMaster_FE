import { useCallback, useEffect, useMemo, useState } from 'react'
import { nextOrientation, type OrientationCode } from '@/domain/geometry'
import type { ScenePlacement, PositionCm } from '@/features/viewer3d/scene-input'
import type { LoadPlanViewerState } from '../useLoadPlanViewer'
import { orientedSize } from '@/features/viewer3d/scene-input'
import { useT } from '@/lib/i18n'
import { roundPosition, type Axis } from './geometry'
import { useEditorValidation } from './useEditorValidation'
import { createPreviewStore } from './preview-store'
import { snapPosition } from './snapping'
import { simulateGravityAfterMove } from './gravity'
import { commitGravityMove } from './draft-history'

export type DragPlane = 'xy' | 'xz' | 'yz'
export const PLANE_AXES: Record<DragPlane, readonly Axis[]> = { xy: ['x', 'y'], xz: ['x', 'z'], yz: ['y', 'z'] }

export function useManualEditor(state: LoadPlanViewerState) {
  const t = useT()
  const [mode, setModeState] = useState<'view' | 'edit'>('view')
  const [plane, setPlane] = useState<DragPlane>('xy')
  const [nudgeCm, setNudgeCm] = useState(1)
  const [snapping, setSnapping] = useState(true)
  const [focus, setFocus] = useState<{ placement: ScenePlacement; request: number; follow?: boolean } | null>(null)
  const preview = useMemo(() => createPreviewStore(), [])
  const { selected, placements, sceneModel, draft } = state
  const patch = selected ? draft.patches.get(selected.id) : undefined
  const manual = Boolean(patch?.position || patch?.orientation !== undefined)
  const inspect = useEditorValidation(sceneModel, placements)
  const validation = useMemo(() => selected ? inspect(selected) : null, [selected, inspect])

  const setMode = (next: 'view' | 'edit') => {
    state.stopPlaying()
    preview.publish(null, true)
    setModeState(next)
  }
  const commitMove = (id: string, position: PositionCm) => {
    const p = placements.find((item) => item.id === id)
    if (!p || p.pinned || mode !== 'edit') return false
    const candidate = { ...p, position: roundPosition(position) }
    const result = inspect(candidate)
    preview.publish({ id, position: candidate.position, result, sources: [], dragging: false,
      message: t(result.valid ? 'viewer.editor.placed' : 'viewer.editor.placeRejected') }, true)
    if (!result.valid) return false

    // Simulate gravity: find items that were resting on `p` and now float
    const prevPlacements = placements
    const nextPlacements = placements.map((item) => item.id === id ? candidate : item)
    const fallen = simulateGravityAfterMove(id, prevPlacements, nextPlacements)

    if (fallen.length > 0) {
      // Commit primary + fallen items atomically (1 undo step)
      state.commitGravityMove(id, { position: candidate.position }, fallen.map((f) => ({ id: f.id, patch: { position: f.position } })))
      console.log(`[gravity] item ${id} moved → ${fallen.length} items settled:`, fallen.map(f => `${f.id} z:${f.position.z}`))
    } else {
      state.commitDraft('MOVE', id, { position: candidate.position })
    }
    return true
  }
  const rotate = (orientation: OrientationCode) => {
    if (!selected || selected.pinned || preview.getLatest()?.dragging) return
    const candidate = { ...selected, ...orientedSize(sceneModel.baseDimensionsById.get(selected.id)!, orientation), orientation }
    const result = inspect(candidate)
    preview.publish({ id: selected.id, position: selected.position, result, sources: [], dragging: false,
      message: t(result.valid ? 'viewer.editor.rotated' : 'viewer.editor.rotateRejected') }, true)
    if (result.valid) state.setOrientation(selected.id, orientation)
  }
  const nudge = (axis: Axis, direction: number) => {
    if (!selected || preview.getLatest()?.dragging) return
    commitMove(selected.id, { ...selected.position, [axis]: selected.position[axis] + direction * nudgeCm })
  }
  const snap = () => {
    if (!selected || preview.getLatest()?.dragging) return
    commitMove(selected.id, snapPosition(selected, selected.position, placements, sceneModel.vehicle).position)
  }
  const focusSelected = () => {
    if (selected && !preview.getLatest()?.dragging) setFocus((current) => ({ placement: selected, request: (current?.request ?? 0) + 1 }))
  }
  const focusPlacement = useCallback((placement: ScenePlacement) => {
    if (!preview.getLatest()?.dragging) setFocus((current) => ({ placement, request: (current?.request ?? 0) + 1 }))
  }, [preview])
  const followPlacement = useCallback((placement: ScenePlacement) => {
    if (!preview.getLatest()?.dragging) setFocus((current) => ({ placement, request: (current?.request ?? 0) + 1, follow: true }))
  }, [preview])
  const undo = () => { if (!preview.getLatest()?.dragging) { preview.publish(null, true); state.undo() } }
  const redo = () => { if (!preview.getLatest()?.dragging) { preview.publish(null, true); state.redo() } }
  const resetPlacement = () => {
    if (!selected || preview.getLatest()?.dragging) return
    const source = sceneModel.placementById.get(selected.id)!
    const result = inspect(source)
    // Other edits can occupy the original slot. Reset all remains an exact snapshot restore.
    preview.publish({ id: source.id, position: source.position, result, sources: [], dragging: false,
      message: t(result.valid ? 'viewer.editor.restored' : 'viewer.editor.restoreRejected') }, true)
    if (result.valid) state.commitDraft('RESET_PLACEMENT', selected.id)
  }
  const resetDraft = () => { preview.publish(null, true); state.commitDraft('RESET_DRAFT') }
  const togglePin = () => {
    if (selected && !preview.getLatest()?.dragging) { preview.publish(null, true); state.togglePinned(selected.id) }
  }

  useEffect(() => {
    if (mode !== 'edit') return
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target instanceof HTMLElement ? event.target : null
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return
      if (preview.getLatest()?.dragging) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo(); else undo()
      } else if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        const movement: Record<string, [Axis, number]> = {
          ArrowRight: ['x', 1], ArrowLeft: ['x', -1], ArrowUp: ['y', 1], ArrowDown: ['y', -1],
          PageUp: ['z', 1], PageDown: ['z', -1],
        }
        const move = movement[event.key]
        if (move) { event.preventDefault(); nudge(...move) }
        if (event.key.toLowerCase() === 'r' && selected) {
          event.preventDefault(); rotate(nextOrientation({ ...sceneModel.baseDimensionsById.get(selected.id)!, ...sceneModel.orientationRulesById.get(selected.id)! }, selected.orientation))
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  return {
    mode, setMode, plane, setPlane, nudgeCm, setNudgeCm, snapping, setSnapping, preview,
    focus, resetFocus: () => setFocus(null), focusSelected, focusPlacement, followPlacement, inspect, commitMove, rotate, nudge, snap, undo, redo, resetPlacement, resetDraft,
    togglePin, validation, manual,
  }
}
export type ManualEditor = ReturnType<typeof useManualEditor>
