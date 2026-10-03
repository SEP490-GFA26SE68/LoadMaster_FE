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
  /**
   * Vật cản đang làm nổi do bên ngoài giữ (LM-042). Có prop này thì bấm vật cản gọi `onObstacleSelect` thay cho callout,
   * và vật cản đó được tô `--highlight` qua `setColorAt`, không thêm draw call.
   */
  highlightedObstacleId?: string | null
  onObstacleSelect?: (id: string | null) => void
  children?: ReactNode
}

/** Shared renderer; experience wrappers own controls/workflows, not another scene engine. */
export function SceneCanvas({
  experience, model, placements, flags, preset, focus, onUserControl, selectedId, onSelect, onFocus, warningSignal = 0,
  colorMode = 'diem-giao', sliceCm = model.vehicle.innerLengthCm, step, semantics, hiddenId,
  animateLoading = true, decoration = true, xraySelection, showMass, zones, unloadMotion, onPerfSample, obstaclePicking = true,
  frameVehicle, highlightedObstacleId, onObstacleSelect, children,
}: SceneCanvasProps) {
  const materials = useMemo(() => sceneMaterials(), [])
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
  return <><Canvas data-experience={experience} frameloop="demand" dpr={flags.dpr}
    shadows={flags.shadows ? 'percentage' : false} flat
    gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
    camera={{ fov: 38, near: 0.1, far: 160, position: [8.5, 5.2, 7] }}
    onPointerMissed={() => handleSelect(null)} style={{ position: 'absolute', inset: 0 }}>
    <SceneLighting shadows={flags.shadows} />
    <CameraRig preset={preset} reducedMotion={flags.reducedMotion} vehicle={frameVehicle ?? model.vehicle} fit focus={focus}
      vehicleDecoration={decoration && flags.decoration} onUserControl={onUserControl} />
    <group position={[-cx, -cy, -cz]}>
      <Container vehicle={model.vehicle} materials={materials} detail={flags.decoration} reducedMotion={flags.reducedMotion} />
      {decoration && flags.decoration ? <TruckCab vehicle={model.vehicle} materials={materials} shadows={flags.shadows} /> : null}
      <CargoInstances placements={placements} colorMode={colorMode} colorContext={colorContext} sliceCm={sliceCm}
        step={step} selectedId={selected?.id ?? null} onSelect={handleSelect} onFocus={onFocus} outlines={flags.outlines} outlineColor={materials.outline}
        reducedMotion={flags.reducedMotion} animationQuality={animateLoading ? flags.animationQuality : 'none'} hiddenId={hiddenId}
        semantics={semantics} warningSignal={warningSignal} xraySelection={xraySelection} surfaceDetail={flags.decoration}
        zoneMarks={Boolean(zones?.length)} />
      <ObstacleInstances obstacles={model.vehicle.obstacles} picking={obstaclePicking} onSelect={handleObstacle}
        highlightedId={highlightedObstacleId ?? null} />
      {obstacle ? <ObstacleCallout key={obstacle.id} obstacle={obstacle} /> : null}
      <RearDoorCue vehicle={model.vehicle} />
      {zones?.length ? <ZoneStrips zones={zones} vehicle={model.vehicle} reducedMotion={flags.reducedMotion} /> : null}
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
