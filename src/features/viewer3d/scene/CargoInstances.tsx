import { useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { BackSide, BoxGeometry, InstancedBufferAttribute, type InstancedMesh } from 'three'
import type { ColorMode } from '@/features/viewer3d/viewer-types'
import type { ScenePlacement } from '@/features/viewer3d/scene-input'

import type { ColorContext } from '../colors'
import { createInstanceLayout } from './instance-layout'
import { useCargoMatrices } from './useCargoMatrices'
import type { AnimationQuality } from '../usePerformanceFlags'
import { useCargoColors } from './useCargoColors'
import type { SceneSemantics } from '../operations/scene-semantics'
import { applyCargoSurface, createCargoSurface } from './cargo-surface'
import { CargoFeedback } from './CargoFeedback'
import { animated, useSpring } from '@react-spring/three'

type Props = {
  placements: readonly ScenePlacement[]
  colorMode: ColorMode
  colorContext: ColorContext
  sliceCm: number
  step: number
  selectedId: string | null
  onSelect: (id: string | null) => void
  onFocus?: (p: ScenePlacement) => void
  outlines: boolean
  outlineColor: string
  reducedMotion: boolean
  animationQuality?: AnimationQuality
  hiddenId?: string | null
  semantics?: SceneSemantics
  xraySelection?: boolean
  surfaceDetail?: boolean
  warningSignal?: number
  /** Viền trắng dày quanh kiện nằm ngoài vùng của điểm giao mình (FE-5b-07); giữ cả ở tier `low`, nhường chỗ khi đang xem kiện chắn lối dỡ. */
  zoneMarks?: boolean
}

/** Three cargo draws at most: solid, ghost, inverted hull (general outlines, unload blockers and out-of-zone marks share it). One selected outline. */
export function CargoInstances({
  placements, colorMode, colorContext, sliceCm, step, selectedId, onSelect, onFocus,
  outlines, outlineColor, reducedMotion, animationQuality = 'full', hiddenId, semantics, xraySelection = false, surfaceDetail = false, warningSignal = 0,
  zoneMarks = false,
}: Props) {
  const opaque = useRef<InstancedMesh>(null)
  const dim = useRef<InstancedMesh>(null)
  const hull = useRef<InstancedMesh>(null)
  const meshes = useMemo(() => ({ opaque, dim, hull }), [])
  const layout = useMemo(() => createInstanceLayout(placements), [placements])
  const gl = useThree((state) => state.gl)
  const invalidate = useThree((state) => state.invalidate)
  const [warningSpring, warningApi] = useSpring(() => ({ opacity: 1 }))
  useEffect(() => {
    if (!warningSignal) return
    void warningApi.start({ from: { opacity: 0.25 }, to: { opacity: 1 }, config: { duration: reducedMotion ? 100 : 200 }, onChange: () => invalidate() })
  }, [warningSignal, warningApi, invalidate, reducedMotion])
  const geometry = useMemo(() => new BoxGeometry(1, 1, 1), [])
  useLayoutEffect(() => {
    geometry.setAttribute('packageSurface', new InstancedBufferAttribute(new Float32Array(layout.instanceToPlacementId.map((id) =>
      ({ carton: 0, pallet: 1, crate: 2 })[layout.placementById.get(id)!.packaging])), 1))
  }, [geometry, layout])
  const surface = useMemo(() => surfaceDetail ? createCargoSurface() : null, [surfaceDetail])
  useEffect(() => () => surface?.dispose(), [surface])
  const selected = selectedId && selectedId !== hiddenId ? layout.placementById.get(selectedId) : undefined
  const count = layout.instanceToPlacementId.length
  const [hoverId, setHoverId] = useState<string | null>(null)
  const current = layout.placementById.get(semantics?.currentId ?? '')
  const next = layout.placementById.get(semantics?.nextId ?? '')
  const hover = layout.placementById.get(hoverId ?? '')
  const visible = (p: ScenePlacement | undefined) => p && p.id !== hiddenId && (!semantics || semantics.appearanceById.get(p.id)?.visibility !== 'hidden')
  // Đang xem kiện chắn lối dỡ thì viền cảnh báo chỉ nói về kiện chắn
  const markZones = zoneMarks && !semantics?.inspectionId
  const showHull = outlines || Boolean(semantics?.blockers.length) || (markZones && placements.some((p) => p.outOfZone))

  useCargoMatrices({ meshes, layout, placements, step, sliceCm, outlines, reducedMotion, animationQuality, hiddenId, semantics, markZones })
  useCargoColors(meshes, layout, colorMode, colorContext, outlineColor, showHull, semantics, markZones)

  useEffect(() => () => {
    geometry.dispose()
    gl.domElement.style.removeProperty('cursor')
  }, [geometry, gl])

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    const id = event.instanceId === undefined ? undefined : layout.instanceToPlacementId[event.instanceId]
    if (id) onSelect(id)
  }
  const handleOver = (e: ThreeEvent<PointerEvent>) => {
    if (e.pointerType === 'touch' || e.buttons) return
    e.stopPropagation()
    setHoverId(e.instanceId === undefined ? null : layout.instanceToPlacementId[e.instanceId] ?? null)
    gl.domElement.style.setProperty('cursor', 'pointer')
  }
  const handleOut = () => { setHoverId(null); gl.domElement.style.removeProperty('cursor') }
  const handleFocus = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    const id = e.instanceId === undefined ? undefined : layout.instanceToPlacementId[e.instanceId]
    if (id) { onSelect(id); onFocus?.(layout.placementById.get(id)!) }
  }

  return (
    <group>
      <instancedMesh
        name="cargo-opaque"
        key={`opaque-${count}`}
        ref={opaque}
        args={[undefined, undefined, count]}
        geometry={geometry}
        frustumCulled={false}
        castShadow
        receiveShadow
        onClick={handleClick}
        onDoubleClick={handleFocus}
        onPointerMove={handleOver}
        onPointerDown={handleOut}
        onPointerOver={handleOver}
        onPointerOut={handleOut}
      >
        {surfaceDetail ? <meshStandardMaterial map={surface} onBeforeCompile={applyCargoSurface} customProgramCacheKey={() => 'cargo-surface-atlas-v1'} roughness={0.86} metalness={0.02} /> : <meshLambertMaterial />}
      </instancedMesh>
      <instancedMesh
        name="cargo-dim"
        key={`dim-${count}`}
        ref={dim}
        args={[undefined, undefined, count]}
        geometry={geometry}
        frustumCulled={false}
        onClick={handleClick}
        onDoubleClick={handleFocus}
        onPointerMove={handleOver}
        onPointerDown={handleOut}
        onPointerOver={handleOver}
        onPointerOut={handleOut}
      >
        {surfaceDetail ? <meshStandardMaterial transparent opacity={0.22} depthWrite={false} roughness={0.9} />
          : <meshLambertMaterial transparent opacity={0.22} depthWrite={false} />}
      </instancedMesh>
      {showHull ? (
        <instancedMesh
          name="cargo-hull"
          key={`hull-${count}`}
          ref={hull}
          args={[undefined, undefined, count]}
          geometry={geometry}
          frustumCulled={false}
        >
          <animated.meshBasicMaterial side={BackSide} toneMapped={false} transparent opacity={warningSpring.opacity} />
        </instancedMesh>
      ) : null}
      {visible(selected) && selected?.id !== current?.id ? <CargoFeedback key={`selected-${selected!.id}`} placement={selected!} role="selected" reducedMotion={reducedMotion} xray={xraySelection} /> : null}
      {visible(current) ? <CargoFeedback key={`current-${current!.id}`} placement={current!} role="current" reducedMotion={reducedMotion}
        xray={xraySelection || Boolean(semantics?.blockers.length && semantics.inspectionId === current!.id)} /> : null}
      {visible(next) && next?.id !== selected?.id ? <CargoFeedback key={`next-${next!.id}`} placement={next!} role="next" reducedMotion={reducedMotion} /> : null}
      {visible(hover) && hover?.id !== selectedId && hover?.id !== current?.id && hover?.id !== next?.id ? <CargoFeedback key={`hover-${hover!.id}`} placement={hover!} role="hover" reducedMotion /> : null}
    </group>
  )
}
