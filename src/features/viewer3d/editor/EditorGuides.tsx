import { useMemo } from 'react'
import { readToken } from '@/lib/tokens'
import type { VehicleConfig } from '@/domain/models'
import { SCENE_SCALE } from '../scene/units'
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
