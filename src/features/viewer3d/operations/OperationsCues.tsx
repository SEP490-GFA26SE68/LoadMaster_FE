import { Html } from '@react-three/drei'
import { useMemo } from 'react'
import { useT } from '@/lib/i18n'
import { readToken } from '@/lib/tokens'
import type { VehicleConfig } from '@/domain/models'
import { SCENE_SCALE } from '../scene/units'
import { SceneTag } from '../scene/SceneTag'

/** Điểm neo (đơn vị cảnh) của nhãn "Cửa sau": nhãn căn giữa theo chiều ngang, mép trên ở điểm neo. `ZoneStrips` chiếu điểm này thay vì đo DOM. */
export function rearDoorCueAnchor(vehicle: Pick<VehicleConfig, 'innerLengthCm' | 'innerWidthCm'>): [number, number, number] {
  return [vehicle.innerLengthCm * SCENE_SCALE + 0.7, 0.05, vehicle.innerWidthCm * SCENE_SCALE / 2]
}

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
    <Html position={rearDoorCueAnchor(vehicle)} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
      <span data-rear-door-cue className="block w-max -translate-x-1/2"><SceneTag title={t('viewer.cues.rearDoor')} className="max-w-44 whitespace-normal sm:max-w-none sm:whitespace-nowrap" /></span>
    </Html>
  </group>
}
