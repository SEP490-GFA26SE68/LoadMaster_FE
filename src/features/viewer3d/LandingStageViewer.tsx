import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { OptimizationRequest, OptimizationResult } from '@/domain/models'
import { fillStep } from './landing-fill'
import { adaptResult } from './scene-input'
import { SceneCanvas } from './scene/SceneCanvas'
import { usePerformanceFlags } from './usePerformanceFlags'
import type { CameraPreset } from './viewer-types'

const noop = () => {}

/** Khung hình không có HUD đè lên: camera đứng gần hơn khung vừa khít của Planner để thùng xe chiếm phần lớn khung. */
const FRAME_ZOOM = 1.3

/** Báo một lần khi khung hình đầu tiên đã vẽ: trang giới thiệu lúc đó mới đổi ảnh tĩnh sang khung 3D, rồi mới bắt đầu xếp. */
function FirstFrame({ onFrame }: { onFrame: () => void }) {
  const done = useRef(false)
  useFrame(() => {
    if (done.current) return
    done.current = true
    onFrame()
  })
  return null
}

/** Mất ngữ cảnh WebGL giữa chừng (card đồ hoạ khởi động lại, hết bộ nhớ): báo trang đổi sang hình minh hoạ thay vì để khung đen. */
function ContextWatch({ onLost }: { onLost: () => void }) {
  const canvas = useThree((state) => state.gl.domElement)
  useEffect(() => {
    canvas.addEventListener('webglcontextlost', onLost)
    return () => canvas.removeEventListener('webglcontextlost', onLost)
  }, [canvas, onLost])
  return null
}

/** Số kiện đang hiện: xếp từ 0 tới đủ thùng một lần mỗi `playKey`, theo thời gian thật (`fillStep`); giảm chuyển động thì đầy ngay. */
function useFill(total: number, playKey: number, started: boolean, reducedMotion: boolean): number {
  const [step, setStep] = useState(0)
  useEffect(() => {
    if (!started || reducedMotion) return
    let frame = 0
    let start: number | null = null
    const tick = (now: number) => {
      start ??= now
      const next = fillStep(total, now - start)
      setStep(next)
      if (next < total) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [total, playKey, started, reducedMotion])
  return reducedMotion ? total : step
}

/**
 * Khung 3D của trang giới thiệu (`features/marketing` tải lười): cùng `SceneCanvas` với Planner, kho và tài xế, vẽ phương án mẫu
 * mà bộ tối ưu mô phỏng vừa tính trên trình duyệt của người xem. Không thao tác (`interactive={false}`: cuộn trang đi xuyên qua khung
 * hình), camera chỉ đổi theo nút góc nhìn của trang; góc "Trên" bật dải vùng theo điểm giao. Kiện xếp từ vách trước ra cửa sau đúng
 * `loadingOrder`, một lần, tới khi người xem bấm "Xếp lại".
 */
export default function LandingStageViewer({ request, result, stopNames, preset, playKey, onReady, onFail }: {
  request: OptimizationRequest
  result: OptimizationResult
  stopNames: readonly string[]
  preset: CameraPreset
  /** Tăng lên để xếp lại từ thùng rỗng. */
  playKey: number
  onReady: () => void
  /** Ngữ cảnh WebGL mất giữa chừng. */
  onFail: () => void
}) {
  const flags = usePerformanceFlags(undefined, 'landing')
  const model = useMemo(() => adaptResult({
    trip: { id: 'LANDING', stops: stopNames.map((name) => ({ name })) },
    revision: { request, result, ordersRecomputed: false },
  }), [request, result, stopNames])
  const [started, setStarted] = useState(false)
  const handleFrame = useCallback(() => {
    setStarted(true)
    onReady()
  }, [onReady])
  const step = useFill(model.placements.length, playKey, started, flags.reducedMotion)

  return (
    <SceneCanvas experience="landing" model={model} placements={model.placements} flags={flags} preset={preset}
      selectedId={null} onSelect={noop} step={step} zones={preset === 'tren' ? model.zones : undefined} interactive={false} frameZoom={FRAME_ZOOM}>
      <FirstFrame onFrame={handleFrame} />
      <ContextWatch onLost={onFail} />
    </SceneCanvas>
  )
}
