import { useLayoutEffect, useMemo, useRef } from 'react'
import { ExtrudeGeometry, InstancedMesh, Object3D, Shape } from 'three'
import type { VehicleConfig } from '@/domain/models'
import type { SceneMaterials } from './materials'
import { containerSize } from './units'
import { truckDetails, truckWheel } from './truck-geometry'
import { CAB_X, truckLayout, WHEEL_RADIUS, WHEEL_Y } from './truck-layout'
import { useDisposeOnChange } from './useDisposeOnChange'

/**
 * Xe minh hoạ quanh thùng: cabin, chi tiết thân và khung gầm gộp một draw (`truckDetails`), mọi bánh một InstancedMesh.
 * Vị trí trục theo `vehicle.axles` khi có (`truckLayout`), vẫn không phải dữ liệu trục có thẩm quyền và không tính tải trục.
 */
export function TruckCab({ vehicle, materials, shadows }: {
  vehicle: VehicleConfig; materials: SceneMaterials; shadows: boolean
}) {
  const { length: L, width: W } = containerSize(vehicle)
  const wheels = useRef<InstancedMesh>(null)
  const layout = useMemo(() => truckLayout(L, W, vehicle.axles), [L, W, vehicle.axles])
  const detail = useMemo(() => truckDetails(L, W, layout, materials), [L, W, layout, materials])
  const wheel = useMemo(() => truckWheel(materials), [materials])
  const body = useMemo(() => {
    const profile = new Shape()
    profile.moveTo(-0.75, 0.35); profile.lineTo(0.75, 0.35)
    profile.lineTo(0.75, 2.3); profile.lineTo(-0.46, 2.3)
    profile.lineTo(-0.75, 1.35); profile.closePath()
    return new ExtrudeGeometry(profile, { depth: W - 0.12, bevelEnabled: true, bevelSegments: 1,
      steps: 1, bevelSize: 0.04, bevelThickness: 0.025 }).translate(CAB_X, 0, 0.06)
  }, [W])
  useLayoutEffect(() => {
    if (!wheels.current) return
    const dummy = new Object3D()
    layout.wheels.forEach(({ x, z }, i) => {
      dummy.position.set(x, WHEEL_Y, z); dummy.rotation.set(Math.PI / 2, 0, 0); dummy.updateMatrix()
      wheels.current!.setMatrixAt(i, dummy.matrix)
    })
    wheels.current.instanceMatrix.needsUpdate = true
    wheels.current.computeBoundingSphere()
  }, [layout])
  // Mỗi geometry tự giải phóng khi chính nó đổi: đổi xe làm `detail` (và `body` khi đổi bề rộng) dựng lại mà `wheel` vẫn đang vẽ
  useDisposeOnChange(detail)
  useDisposeOnChange(wheel)
  useDisposeOnChange(body)
  return <group name="vehicle-decoration">
    <mesh geometry={body} castShadow={shadows}>
      <meshStandardMaterial color={materials.cab} roughness={0.45} metalness={0.18} />
    </mesh>
    <mesh position={[CAB_X - 0.616, 1.8, W / 2]} rotation={[0, 0, -0.297]}>
      <boxGeometry args={[0.018, 0.78, W - 0.45]} />
      <meshStandardMaterial color={materials.windshield} roughness={0.18} metalness={0.45} />
    </mesh>
    <mesh name="vehicle-details" geometry={detail} castShadow={shadows}>
      <meshStandardMaterial vertexColors roughness={0.56} metalness={0.3} />
    </mesh>
    {/* Số bánh đổi theo cấu hình trục: đổi key để dựng lại InstancedMesh đúng sức chứa. */}
    <instancedMesh key={layout.wheels.length} name="vehicle-wheels" ref={wheels} args={[wheel, undefined, layout.wheels.length]} castShadow={shadows}>
      <meshStandardMaterial vertexColors roughness={0.78} metalness={0.12} />
    </instancedMesh>
    {shadows ? <mesh rotation={[-Math.PI / 2, 0, 0]} position={[L / 2, WHEEL_Y - WHEEL_RADIUS - 0.01, W / 2]} receiveShadow>
      <planeGeometry args={[60, 60]} /><shadowMaterial transparent opacity={0.2} />
    </mesh> : null}
  </group>
}
