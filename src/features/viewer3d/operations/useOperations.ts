import { useCallback, useMemo, useState } from 'react'
import type { LoadPlanViewerState } from '../useLoadPlanViewer'
import { deriveSceneSemantics } from './scene-semantics'
import { useUnloadPlayback } from './useUnloadPlayback'

export function useOperations(state: LoadPlanViewerState) {
  const [kind, setKindState] = useState<'loading' | 'unloading'>('loading')
  const [loadingFocus, setLoadingFocus] = useState<number | null>(null)
  const [showMass, setShowMass] = useState(false)
  // Dải vùng điểm giao là cue nghiệp vụ: mở Planner là thấy, tắt được ở hộp Hiển thị (FE-5b-07)
  const [showZones, setShowZones] = useState(true)
  const [inspectBlockers, setInspectBlockers] = useState(false)
  const [follow, setFollow] = useState<'off' | 'on' | 'paused'>('off')
  const unload = useUnloadPlayback(state.placements, state.speed)
  // Hàm trả ra giữ tham chiếu giữa các lần vẽ (chỉ đổi khi thứ chúng đọc đổi): khung 3D, phím tắt và listener của camera không gắn lại
  // mỗi lần phiên vẽ lại
  const { stopPlaying, setCameraPreset, select, setStep, placements } = state
  const { stop: stopUnload, setCursor, ordered, cursor } = unload
  const stop = useCallback(() => { stopPlaying(); stopUnload() }, [stopPlaying, stopUnload])
  const setKind = useCallback((next: 'loading' | 'unloading') => {
    stop(); setKindState(next); setInspectBlockers(next === 'unloading')
    if (next === 'unloading') {
      setCursor(0); setCameraPreset('cua-sau')
      select(ordered[0]?.id ?? null)
    }
  }, [stop, setCursor, setCameraPreset, select, ordered])
  const focusStop = kind === 'loading' ? loadingFocus : unload.current?.stop ?? ordered.at(-1)?.stop ?? null
  const setFocusStop = useCallback((value: number | null) => {
    stop()
    if (kind === 'loading') {
      setLoadingFocus(value)
      const first = value === null ? undefined : placements.filter((p) => p.stop === value).sort((a, b) => a.step - b.step)[0]
      if (first) { setStep(first.step); select(first.id) }
    }
    else {
      const index = ordered.findIndex((p) => p.stop === value)
      if (index >= 0) { setCursor(index); select(ordered[index]!.id) }
    }
    if (value !== null) setCameraPreset('cua-sau')
  }, [stop, kind, placements, setStep, select, ordered, setCursor, setCameraPreset])
  const inspected = kind === 'unloading' ? unload.current?.id : state.selectedId
  const semantics = useMemo(() => deriveSceneSemantics(state.placements, {
    kind, step: state.step, focusStop, unloadedIds: kind === 'unloading' ? unload.unloadedIds : undefined,
    currentId: unload.current?.id, nextId: unload.next?.id, inspectId: inspectBlockers || (kind === 'unloading' && unload.warning) ? inspected : null,
    lifo: unload.lifo,
  }), [state.placements, state.step, inspected, kind, focusStop, unload.unloadedIds, unload.current, unload.next, unload.warning, unload.lifo, inspectBlockers])
  const current = state.placements.find((p) => p.id === semantics.currentId)
  const next = state.placements.find((p) => p.id === semantics.nextId)
  const togglePlaying = kind === 'loading' ? state.togglePlaying : unload.toggle
  const stepForward = kind === 'loading' ? state.stepForward : unload.advance
  const stepBackwardUnload = useCallback(() => setCursor(cursor - 1), [setCursor, cursor])
  const stepBackward = kind === 'loading' ? state.stepBackward : stepBackwardUnload
  const { goToStart: goToStartLoading } = state
  const goToStart = useCallback(() => { stop(); if (kind === 'loading') goToStartLoading(); else setCursor(0) }, [stop, kind, goToStartLoading, setCursor])
  const pauseFollow = useCallback(() => setFollow((f) => f === 'on' ? 'paused' : f), [])
  return { kind, setKind, focusStop, setFocusStop, showMass, setShowMass, showZones, setShowZones,
    follow, setFollow, pauseFollow,
    inspectBlockers, setInspectBlockers, semantics, current, next, unload, stop,
    playing: kind === 'loading' ? state.playing : unload.playing, togglePlaying, stepForward, stepBackward, goToStart }
}
export type OperationsState = ReturnType<typeof useOperations>
