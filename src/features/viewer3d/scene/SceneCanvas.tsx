import { Canvas } from '@react-three/fiber'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { CameraPreset, ColorMode } from '@/features/viewer3d/viewer-types'
import type { ScenePlacement } from '@/features/viewer3d/scene-input'
import type { SceneZone, ViewerSceneModel } from '@/features/viewer3d/scene-input'
import type { VehicleConfig } from '@/domain/models'
import type { ExperienceMode,PerformanceFlags } from '../usePerformanceFlags'
import type { SceneSemantics } from '../operations/scene-semantics'
import { CargoMassMarker, RearDoorCue } from '../operations/OperationsCues'
import { ZoneStrips } from '../operations/ZoneStrips'
import { UnloadMotion, type UnloadMotionStep } from '../operations/UnloadMotion'
import { ExtractionCorridor } from '../operations/ExtractionCorridor'
import { createColorContext } from '../colors'
import { CameraRig } from './CameraRig'
import { CargoInstances } from './CargoInstances'
import { ObstacleInstances } from './ObstacleInstances'
import { ObstacleCallout } from './ObstacleCallout'
import { ObstacleDescriptions } from '../overlays/ObstacleLegend'
import { Container } from './Container'
import { TruckCab } from './TruckCab'
import { sceneMaterials } from './materials'
import { SceneLighting } from './SceneLighting'
import { PerfProbe, type PerfSample } from './PerfProbe'
import { containerCenter } from './units'
import type { FramePoints } from './frame-fit'

export type SceneCanvasProps = {
  experience: ExperienceMode
  model: Pick<ViewerSceneModel, 'vehicle' | 'stops' | 'placements'>
  placements: readonly ScenePlacement[]
  flags: PerformanceFlags
  preset: CameraPreset
  focus?: { placement: ScenePlacement; request: number; follow?: boolean } | null
  onUserControl?: () => void
  selectedId: string | null
  onSelect: (id: string | null) => void
  onFocus?: (p: ScenePlacement) => void
  warningSignal?: number
  colorMode?: ColorMode
  sliceCm?: number
  step: number
  semantics?: SceneSemantics
  hiddenId?: string | null
  animateLoading?: boolean
  decoration?: boolean
  xraySelection?: boolean
  showMass?: boolean
  /**
   * Vùng theo điểm giao của phương án (FE-5b-07). Có và không rỗng thì vẽ dải vùng trên sàn (một draw call, mọi tier) và viền
   * trắng dày quanh kiện nằm ngoài vùng của điểm mình; Planner bật / tắt ở hộp Hiển thị. Kho và tài xế không truyền.
   */
  zones?: readonly SceneZone[]
  unloadMotion?: UnloadMotionStep
  onPerfSample?: (sample: PerfSample) => void
  /** Bấm vật cản để xem thông tin; Planner tắt ở chế độ chỉnh sửa để vật cản không nhận raycast (LM-033). */
  obstaclePicking?: boolean
  /** Xe để canh khung camera, mặc định `model.vehicle`. Xem trước ở form xe giữ tham chiếu khi chỉ vật cản đổi (LM-042). */
  frameVehicle?: VehicleConfig
  /** Tăng lên để camera về lại đúng `preset` dù preset không đổi (xem `CameraRig`). */
  fitRequest?: number
  /**
   * Vật cản đang làm nổi do bên ngoài giữ (LM-042). Có prop này thì bấm vật cản gọi `onObstacleSelect` thay cho callout,
   * và vật cản đó được tô `--highlight` qua `setColorAt`, không thêm draw call.
   */
  highlightedObstacleId?: string | null
  onObstacleSelect?: (id: string | null) => void
  /** Xem trước ở form xe: vách sau có ô cửa đúng kích thước cửa của xe và viền thùng rõ hơn; mặc định cánh cửa phủ cả mặt sau. */
  specView?: boolean
  /**
   * `false`: khung hình không nhận con trỏ, chạm hay lăn chuột (trang giới thiệu) — cuộn trang đi xuyên qua, camera chỉ đổi theo
   * `preset`. R3F đặt `pointer-events` ngay trên phần tử bọc canvas nên CSS của phần tử cha không ghi đè được: phải đặt ở `style`.
   */
  interactive?: boolean
  /** Phóng camera gần hơn khung vừa khít của mọi góc nhìn (mặc định 1) — trang giới thiệu, nơi khung hình không có HUD. */
  frameZoom?: number
  /** Góc nhìn dọc của camera (độ), đọc lúc tạo canvas; mặc định 38. Trang giới thiệu dùng 26. */
  fov?: number
  /** Canh camera theo các điểm này (hệ góc thùng) trong khung đã trừ lề, thay cho hộp bao của xe (góc Toàn cảnh trang giới thiệu). */
  framePoints?: FramePoints
  /** `false`: dải vùng điểm giao không kèm nhãn (mặc định có nhãn). */
  zoneLabels?: boolean
  children?: ReactNode
}

