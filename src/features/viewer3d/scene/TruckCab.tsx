import { useLayoutEffect, useMemo, useRef } from 'react'
import { ExtrudeGeometry, InstancedMesh, Object3D, Shape } from 'three'
import type { VehicleConfig } from '@/domain/models'
import { splitVehicleName } from '@/lib/vehicle-name'
import type { SceneMaterials } from './materials'
import { containerSize } from './units'
import type { VehicleDetail } from '../usePerformanceFlags'
import { LicensePlate } from './LicensePlate'
import { truckDetails, truckSimpleDetails, truckWheel, truckWheelSimple } from './truck-geometry'
import { truckLayout, type TruckLayout } from './truck-layout'
import { useDisposeOnChange } from './useDisposeOnChange'

/** Thân cabin: đùn mặt cắt cạnh của hạng theo bề rộng cabin, vát mép nhẹ. */
function cabBody({ cab }: TruckLayout) {
  const shape = new Shape()
  cab.profile.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)))
  shape.closePath()
  const bevel = 0.04
  return new ExtrudeGeometry(shape, { depth: cab.z[1] - cab.z[0] - bevel * 2 - 0.02, bevelEnabled: true, bevelSegments: 1,
    steps: 1, bevelSize: bevel, bevelThickness: 0.025 }).translate(0, 0, cab.z[0] + bevel + 0.01)
}

/** Kính chắn gió: tấm mỏng nằm trên cạnh kính của mặt cắt, nhô ra ngoài thân một chút. */
function windshieldPose({ cab }: TruckLayout) {
  const [[x0, y0], [x1, y1]] = cab.windshield
  const dx = x1 - x0, dy = y1 - y0, slant = Math.hypot(dx, dy)
  const out = 0.02
  return {
    position: [(x0 + x1) / 2 - (dy / slant) * out, (y0 + y1) / 2 + (dx / slant) * out, (cab.z[0] + cab.z[1]) / 2] as const,
    rotation: [0, 0, -Math.atan2(dx, dy)] as const,
    size: [0.018, slant * 0.84, cab.z[1] - cab.z[0] - 0.36] as const,
  }
}

/**
 * Xe minh hoạ quanh thùng theo hạng (`truckLayout` → `vehicleClassOf`: van, tải nhẹ, tải trung, tải nặng): thân cabin, kính, chi tiết
 * thân + khung gầm gộp một draw (`truckDetails`), mọi bánh một InstancedMesh; tên xe có biển số thì thêm tấm biển (một draw, chỉ bản
 * đủ). `detail="simple"` (tier low): cùng bốn draw call, chi tiết gộp chỉ còn gầm thùng + khung sườn + cản, bánh trơn — vẫn đúng tỉ lệ
 * cabin, cỡ bánh, chiều cao sàn của hạng. Vị trí trục theo `vehicle.axles` khi có, vẫn không phải dữ liệu trục có thẩm quyền.
 */
export function TruckCab({ vehicle, materials, shadows, detail: level = 'full' }: {
  vehicle: VehicleConfig; materials: SceneMaterials; shadows: boolean; detail?: VehicleDetail
}) {
  const { length: L, width: W } = containerSize(vehicle)
  const wheels = useRef<InstancedMesh>(null)
  const { innerLengthCm, innerWidthCm, innerHeightCm, maxPayloadKg, axles, obstacles } = vehicle
  const layout = useMemo(() => truckLayout({ innerLengthCm, innerWidthCm, innerHeightCm, maxPayloadKg, axles, obstacles }),
    [innerLengthCm, innerWidthCm, innerHeightCm, maxPayloadKg, axles, obstacles])
  const simple = level === 'simple'
  const detail = useMemo(() => (simple ? truckSimpleDetails : truckDetails)(L, W, layout, materials), [simple, L, W, layout, materials])
  const wheel = useMemo(() => (simple ? truckWheelSimple : truckWheel)(layout, materials), [simple, layout, materials])
  const body = useMemo(() => cabBody(layout), [layout])
  const glass = windshieldPose(layout)
  const plate = simple ? null : splitVehicleName(vehicle.name).plate
  useLayoutEffect(() => {
    if (!wheels.current) return
    const dummy = new Object3D()
    layout.wheels.forEach(({ x, z }, i) => {
      dummy.position.set(x, layout.wheelY, z); dummy.rotation.set(Math.PI / 2, 0, 0); dummy.updateMatrix()
      wheels.current!.setMatrixAt(i, dummy.matrix)
    })
    wheels.current.instanceMatrix.needsUpdate = true
    wheels.current.computeBoundingSphere()
  }, [layout, wheel])
  // Mỗi geometry tự giải phóng khi chính nó đổi: đổi xe làm `detail` (và `body` khi đổi hạng) dựng lại mà `wheel` vẫn đang vẽ
  useDisposeOnChange(detail)
  useDisposeOnChange(wheel)
  useDisposeOnChange(body)
  return <group name="vehicle-decoration">
    <mesh geometry={body} castShadow={shadows}>
      <meshStandardMaterial color={materials.cab} roughness={0.45} metalness={0.18} />
    </mesh>
    <mesh position={glass.position} rotation={glass.rotation}>
      <boxGeometry args={glass.size} />
      <meshStandardMaterial color={materials.windshield} roughness={0.18} metalness={0.45} />
    </mesh>
    <mesh name="vehicle-details" geometry={detail} castShadow={shadows}>
      <meshStandardMaterial vertexColors roughness={0.56} metalness={0.3} />
    </mesh>
    {/* Số bánh đổi theo cấu hình trục: đổi key để dựng lại InstancedMesh đúng sức chứa. */}
    <instancedMesh key={`${layout.wheels.length}:${level}`} name="vehicle-wheels" ref={wheels} args={[wheel, undefined, layout.wheels.length]} castShadow={shadows}>
      <meshStandardMaterial vertexColors roughness={0.78} metalness={0.12} />
    </instancedMesh>
    {plate ? <LicensePlate plate={plate} layout={layout} length={L} width={W} materials={materials} /> : null}
    {shadows ? <mesh rotation={[-Math.PI / 2, 0, 0]} position={[L / 2, layout.groundY - 0.01, W / 2]} receiveShadow>
      <planeGeometry args={[60, 60]} /><shadowMaterial transparent opacity={0.2} />
    </mesh> : null}
  </group>
}
