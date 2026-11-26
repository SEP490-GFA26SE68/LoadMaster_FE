import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ScenePlacement } from '@/features/viewer3d/scene-input'
import { createLifoIndex, unloadSequence } from './unloading'

/** Một bước phát ở tốc độ 1× của màn tài xế và phương án mẫu — trong khoảng 400–700 ms của mục 8. */
const STEP_MS = 600

/**
 * Mô phỏng dỡ theo `unloadingOrder` của kết quả (LM-036). Trước mỗi bước, kiểm LIFO của domain trên các kiện còn lại của
 * `context`: `LIFO_BLOCKED` dừng mô phỏng và giữ kiện đích; `LIFO_PARTIAL` chỉ được đánh dấu trong scene, mô phỏng đi tiếp.
 * `context` phải chứa `placements` (tài xế: mọi kiện chưa giao, kể cả điểm sau).
 * `stepMs` (Planner): khoảng chờ trước khi dỡ kiện `target` — thời gian thật ước tính ÷ hệ số; vắng thì mỗi bước 600 ms ÷ `speed`.
 * Hàm phải giữ tham chiếu giữa các lần vẽ, nếu không bộ hẹn giờ của bước đang chờ bị đặt lại.
 */
export function useUnloadPlayback(
  placements: readonly ScenePlacement[], speed = 2, context: readonly ScenePlacement[] = placements,
  stepMs?: (target: ScenePlacement) => number,
) {
  const { ordered, fromResult } = useMemo(() => unloadSequence(placements), [placements])
  const lifo = useMemo(() => createLifoIndex(context), [context])
  const [session, setSession] = useState({ source: placements, cursor: 0, playing: false, warning: 0 })
  // Geometry/order changes start a fresh simulation; history stays in ViewerDraft.
  if (session.source !== placements) setSession({ source: placements, cursor: 0, playing: false, warning: 0 })
  const cursor = Math.min(session.cursor, ordered.length)
  const setCursor = useCallback((value: number) => setSession((s) => ({ ...s, warning: 0, cursor: Math.max(0, Math.min(ordered.length, value)) })), [ordered.length])
  const advance = useCallback(() => setSession((s) => {
    const p = ordered[s.cursor]
    if (p && lifo.blockage(p, new Set(ordered.slice(0, s.cursor).map((q) => q.id)))?.code === 'LIFO_BLOCKED') {
      return { ...s, playing: false, warning: s.warning + 1 }
    }
    const next = Math.min(s.cursor + 1, ordered.length)
    return { ...s, warning: 0, cursor: next, playing: s.playing && next < ordered.length }
  }), [ordered, lifo])
  const stop = useCallback(() => setSession((s) => s.playing ? { ...s, playing: false } : s), [])
  const toggle = useCallback(() => setSession((s) => ({ ...s, playing: !s.playing,
    cursor: !s.playing && s.cursor >= ordered.length ? 0 : s.cursor })), [ordered.length])
  // Hẹn giờ cho từng bước (không `setInterval`): mỗi bước chờ một khoảng riêng; bị chặn thì `advance` dừng phát, không hẹn tiếp
  const target = ordered[cursor]
  useEffect(() => {
    if (!session.playing || !target) return
    const timer = window.setTimeout(advance, stepMs ? stepMs(target) : STEP_MS / speed)
    return () => window.clearTimeout(timer)
  }, [session.playing, target, speed, stepMs, advance])
  const unloadedIds = useMemo(() => new Set(ordered.slice(0, cursor).map((p) => p.id)), [ordered, cursor])
  return { ordered, fromResult, lifo, cursor, setCursor, unloadedIds, current: ordered[cursor], next: ordered[cursor + 1],
    playing: session.playing, stop, toggle, advance, warning: session.warning }
}