const CANVAS_STYLE = { position: 'absolute', inset: 0 } as const
const STATIC_CANVAS_STYLE = { ...CANVAS_STYLE, pointerEvents: 'none', touchAction: 'pan-y' } as const
/**
 * Khung không nhận thao tác (trang giới thiệu) không đo lại khi trang cuộn: R3F mặc định đo cả lúc cuộn, mỗi lần cuộn dừng là `top` đổi,
 * `setSize` chạy và cảnh vẽ thêm một khung dù không có gì đổi (kể cả khi khung đã khuất). Đổi cỡ vẫn đo qua ResizeObserver như cũ; không
 * gì trong viewer3d đọc `size.top` / `size.left` (sự kiện con trỏ dùng `offsetX` / `offsetY`).
 */
const NO_SCROLL_RESIZE = { scroll: false } as const

/** Độ sáng thêm của thùng ở xem trước form xe (`sceneMaterials`). */
const SPEC_VIEW_LIFT = 2.2

/** Shared renderer; experience wrappers own controls/workflows, not another scene engine. */
export function SceneCanvas({
  experience, model, placements, flags, preset, focus, onUserControl, selectedId, onSelect, onFocus, warningSignal = 0,
  colorMode = 'diem-giao', sliceCm = model.vehicle.innerLengthCm, step, semantics, hiddenId,
  animateLoading = true, decoration = true, xraySelection, showMass, zones, unloadMotion, onPerfSample, obstaclePicking = true,
  frameVehicle, fitRequest, highlightedObstacleId, onObstacleSelect, specView = false, interactive = true, frameZoom = 1,
  fov = 38, framePoints, zoneLabels = true, children,
}: SceneCanvasProps) {
  const materials = useMemo(() => sceneMaterials(specView ? SPEC_VIEW_LIFT : 1), [specView])
  const colorContext = useMemo(() => createColorContext(model), [model])
  const [cx, cy, cz] = containerCenter(model.vehicle)
  const visibleSelection = placements.find((p) => p.id === selectedId && p.id !== hiddenId && semantics?.appearanceById.get(p.id)?.visibility !== 'hidden')
  const selected = visibleSelection ?? placements.find((p) => p.id === semantics?.currentId && p.id !== hiddenId && semantics?.appearanceById.get(p.id)?.visibility !== 'hidden')
  const inspected = placements.find((p) => p.id === semantics?.inspectionId)
  const { onPerformanceSample } = flags
  const [obstacleId, setObstacleId] = useState<string | null>(null)
  const controlled = highlightedObstacleId !== undefined
  const obstacle = obstaclePicking && !controlled ? model.vehicle.obstacles.find((o) => o.id === obstacleId) : undefined
  const handleSelect = useCallback((id: string | null) => {
    if (controlled) onObstacleSelect?.(null)
    else setObstacleId(null)
    onSelect(id)
  }, [controlled, onObstacleSelect, onSelect])
  const handleObstacle = useCallback((id: string) => {
    if (controlled) onObstacleSelect?.(highlightedObstacleId === id ? null : id)
    else setObstacleId((current) => current === id ? null : id)
  }, [controlled, highlightedObstacleId, onObstacleSelect])
  const handleSample = useCallback((sample: PerfSample) => {
    onPerformanceSample(sample)
    onPerfSample?.(sample)
  }, [onPerformanceSample, onPerfSample])
  return <><Canvas data-experience={experience} frameloop="demand" dpr={flags.dpr} resize={interactive ? undefined : NO_SCROLL_RESIZE}
    shadows={flags.shadows ? 'percentage' : false} flat
    gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
    camera={{ fov, near: 0.1, far: 160, position: [8.5, 5.2, 7] }}
    onPointerMissed={() => handleSelect(null)} style={interactive ? CANVAS_STYLE : STATIC_CANVAS_STYLE}>
    <SceneLighting shadows={flags.shadows} />
    <CameraRig preset={preset} reducedMotion={flags.reducedMotion} vehicle={frameVehicle ?? model.vehicle} fit fitRequest={fitRequest} specFrame={specView} focus={focus}
      vehicleDecoration={decoration && flags.decoration} zoom={frameZoom} framePoints={framePoints} jumpFirst={experience === 'landing'} onUserControl={onUserControl} />
    <group position={[-cx, -cy, -cz]}>
      <Container vehicle={model.vehicle} materials={materials} detail={flags.decoration} reducedMotion={flags.reducedMotion}
        doorOpening={specView} edgeOpacity={specView ? 0.6 : undefined} />
      {decoration && flags.decoration ? <TruckCab vehicle={model.vehicle} materials={materials} shadows={flags.shadows} /> : null}
      <CargoInstances placements={placements} colorMode={colorMode} colorContext={colorContext} sliceCm={sliceCm}
        step={step} selectedId={selected?.id ?? null} onSelect={handleSelect} onFocus={onFocus} outlines={flags.outlines} outlineColor={materials.outline}
        reducedMotion={flags.reducedMotion} animationQuality={animateLoading ? flags.animationQuality : 'none'} hiddenId={hiddenId}
        semantics={semantics} warningSignal={warningSignal} xraySelection={xraySelection} surfaceDetail={flags.decoration}
        zoneMarks={Boolean(zones?.length)} />
      <ObstacleInstances obstacles={model.vehicle.obstacles} picking={obstaclePicking} onSelect={handleObstacle}
        highlightedId={highlightedObstacleId ?? null} />
      {obstacle ? <ObstacleCallout key={obstacle.id} obstacle={obstacle} /> : null}
      {/* Form xe đã có nhãn "Cửa rộng × cao" ngay trên ô cửa */}
      {specView ? null : <RearDoorCue vehicle={model.vehicle} />}
      {zones?.length ? <ZoneStrips zones={zones} vehicle={model.vehicle} reducedMotion={flags.reducedMotion} labels={zoneLabels} /> : null}
      {showMass ? <CargoMassMarker placements={semantics?.massPlacements ?? placements} vehicle={model.vehicle} /> : null}
      {inspected ? <ExtractionCorridor key={`${inspected.id}:${warningSignal}`} target={inspected} vehicle={model.vehicle} blockers={semantics?.blockers ?? []} reducedMotion={flags.reducedMotion} /> : null}
      {unloadMotion ? <UnloadMotion motion={unloadMotion} remaining={semantics?.massPlacements ?? placements}
        vehicle={model.vehicle} quality={flags.animationQuality} reducedMotion={flags.reducedMotion} /> : null}
      {children}
    </group>
    <PerfProbe onSample={handleSample} placementCount={placements.length} qualityTier={flags.tier} />
  </Canvas>
  <ObstacleDescriptions obstacles={model.vehicle.obstacles} />
  </>
}
