import { Html } from '@react-three/drei'
import { useMemo } from 'react'
import { readToken } from '@/lib/tokens'
import type { VehicleConfig } from '@/domain/models'
import { SCENE_SCALE, type Vec3 } from '../scene/units'
import { EDITOR_RULES } from './geometry'

/** Major grid every ten snap cells: a single draw, readable at container scale. */
export function EditorFloorGrid({ vehicle }: { vehicle: VehicleConfig }) {
  const points = useMemo(() => {
    const vertices: number[] = []
    const length = vehicle.innerLengthCm * SCENE_SCALE, width = vehicle.innerWidthCm * SCENE_SCALE
    const spacing = EDITOR_RULES.gridCm * 10 * SCENE_SCALE
    for (let x = 0; x <= length; x += spacing) vertices.push(x, 0.003, 0, x, 0.003, width)
    for (let z = 0; z <= width; z += spacing) vertices.push(0, 0.003, z, length, 0.003, z)
    return new Float32Array(vertices)
  }, [vehicle])
  return <lineSegments raycast={() => null}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[points, 3]} /></bufferGeometry>
    <lineBasicMaterial color={readToken('--bg')} transparent opacity={0.22} depthWrite={false} />
  </lineSegments>
}

const AXIS_ENDPOINTS: { label: string; position: Vec3 }[] = [
  { label: 'X', position: [0.6, 0, 0] }, { label: 'Y', position: [0, 0, 0.6] }, { label: 'Z', position: [0, 0.6, 0] },
]
const AXIS_POINTS = new Float32Array(AXIS_ENDPOINTS.flatMap(({ position }) => [0, 0, 0, ...position]))

/** One selected set of guides, independent of cargo count. Labels identify axes without color coding. */
export function EditorAxes() {
  return <group>
    <lineSegments raycast={() => null}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[AXIS_POINTS, 3]} /></bufferGeometry>
      <lineBasicMaterial color={readToken('--bg')} />
    </lineSegments>
    {AXIS_ENDPOINTS.map(({ label, position }) => <Html key={label} position={position} zIndexRange={[19, 0]} style={{ pointerEvents: 'none' }}>
      <span className="block -translate-x-1/2 -translate-y-1/2 rounded-sm border border-glass-dark-border bg-panel-dark/85 px-1.5 py-0.5 font-mono text-body font-semibold text-glass-dark-text xl:text-note">{label}</span>
    </Html>)}
  </group>
}
