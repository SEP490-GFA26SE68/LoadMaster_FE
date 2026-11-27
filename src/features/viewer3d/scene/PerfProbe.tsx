import { addAfterEffect, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import type { QualityTier } from '../usePerformanceFlags'
import { isSceneIdle } from './perf-idle'

export type PerfSample = {
  /** Chỉ đo chuỗi frame liên tục; null khi scene nghỉ hoặc chưa đủ mẫu. */
  fps: number | null
  /** Khoảng cách giữa các frame, không phải GPU timer query. */
  frameTimeMs: number | null
  drawCalls: number
  triangles: number
  placementCount: number
  dpr: number
  qualityTier: QualityTier
  renderedFrames: number
  idle: boolean
  /** Mẫu có khung hình trong quãng ổn định sau khi cảnh đổi (`SETTLE_MS`): chính sách chất lượng bỏ qua, overlay vẫn hiện số. */
  settling: boolean
}

const SAMPLE_INTERVAL_MS = 500
/**
 * Quãng bỏ qua sau khi cảnh đổi (mở khung, đổi phương án hay xe, đổi tier): vài khung đầu dựng lại hình học và biên dịch shader nên chậm
 * hẳn — không được tính là "mẫu chậm" để hạ tier. Luật "3 mẫu chậm" giữ nguyên, chỉ không đếm trong quãng này.
 */
export const SETTLE_MS = 2000

type Counters = {
  renderedFrames: number
  lastFrameAt: number
  requestedNextFrame: boolean
  activeIntervals: number
  activeElapsedMs: number
  drawCalls: number
  triangles: number
  /** Có khung hình trong quãng ổn định kể từ lần gửi mẫu trước. */
  settling: boolean
  /** DPR của khung trước: khung đầu sau khi đổi DPR (khung nét lúc nghỉ, về DPR của tier) dựng lại bộ đệm, không tính vào FPS. */
  lastDpr: number
}

/**
 * Debug thuần quan sát: không invalidate và không thêm frame vào demand loop.
 * useFrame chạy trước renderer; addAfterEffect mới đọc được số draw call đúng.
 * Cờ capture bảo đảm frame từ Canvas khác không bị tính vào viewer này.
 */
export function PerfProbe({
  onSample,
  placementCount,
  qualityTier,
  scene,
  onRest,
}: {
  onSample: (sample: PerfSample) => void
  /** Gọi ở mỗi nhịp lấy mẫu khi cảnh vẫn nghỉ mà không có gì mới để công bố: chính sách chất lượng đếm được quãng nghỉ dài. */
  onRest?: () => void
  placementCount: number
  qualityTier: QualityTier
  /** Cảnh đang vẽ (model của phương án): đổi tham chiếu là bắt đầu lại quãng ổn định. */
  scene?: object
}) {
  const get = useThree((state) => state.get)
  const pendingCapture = useRef(false)
  const frameStartedAt = useRef(0)
  const counters = useRef<Counters>({
    renderedFrames: 0,
    lastFrameAt: 0,
    requestedNextFrame: false,
    activeIntervals: 0,
    activeElapsedMs: 0,
    drawCalls: 0,
    triangles: 0,
    settling: true,
    lastDpr: 0,
  })
  const settleUntil = useRef(0)
  useEffect(() => {
    settleUntil.current = performance.now() + SETTLE_MS
    counters.current.settling = true
  }, [scene, qualityTier])

  useFrame(() => {
    frameStartedAt.current = performance.now()
    pendingCapture.current = true
  })

  useEffect(() => {
    const unsubscribe = addAfterEffect(() => {
      if (!pendingCapture.current) return
      pendingCapture.current = false
      const state = get()
      const current = counters.current
      const timestamp = frameStartedAt.current
      const interval = timestamp - current.lastFrameAt
      const dpr = state.viewport.dpr
      // Không tính quãng scene nghỉ giữa hai click là frame chậm, cũng không tính khung vừa đổi DPR (dựng lại bộ đệm).
      if (current.requestedNextFrame && interval > 0 && dpr === current.lastDpr) {
        current.activeIntervals += 1
        current.activeElapsedMs += interval
      }
      if (timestamp < settleUntil.current) current.settling = true
      current.lastDpr = dpr
      current.renderedFrames += 1
      current.lastFrameAt = timestamp
      current.requestedNextFrame = state.frameloop === 'always' || state.internal.frames > 0
      current.drawCalls = state.gl.info.render.calls
      current.triangles = state.gl.info.render.triangles
    })

    let publishedFrames = -1
    let publishedIdle = false
    const timer = window.setInterval(() => {
      const current = counters.current
      if (current.renderedFrames === 0) return
      // `requestedNextFrame` chốt lúc frame cuối ghi xong; frame được xin sau đó (react-spring, con trỏ, effect) chỉ thấy ở đây
      const state = get()
      const pendingFrames = state.frameloop === 'always' ? 1 : state.internal.frames
      const now = performance.now()
      const idle = isSceneIdle(current.requestedNextFrame, now - current.lastFrameAt, pendingFrames)
      const settling = current.settling || now < settleUntil.current
      if (publishedFrames === current.renderedFrames && publishedIdle === idle) {
        if (idle) onRest?.()
        return
      }
      const frameTimeMs = !idle && current.activeIntervals > 0
        ? current.activeElapsedMs / current.activeIntervals
        : null

      onSample({
        fps: frameTimeMs === null ? null : Math.round(1000 / frameTimeMs),
        frameTimeMs,
        drawCalls: current.drawCalls,
        triangles: current.triangles,
        placementCount,
        dpr: state.gl.getPixelRatio(),
        qualityTier,
        renderedFrames: current.renderedFrames,
        idle,
        settling,
      })
      publishedFrames = current.renderedFrames
      publishedIdle = idle
      current.activeIntervals = 0
      current.activeElapsedMs = 0
      current.settling = false
    }, SAMPLE_INTERVAL_MS)

    return () => {
      window.clearInterval(timer)
      unsubscribe()
    }
  }, [get, onSample, onRest, placementCount, qualityTier])

  return null
}
