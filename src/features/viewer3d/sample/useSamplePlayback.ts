import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ScenePlacement } from '../scene-input'
import { deriveSceneSemantics } from '../operations/scene-semantics'
import { useUnloadPlayback } from '../operations/useUnloadPlayback'
import type { PlaybackSpeed } from '../viewer-types'

export type SamplePlaybackMode = 'load' | 'unload'

/** Một bước phát ở tốc độ 1× — cùng nhịp với Planner (`STEP_DURATION_MS` của `useLoadPlanViewer`). */
const STEP_MS = 600
const NONE: readonly ScenePlacement[] = []

/**
 * Bước xếp của một lần phát, gắn với phương án đang xếp (`key`; `null` khi đang xem dỡ — nhịp xếp dừng hẳn). Lần phát mới (đổi phương án,
 * quay lại chế độ xếp) bắt đầu lại từ kiện đầu, hoặc đứng ở thùng đầy khi không tự phát.
 */
type LoadSession = { key: readonly ScenePlacement[] | null; step: number; playing: boolean }

/**
 * Phát lại của trang phương án mẫu (`SamplePlanViewer`), một nguồn cho khung 3D, thanh `Timeline` và phím tắt. `load`: từng kiện vào thùng
 * theo `loadingOrder` (như Planner, bước 1 → kiện cuối). `unload`: dỡ ở điểm `stop` theo `unloadingOrder` qua `useUnloadPlayback` (như màn
 * tài xế) — hàng các điểm trước đã giao (ẩn), hàng các điểm sau mờ, kiện điểm sau chắn lối kiện đang dỡ có viền cảnh báo (`inspectId`), che
 * kín thì dừng. Đổi phương án, chế độ hay điểm giao là một lần phát mới: tự chạy khi `autoplay`, không thì đứng yên (giảm chuyển động: thùng
 * đã đầy, điểm giao chưa dỡ kiện nào).
 */
export function useSamplePlayback(placements: readonly ScenePlacement[], mode: SamplePlaybackMode, stop: number, autoplay: boolean) {
  const [speed, setSpeed] = useState<PlaybackSpeed>(4)
  const totalSteps = useMemo(() => placements.reduce((max, p) => Math.max(max, p.step), 0), [placements])
  const key = mode === 'load' ? placements : null
  const fresh = (next: LoadSession['key']): LoadSession => {
    const play = next !== null && autoplay && totalSteps > 1
    return { key: next, step: play ? 1 : totalSteps, playing: play }
  }
  const [session, setSession] = useState<LoadSession>(() => fresh(key))
  if (session.key !== key) setSession(fresh(key))
  const step = Math.min(session.step, totalSteps)

  useEffect(() => {
    if (!session.playing) return
    const timer = window.setInterval(() => setSession((s) => s.step >= totalSteps ? { ...s, playing: false } : { ...s, step: s.step + 1 }),
      STEP_MS / speed)
    return () => window.clearInterval(timer)
  }, [session.playing, speed, totalSteps])

  // Đang xem xếp thì mô phỏng dỡ rỗng (không nhịp nào chạy); mỗi lần vào một điểm giao là một mảng mới nên dỡ bắt đầu lại từ kiện đầu
  const available = useMemo(() => mode === 'unload' ? placements.filter((p) => p.stop === stop) : NONE, [mode, placements, stop])
  const context = useMemo(() => placements.filter((p) => p.stop >= stop), [placements, stop])
  const delivered = useMemo(() => placements.filter((p) => p.stop < stop).map((p) => p.id), [placements, stop])
  const unload = useUnloadPlayback(available, speed, context)
  // Mỗi lần vào một điểm giao tự phát một lần; ref giữ để StrictMode chạy effect hai lần vẫn chỉ bật một lần
  const started = useRef<readonly ScenePlacement[] | null>(null)
  const { toggle } = unload
  useEffect(() => {
    if (started.current === available) return
    started.current = available
    if (autoplay && available.length) toggle()
  }, [available, autoplay, toggle])

  const currentId = unload.current?.id
  const nextId = unload.next?.id
  const unloadedIds = useMemo(() => new Set([...delivered, ...unload.unloadedIds]), [delivered, unload.unloadedIds])
  const semantics = useMemo(() => mode === 'load'
    ? deriveSceneSemantics(placements, { kind: 'loading', step })
    : deriveSceneSemantics(placements, {
      kind: 'unloading', step: 0, focusStop: stop, unloadedIds, lifo: unload.lifo,
      currentId, nextId, inspectId: currentId,
    }), [mode, placements, step, stop, unloadedIds, unload.lifo, currentId, nextId])

  const setStep = useCallback((value: number) =>
    setSession((s) => ({ ...s, playing: false, step: Math.max(Math.min(1, totalSteps), Math.min(totalSteps, value)) })), [totalSteps])
  const loading = {
    step, totalSteps, playing: session.playing,
    setStep,
    forward: () => setStep(step + 1),
    backward: () => setStep(step - 1),
    start: () => setStep(1),
    toggle: () => setSession((s) => s.playing ? { ...s, playing: false } : { ...s, playing: true, step: s.step >= totalSteps ? 1 : s.step }),
  }
  const unloading = {
    step: unload.cursor, totalSteps: unload.ordered.length, playing: unload.playing,
    setStep: unload.setCursor,
    forward: unload.advance,
    backward: () => unload.setCursor(unload.cursor - 1),
    start: () => { unload.stop(); unload.setCursor(0) },
    toggle: unload.toggle,
  }
  return { speed, setSpeed, semantics, available, unload, controls: mode === 'load' ? loading : unloading }
}
