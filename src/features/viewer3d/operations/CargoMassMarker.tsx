import { useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { BufferAttribute, BufferGeometry, type Group, type Mesh } from 'three'
import type { VehicleConfig } from '@/domain/models'
import { useFormat, useT } from '@/lib/i18n'
import { readToken } from '@/lib/tokens'
import type { ScenePlacement } from '@/features/viewer3d/scene-input'
import { cargoCenterOfMass } from './operations-model'
import { GRAVITY_MARK_FLOATS, writeGravityMark } from './gravity-mark'
import { toScene } from '../scene/units'
import { SceneCallout } from '../scene/SceneCallout'
import { SceneTag } from '../scene/SceneTag'

type MarkerProps = { placements: readonly ScenePlacement[]; vehicle: VehicleConfig }
const noRaycast = () => null

/**
 * Trọng tâm hàng G trong khung 3D (Spec vật lý 10.3): quả cầu tại G và đường chiếu xuống sàn — đúng hai draw call (một mesh, một
 * `LineSegments` sáu đoạn) dù hàng có bao nhiêu kiện. Bộ đệm đường và vị trí quả cầu ghi thẳng vào Three khi tập hàng đổi rồi xin
 * một khung hình; vẽ đè lên kiện (`depthTest` tắt) để đường chiếu không khuất sau hàng. Màu `--cog-marker`: không trùng màu điểm giao
 * hay `--highlight` của kiện hiện tại. Nhãn neo nhận chữ đã dịch từ ngoài, vì `<Html>` của drei không có context của app.
 */
export function CargoMassMarker({ placements, vehicle }: MarkerProps) {
  const t = useT()
  const invalidate = useThree((state) => state.invalidate)
  const mass = useMemo(() => cargoCenterOfMass(placements), [placements])
  const geometry = useMemo(() => {
    const lines = new BufferGeometry()
    lines.setAttribute('position', new BufferAttribute(new Float32Array(GRAVITY_MARK_FLOATS), 3))
    return lines
  }, [])
  const group = useRef<Group>(null), sphere = useRef<Mesh>(null), anchor = useRef<Group>(null)
  useEffect(() => () => geometry.dispose(), [geometry])
  useLayoutEffect(() => {
    if (group.current) group.current.visible = mass !== null
    if (mass) {
      const position = geometry.getAttribute('position') as BufferAttribute
      writeGravityMark(position.array as Float32Array, mass.position, vehicle)
      position.needsUpdate = true
      const at = [toScene(mass.position.x), toScene(mass.position.z), toScene(mass.position.y)] as const
      sphere.current?.position.set(...at)
      anchor.current?.position.set(...at)
    }
    invalidate()
  }, [mass, vehicle, geometry, invalidate])
  const color = readToken('--cog-marker')
  return <group ref={group} name="cargo-center-of-mass">
    <mesh ref={sphere} raycast={noRaycast} renderOrder={10} frustumCulled={false}>
      <sphereGeometry args={[0.07, 16, 12]} /><meshBasicMaterial color={color} depthTest={false} depthWrite={false} />
    </mesh>
    <lineSegments geometry={geometry} raycast={noRaycast} renderOrder={10} frustumCulled={false}>
      <lineBasicMaterial color={color} depthTest={false} depthWrite={false} />
    </lineSegments>
    <group ref={anchor}>
      <SceneCallout offset={[-140, 90]} width={180} anchor>
        <SceneTag tone="gravity" title={t('plannerPhysics.gravity.title')} />
      </SceneCallout>
    </group>
  </group>
}

/** Bản chữ của dấu G cho trình đọc màn hình (canvas `aria-hidden`), đặt ngoài canvas. */
export function CargoMassDescription({ placements, vehicle }: MarkerProps) {
  const t = useT()
  const format = useFormat()
  const mass = useMemo(() => cargoCenterOfMass(placements), [placements])
  return <p className="sr-only" data-cargo-gravity-description>
    {mass ? t('plannerPhysics.gravity.description', {
      x: format.length(mass.position.x),
      y: format.length(Math.abs(mass.position.y - vehicle.innerWidthCm / 2)),
      z: format.length(mass.position.z),
    }) : t('plannerPhysics.gravity.empty')}
  </p>
}
