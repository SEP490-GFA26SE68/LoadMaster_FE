import { Html } from '@react-three/drei'
import { Color, DoubleSide } from 'three'
import { useMemo } from 'react'
import { animated, useSpring } from '@react-spring/three'
import { useThree } from '@react-three/fiber'
import { useT } from '@/lib/i18n'
import { readToken } from '@/lib/tokens'
import { stopColor } from '@/lib/stops'
import type { ScenePlacement } from '@/features/viewer3d/scene-input'
import type { VehicleConfig } from '@/domain/models'
import { cargoCenterOfMass } from './operations-model'
import { interiorStopMap } from './stop-map'
import { SCENE_SCALE } from '../scene/units'
import { SceneCallout } from '../scene/SceneCallout'
import { SceneTag } from '../scene/SceneTag'

export function RearDoorCue({ vehicle }: { vehicle: VehicleConfig }) {
  const t = useT()
  const x = vehicle.innerLengthCm * SCENE_SCALE, z = vehicle.innerWidthCm * SCENE_SCALE / 2
  const points = useMemo(() => new Float32Array([
    x, 0.03, z, x + 0.9, 0.03, z,
    x + 0.9, 0.03, z, x + 0.65, 0.03, z - 0.15,
    x + 0.9, 0.03, z, x + 0.65, 0.03, z + 0.15,
  ]), [x, z])
  return <group>
    <lineSegments raycast={() => null}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[points, 3]} /></bufferGeometry>
      <lineBasicMaterial color={readToken('--bg')} />
    </lineSegments>
    <Html position={[x + 0.7, 0.05, z]} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
      <span className="block w-max -translate-x-1/2"><SceneTag title={t('viewer.cues.rearDoor')} className="max-w-44 whitespace-normal sm:max-w-none sm:whitespace-nowrap" /></span>
    </Html>
  </group>
}

/** One colored mesh, even when stop placements are interleaved in every bin. */
export function InteriorStopMap({ placements, vehicle, reducedMotion }: { placements: readonly ScenePlacement[]; vehicle: VehicleConfig; reducedMotion: boolean }) {
  const invalidate = useThree((s) => s.invalidate)
  const spring = useSpring({ from: { opacity: 0 }, opacity: 0.65, config: { duration: reducedMotion ? 100 : 160 }, onChange: () => invalidate() })
  const buffers = useMemo(() => {
    const vertices: number[] = [], colors: number[] = [], color = new Color()
    for (const part of interiorStopMap(placements, vehicle)) {
        vertices.push(...part.vertices.map((value) => value * SCENE_SCALE))
        color.set(stopColor(part.stop))
        for (let i = 0; i < 6; i++) colors.push(color.r, color.g, color.b)
    }
    return { positions: new Float32Array(vertices), colors: new Float32Array(colors) }
  }, [placements, vehicle])
  return <mesh name="stop-distribution" raycast={() => null}>
    <bufferGeometry>
      <bufferAttribute attach="attributes-position" args={[buffers.positions, 3]} />
      <bufferAttribute attach="attributes-color" args={[buffers.colors, 3]} />
    </bufferGeometry>
    <animated.meshBasicMaterial vertexColors side={DoubleSide} transparent opacity={spring.opacity} depthWrite={false} />
  </mesh>
}

export function CargoMassMarker({ placements, vehicle }: { placements: readonly ScenePlacement[]; vehicle: VehicleConfig }) {
  const t = useT()
  const mass = useMemo(() => cargoCenterOfMass(placements), [placements])
  const points = useMemo(() => {
    const x = (vehicle.innerLengthCm / 2 - (mass?.position.x ?? 0)) * SCENE_SCALE
    const z = (vehicle.innerWidthCm / 2 - (mass?.position.y ?? 0)) * SCENE_SCALE
    return new Float32Array([0, 0, 0, 0, (mass?.position.z ?? 0) * SCENE_SCALE, 0,
      0, 0.01, 0, x, 0.01, z, x - 0.1, 0.01, z, x + 0.1, 0.01, z, x, 0.01, z - 0.1, x, 0.01, z + 0.1])
  }, [mass, vehicle])
  if (!mass) return null
  const color = readToken('--highlight')
  return <group name="cargo-center-of-mass" position={[mass.position.x * SCENE_SCALE, 0, mass.position.y * SCENE_SCALE]}>
    <mesh position={[0, mass.position.z * SCENE_SCALE, 0]} raycast={() => null} renderOrder={10}>
      <sphereGeometry args={[0.07, 12, 8]} /><meshBasicMaterial color={color} depthTest={false} depthWrite={false} />
    </mesh>
    <lineSegments raycast={() => null}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[points, 3]} /></bufferGeometry>
      <lineBasicMaterial color={color} />
    </lineSegments>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} raycast={() => null}>
      <ringGeometry args={[0.06, 0.09, 16]} /><meshBasicMaterial color={color} side={DoubleSide} />
    </mesh>
    <SceneCallout position={[0, mass.position.z * SCENE_SCALE, 0]} offset={[-140, 90]} width={180} anchor>
      <SceneTag tone="warn" title={t('viewer.cues.centerOfMass')} />
    </SceneCallout>
  </group>
}
