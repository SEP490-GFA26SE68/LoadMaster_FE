import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useSearchParams } from 'react-router'
import type { OptimizationRequest, OptimizationResult } from '@/domain/models'
import { DIORAMA_FRAME_POINTS, HERO_INSETS, laneSlots, STAGE_CAMERA, type HeroTier, type StageView } from './landing/diorama-layout'
import { DioramaScene } from './landing/DioramaScene'
import type { StorySource } from './landing/story-clock'
import { loadedCount, ZONES_AT } from './landing/story-timeline'
import { adaptResult } from './scene-input'
import type { FramePoints } from './scene/frame-fit'
import { SceneCanvas } from './scene/SceneCanvas'
import { usePerformanceFlags } from './usePerformanceFlags'
import { debugQualityTier } from './viewer-options'

const noop = () => {}

/** Khung đổi cỡ (xoay máy, kéo cửa sổ) thì canh lại camera một lần, khi kích thước đã yên chừng này ms. */
const RESIZE_SETTLE_MS = 150

/** Báo một lần khi khung hình đầu tiên đã vẽ: trang giới thiệu lúc đó mới đổi ảnh tĩnh sang khung 3D, rồi mới cho chuyện chạy. */
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

/** Mỗi nhịp của chuyện xin một khung hình (`frameloop="demand"`); chuyện dừng hay hết thì cảnh nghỉ. */
function StoryFrames({ story }: { story: StorySource }) {
  const invalidate = useThree((state) => state.invalidate)
  useEffect(() => story.subscribe(() => invalidate()), [story, invalidate])
  return null
}

/** Khung bọc canvas đổi cỡ: tăng `fitRequest` khi đã yên — camera của trang không ai xoay tay nên luôn canh lại theo khung mới. */
function useRefitOnResize() {
  const [request, setRequest] = useState(0)
  const [box, setBox] = useState<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!box || typeof ResizeObserver === 'undefined') return
    let timer = 0
    let first = true
    const observer = new ResizeObserver(() => {
      // Lần báo ngay khi bắt đầu quan sát là kích thước lúc mở: khung đầu tiên đã canh theo nó
      if (first) { first = false; return }
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setRequest((value) => value + 1), RESIZE_SETTLE_MS)
    })
    observer.observe(box)
    return () => { observer.disconnect(); window.clearTimeout(timer) }
  }, [box])
  return [request, setBox] as const
}

/**
 * Khung 3D "Sân kho kể chuyện" của trang giới thiệu (`features/marketing` tải lười): cùng `SceneCanvas` với Planner, kho và tài xế,
 * vẽ phương án mẫu mà bộ tối ưu mô phỏng vừa tính trên trình duyệt của người xem, giữa một sân kho thu nhỏ (`DioramaScene`). Không
 * thao tác (`interactive={false}`: cuộn trang đi xuyên qua khung hình). Thời gian do trang giữ (`story`): kiện vào làn chờ, mặt quét
 * lúc tối ưu, dải vùng điểm giao từ `ZONES_AT`, rồi từng kiện rời làn vào thùng đúng `loadingOrder`.
 *
 * Ba góc nhìn: `overview` toàn sân kho canh vào phần khung không bị nút, thẻ và Lumo che (`HERO_INSETS[tier]`); `truck` cận xe;
 * `zones` nhìn từ trên, dải vùng kèm nhãn. React chỉ đọc hai giá trị suy ra từ thời gian (bước xếp, đã có dải vùng chưa); hộp của làn
 * và mặt quét đọc thời gian trong `useFrame`.
 */
export default function LandingStageViewer({ request, result, stopNames, view, tier, story, onReady, onFail }: {
  request: OptimizationRequest
  result: OptimizationResult
  stopNames: readonly string[]
  view: StageView
  tier: HeroTier
  story: StorySource
  onReady: () => void
  /** Ngữ cảnh WebGL mất giữa chừng. */
  onFail: () => void
}) {
  const [search] = useSearchParams()
  const flags = usePerformanceFlags(debugQualityTier(search), 'landing')
  const model = useMemo(() => adaptResult({
    trip: { id: 'LANDING', stops: stopNames.map((name) => ({ name })) },
    revision: { request, result, ordersRecomputed: false },
  }), [request, result, stopNames])
  const slots = useMemo(() => laneSlots(request, result), [request, result])
  const total = slots.length
  const subscribe = useCallback((listener: () => void) => story.subscribe(listener), [story])
  const step = useSyncExternalStore(subscribe, () => loadedCount(total, story.time()))
  const zonesOn = useSyncExternalStore(subscribe, () => story.time() >= ZONES_AT)
  const framePoints = useMemo<FramePoints | undefined>(
    () => view === 'overview' ? { points: DIORAMA_FRAME_POINTS, insets: HERO_INSETS[tier] } : undefined, [view, tier])
  const [fitRequest, observe] = useRefitOnResize()

  return (
    <div ref={observe} className="absolute inset-0">
      <SceneCanvas experience="landing" model={model} placements={model.placements} flags={flags} preset={view === 'zones' ? 'tren' : 'goc-cheo'}
        selectedId={null} onSelect={noop} step={step} zones={zonesOn ? model.zones : undefined} zoneLabels={view === 'zones'}
        interactive={false} fov={STAGE_CAMERA.fov} framePoints={framePoints} frameZoom={view === 'overview' ? 1 : STAGE_CAMERA.zoom} fitRequest={fitRequest}>
        <FirstFrame onFrame={onReady} />
        <ContextWatch onLost={onFail} />
        <StoryFrames story={story} />
        <DioramaScene slots={slots} total={total} vehicle={model.vehicle} story={story} low={!flags.decoration} reducedMotion={flags.reducedMotion} />
      </SceneCanvas>
    </div>
  )
}
