import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { Object3D, type Group, type InstancedMesh } from 'three'
import type { VehicleConfig } from '@/domain/models'
import { truckLayout, WHEEL_RADIUS, WHEEL_Y, type TruckWheel } from '../scene/truck-layout'
import { containerSize } from '../scene/units'
import { truckStandInGeometry } from './diorama-geometry'
import { ExhaustSmoke } from './ExhaustSmoke'
import type { StorySource } from './story-clock'
import { departDistance, departPitch } from './story-timeline'

const dummy = new Object3D()
const NO_RAYCAST = () => null
/** Mặt đường dưới bánh xe: trục thân xe chúi quanh điểm chạm đất này. */
const GROUND_Y = WHEEL_Y - WHEEL_RADIUS

/** Bánh xe (`TruckCab`, InstancedMesh `vehicle-wheels`) lăn đúng quãng xe đã đi: quay `angle` rad quanh trục bánh (z). */
function spinWheels(group: Group, wheels: readonly TruckWheel[], angle: number) {
  const mesh = group.getObjectByName('vehicle-wheels') as InstancedMesh | undefined
  if (!mesh) return
  for (let i = 0; i < Math.min(mesh.count, wheels.length); i++) {
    const { x, z } = wheels[i]!
    // Như `TruckCab`: bánh dựng đứng bằng Rx(π/2), rồi quay quanh trục bánh — thứ tự ZYX cho ma trận Rz · Rx
    dummy.position.set(x, WHEEL_Y, z)
    dummy.rotation.set(Math.PI / 2, 0, angle, 'ZYX')
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
  }
  mesh.instanceMatrix.needsUpdate = true
}

/** Khối xe giản lược của tier thấp (không có cabin, bánh của `TruckCab`): đặt trong nhóm xe để đi cùng xe khi rời kho. */
export function TruckStandIn({ vehicle }: { vehicle: VehicleConfig }) {
  const geometry = useMemo(() => truckStandInGeometry(vehicle), [vehicle])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh name="landing-truck-stand-in" geometry={geometry} raycast={NO_RAYCAST}>
    <meshLambertMaterial vertexColors />
  </mesh>
}

/**
 * Xe rời kho trong khung 3D trang giới thiệu: đọc thời gian chuyện trong `useFrame` và đặt thẳng nhóm xe của `SceneCanvas`
 * (`vehicleRef`) — lăn `departDistance` mét về phía đầu xe, thân chúi `departPitch` quanh điểm chạm đất của trục sau (đầu ngóc lúc
 * vừa lăn bánh) hay trục trước (đầu chúi lúc phanh) để bánh không lún xuống đường; bánh quay đúng quãng đã lăn. Chỉ ghi khi thời gian
 * đổi nên cảnh vẫn nghỉ khi chuyện đứng yên; chuyện tua về đầu thì xe về chỗ cũ. `smoke`: khói ở ống xả (`ExhaustSmoke`).
 */
export function DepartMotion({ vehicleRef, story, vehicle, smoke }: {
  vehicleRef: RefObject<Group | null>
  story: StorySource
  vehicle: VehicleConfig
  smoke: boolean
}) {
  const { length, width } = containerSize(vehicle)
  const wheels = useMemo(() => truckLayout(length, width, vehicle.axles).wheels, [length, width, vehicle.axles])
  const pivots = useMemo(() => {
    const xs = wheels.map((wheel) => wheel.x)
    return { rear: Math.max(...xs), front: Math.min(...xs) }
  }, [wheels])
  const last = useRef(Number.NaN)

  useFrame(() => {
    const group = vehicleRef.current
    if (!group) return
    const time = story.time()
    if (time === last.current) return
    last.current = time
    const distance = departDistance(time), pitch = departPitch(time)
    // Quay quanh điểm P (hệ của nhóm) rồi tịnh tiến: vị trí = P − R·P − quãng đã lăn theo x
    const pivotX = pitch < 0 ? pivots.rear : pivots.front
    const cos = Math.cos(pitch), sin = Math.sin(pitch)
    group.rotation.z = pitch
    group.position.set(pivotX - (pivotX * cos - GROUND_Y * sin) - distance, GROUND_Y - (pivotX * sin + GROUND_Y * cos), 0)
    spinWheels(group, wheels, distance / WHEEL_RADIUS)
  })

  return smoke ? <ExhaustSmoke story={story} /> : null
}
