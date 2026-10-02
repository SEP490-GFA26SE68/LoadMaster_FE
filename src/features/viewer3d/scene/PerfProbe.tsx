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
}

const SAMPLE_INTERVAL_MS = 500

type Counters = {
  renderedFrames: number
  lastFrameAt: number
  requestedNextFrame: boolean
  activeIntervals: number
  activeElapsedMs: number
  drawCalls: number
  triangles: number
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
}: {
  onSample: (sample: PerfSample) => void
  placementCount: number
  qualityTier: QualityTier
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
  })

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
      // Không tính quãng scene nghỉ giữa hai click là frame chậm.
      if (current.requestedNextFrame && interval > 0) {
        current.activeIntervals += 1
        current.activeElapsedMs += interval
      }
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
      const idle = isSceneIdle(current.requestedNextFrame, performance.now() - current.lastFrameAt, pendingFrames)
      if (publishedFrames === current.renderedFrames && publishedIdle === idle) return
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
      })
      publishedFrames = current.renderedFrames
      publishedIdle = idle
      current.activeIntervals = 0
      current.activeElapsedMs = 0
    }, SAMPLE_INTERVAL_MS)

    return () => {
      window.clearInterval(timer)
      unsubscribe()
    }
  }, [get, onSample, placementCount, qualityTier])

  return null
}
