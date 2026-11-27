import { addAfterEffect, useFrame, useStore } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { IDLE_AFTER_MS } from './perf-idle'
import { nextDprPhase, targetDprOf, type DprPhase, type DprRange } from './rest-dpr'

/**
 * Đổi DPR theo trạng thái cảnh (`rest-dpr.ts`): chuyển động vẽ ở DPR của tier, demand loop dừng đủ `IDLE_AFTER_MS` thì vẽ lại một
 * khung nét. Không xin frame nào ngoài lần `setDpr` (R3F tự vẽ đúng một khung khi store đổi), giữ `frameloop="demand"`.
 *
 * Canvas gọi `configure({ dpr })` mỗi lần nơi gọi vẽ lại và đặt DPR về khoảng của tier; lúc đang nghỉ, store đổi thì đặt lại mức
 * nghỉ ngay trong cùng lượt (khung kế vẽ ở mức nghỉ, không xin thêm khung). Kích thước CSS không đổi nên picking, nhãn DOM neo theo
 * kiện và `ZoneStrips` (đều tính theo `size` CSS px) giữ đúng chỗ.
 */
export function RestDpr({ range }: { range: DprRange }) {
  const store = useStore()
  const [min, max] = range
  const rangeRef = useRef<DprRange>(range)
  const phase = useRef<DprPhase>('moving')
  const pendingCapture = useRef(false)

  useFrame(() => { pendingCapture.current = true })

  useEffect(() => {
    rangeRef.current = [min, max]
    // Đổi tier: Canvas đặt DPR của tier mới; bắt đầu lại từ "đang chạy" để khung nét chỉ vẽ khi cảnh dừng hẳn
    phase.current = 'moving'
    let timer = 0
    const get = store.getState
    const target = () => targetDprOf(phase.current, rangeRef.current, window.devicePixelRatio || 1)
    const apply = () => {
      const want = target()
      if (get().viewport.dpr !== want) get().setDpr(want)
    }
    const handleIdle = () => {
      timer = 0
      const state = get()
      if (state.internal.frames > 0) return
      phase.current = nextDprPhase(phase.current, { kind: 'idle' })
      apply()
    }
    const unsubscribeFrames = addAfterEffect(() => {
      if (!pendingCapture.current) return
      pendingCapture.current = false
      const requestsNext = get().internal.frames > 0
      const before = phase.current
      phase.current = nextDprPhase(before, { kind: 'frame', requestsNext })
      if (phase.current !== before) apply()
      window.clearTimeout(timer)
      timer = requestsNext ? 0 : window.setTimeout(handleIdle, IDLE_AFTER_MS)
    })
    // Lúc nghỉ, `configure` của Canvas kéo DPR về khoảng của tier: đặt lại mức nghỉ
    const unsubscribeStore = store.subscribe((state) => {
      if (phase.current === 'resting' && state.viewport.dpr !== target()) apply()
    })
    return () => {
      window.clearTimeout(timer)
      unsubscribeFrames()
      unsubscribeStore()
    }
  }, [store, min, max])

  return null
}
