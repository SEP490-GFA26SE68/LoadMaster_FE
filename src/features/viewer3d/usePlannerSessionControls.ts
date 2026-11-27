import { startTransition, useCallback, useEffect, useMemo } from 'react'
import type { ManualEditor } from './editor/useManualEditor'
import type { OperationsState } from './operations/useOperations'
import type { SimulationControlsProps } from './panels/WorkspaceToolbar'
import type { ScenePlacement, SceneStop } from './scene-input'
import type { LoadPlanViewerState } from './useLoadPlanViewer'

/**
 * Phần điều khiển chung của hai phiên Planner (kho mẫu và máy chủ): đổi chế độ Xem / Chỉnh sửa, tập trung và chọn kiện, nhóm Xếp/Dỡ –
 * điểm giao – góc nhìn, "Xoay một vòng", theo bước và phím tắt của chế độ Xem (Space phát/dừng, ←/→ lùi/tiến một bước, Home về đầu).
 *
 * Mọi hàm và object trả về **giữ tham chiếu** qua bước phát lại và lần chọn kiện không đổi chúng: thanh trên, thanh công cụ, HUD và thẻ
 * kiện bọc `memo` nên chỉ vẽ lại khi giá trị chúng đọc thật sự đổi (repo không có React Compiler, nên giữ tham chiếu bằng tay ở đây).
 */
export function usePlannerSessionControls(state: LoadPlanViewerState, operations: OperationsState, editor: ManualEditor,
  { stops, reducedMotion }: { stops: readonly SceneStop[]; reducedMotion: boolean }) {
  const { stop, setFollow, pauseFollow, setKind, setFocusStop, kind, focusStop, follow, current } = operations
  const { togglePlaying, stepForward, stepBackward, goToStart } = operations
  const { stopSpin, cameraPreset, setCameraPreset, spinning, toggleSpin, select } = state
  const { setMode, mode, followPlacement, focusPlacement, focusSelected, resetFocus } = editor
  const hasFocus = editor.focus !== null

  const handleModeChange = useCallback((next: 'view' | 'edit') => { stop(); setFollow('off'); stopSpin(); setMode(next) },
    [stop, setFollow, stopSpin, setMode])
  // Theo bước đổi điểm tập trung mỗi bước: hàm chỉ đổi khi có / hết điểm tập trung, không theo từng kiện
  const handleResetFocus = useMemo(() => hasFocus ? () => { setFollow('off'); resetFocus() } : undefined, [hasFocus, setFollow, resetFocus])
  const handleFocus = useCallback((p?: ScenePlacement) => { pauseFollow(); if (p) focusPlacement(p); else focusSelected() },
    [pauseFollow, focusPlacement, focusSelected])
  const handleSelect = useCallback((p: ScenePlacement) => { select(p.id); pauseFollow(); focusPlacement(p) }, [select, pauseFollow, focusPlacement])
  const simulation = useMemo<SimulationControlsProps>(() => ({
    kind, onKind: setKind, focusStop, onFocusStop: setFocusStop, stops, preset: cameraPreset, onPreset: setCameraPreset,
  }), [kind, setKind, focusStop, setFocusStop, stops, cameraPreset, setCameraPreset])
  const spin = useMemo(() => reducedMotion ? undefined : { active: spinning, onToggle: toggleSpin }, [reducedMotion, spinning, toggleSpin])

  useEffect(() => { if (follow === 'on' && current && mode === 'view') followPlacement(current) }, [follow, current, mode, followPlacement])
  useEffect(() => {
    if (mode === 'edit') return
    function handleKeyDown(event: KeyboardEvent) {
      // Không cướp phím khi người dùng đang gõ trong ô nhập, hộp thoại hoặc danh sách của Select đang mở (Space chọn dòng).
      const target = event.target instanceof HTMLElement ? event.target : null
      if (target?.closest('input, textarea, select, button, a, [contenteditable="true"], [role="dialog"], [role="listbox"]')) return
      // Bước mới vẽ trong một transition: lượt xử lý phím chỉ ghi state, phần vẽ chạy ở tác vụ sau (cắt nhỏ được), giữ phím thì
      // chỉ bước cuối được vẽ
      if (event.key === ' ') { event.preventDefault(); startTransition(togglePlaying) }
      else if (event.key === 'ArrowRight') startTransition(stepForward)
      else if (event.key === 'ArrowLeft') startTransition(stepBackward)
      else if (event.key === 'Home') startTransition(goToStart)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePlaying, stepForward, stepBackward, goToStart, mode])

  return { handleModeChange, handleResetFocus, handleFocus, handleSelect, simulation, spin }
}
