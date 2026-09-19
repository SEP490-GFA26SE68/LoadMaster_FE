import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CameraPreset, ColorMode, PlaybackSpeed } from '@/features/viewer3d/viewer-types'
import type { OrientationCode } from '@/domain/geometry'
import type { ViewerSceneModel } from '@/features/viewer3d/scene-input'
import { resolveEffectiveScene, type PlacementPatch } from './viewer-draft'
import { commitCommand, commitGravityMove, createDraftHistory, travelHistory, type CommandType } from './editor/draft-history'

/**
 * Toàn bộ state tương tác của màn xem phương án 3D.
 * Scene chỉ nhận giá trị và callback từ đây, không tự giữ state nghiệp vụ.
 */

/** Một bước phát lại ở tốc độ 1× — trong khoảng 400–700ms của mục 8. */
export const STEP_DURATION_MS = 600

export type LeftTab = 'unplaced' | 'pinned' | 'placed'

export function useLoadPlanViewer(
  sceneModel: ViewerSceneModel,
  { initialSelectedId }: { initialSelectedId?: string } = {},
) {
  // ViewerPage keys each session by snapshot. No draft is carried to another plan.
  const totalSteps = Math.max(0, ...sceneModel.placements.map((p) => p.step))
  const initialSelected = initialSelectedId ? sceneModel.placementById.get(initialSelectedId) : undefined

  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('goc-cheo')
  const [colorMode, setColorMode] = useState<ColorMode>('diem-giao')
  const [sliceCm, setSliceCm] = useState(sceneModel.vehicle.innerLengthCm)
  // Mở màn là thấy trọn phương án; timeline chỉ tua khi người dùng chủ động.
  const [step, setStepState] = useState(totalSteps)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<PlaybackSpeed>(2)
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelected?.id ?? null,
  )
  const [leftTab, setLeftTab] = useState<LeftTab>('unplaced')
  const [history, setHistory] = useState(createDraftHistory)
  const draft = history.draft
  const effectiveScene = useMemo(() => resolveEffectiveScene(sceneModel, draft), [sceneModel, draft])
  const placements = effectiveScene.placements

  const setStep = useCallback(
    (next: number) => setStepState(Math.min(totalSteps, Math.max(totalSteps > 0 ? 1 : 0, next))),
    [totalSteps],
  )

  const stepForward = useCallback(() => setStepState((s) => Math.min(totalSteps, s + 1)), [totalSteps])
  const stepBackward = useCallback(() => setStepState((s) => Math.max(1, s - 1)), [])
  const goToStart = useCallback(() => {
    setPlaying(false)
    setStepState(1)
  }, [])

  const togglePlaying = useCallback(() => {
    setPlaying((current) => {
      // Bấm phát khi đã ở cuối thì xem lại từ đầu.
      if (!current && step >= totalSteps) setStepState(1)
      return !current
    })
  }, [step, totalSteps])

  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => {
      setStepState((s) => {
        if (s >= totalSteps) {
          setPlaying(false)
          return s
        }
        return s + 1
      })
    }, STEP_DURATION_MS / speed)
    return () => window.clearInterval(id)
  }, [playing, speed, totalSteps])


  const commitDraft = useCallback((type: CommandType, id?: string, patch?: PlacementPatch) => {
    setHistory((current) => commitCommand(sceneModel, current, type, id, patch))
  }, [sceneModel])

  const commitGravityMoveFn = useCallback((
    primaryId: string,
    primaryPatch: PlacementPatch,
    fallenItems: Array<{ id: string; patch: PlacementPatch }>,
  ) => {
    setHistory((current) => commitGravityMove(sceneModel, current, primaryId, primaryPatch, fallenItems))
  }, [sceneModel])
  const undo = useCallback(() => setHistory((current) => travelHistory(current, 'undo')), [])
  const redo = useCallback(() => setHistory((current) => travelHistory(current, 'redo')), [])
  const stopPlaying = useCallback(() => setPlaying(false), [])

  // Programmatic commits still cross one boundary; pointer previews never call this.
  const updatePlacement = useCallback(
    (id: string, patch: PlacementPatch) => commitDraft('MOVE', id, patch),
    [commitDraft],
  )
  const setOrientation = useCallback(
    (id: string, orientation: OrientationCode) => commitDraft('ROTATE', id, { orientation }),
    [commitDraft],
  )

  const togglePinned = useCallback(
    (id: string) =>
      setHistory((current) => {
        const base = sceneModel.placementById.get(id)
        if (!base) return current
        const pinned = current.draft.patches.get(id)?.pinned ?? base.pinned
        return commitCommand(sceneModel, current, pinned ? 'UNPIN' : 'PIN', id, { pinned: !pinned })
      }),
    [sceneModel],
  )

  const selected = selectedId ? effectiveScene.placementById.get(selectedId) : undefined

  return {
    sceneModel,
    draft,
    commitDraft, commitGravityMove: commitGravityMoveFn, undo, redo, canUndo: history.past.length > 0, canRedo: history.future.length > 0, stopPlaying,
    updatePlacement,
    placements,
    totalSteps,
    cameraPreset,
    setCameraPreset,
    colorMode,
    setColorMode,
    sliceCm,
    setSliceCm,
    step,
    setStep,
    stepForward,
    stepBackward,
    goToStart,
    playing,
    togglePlaying,
    speed,
    setSpeed,
    selectedId,
    selected,
    select: setSelectedId,
    leftTab,
    setLeftTab,
    setOrientation,
    togglePinned,
  }
}

export type LoadPlanViewerState = ReturnType<typeof useLoadPlanViewer>
