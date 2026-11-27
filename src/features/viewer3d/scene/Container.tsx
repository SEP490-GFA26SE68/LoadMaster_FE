import { useMemo } from 'react'
import type { VehicleConfig } from '@/domain/models'
import type { VehicleBodyStyle } from '@/types/vehicle-body-style'
import type { SceneMaterials } from './materials'
import { containerSize } from './units'
import { tailgateHeight } from './body-pieces'
import { ContainerDoor } from './ContainerDetails'
import { truckLayout } from './truck-layout'
import { TruckBody } from './TruckBody'
import { TruckTailgate } from './TruckTailgate'
import { VanBody } from './VanBody'
import { doorOpening as doorOpeningOf } from './vehicle-spec-marks'

/**
 * Thùng xe theo kiểu thân (`truckLayout(…).body`, `TruckBody`): thùng kín, mui bạt, lửng hay đông lạnh quanh đúng lòng thùng đã khai —
 * vỏ trong mặt đơn pháp tuyến hướng vào trong (vách gần camera tự biến mất, nhìn góc nào cũng thấy hàng), mảnh đặc ngoài lòng thùng và
 * 12 cạnh lòng thùng. Mặt sau: thùng kín và đông lạnh có hai cánh mở ~110° (`ContainerDoor`, đông lạnh là cánh cách nhiệt dày), mui
 * bạt và lửng có một bửng hạ xuống (`TruckTailgate`).
 *
 * `doorOpening` (xem trước ở form xe): vẽ vách sau với ô cửa đúng `doorWidthCm` × `doorHeightCm` — hai trụ cửa, phần vách
 * trên cửa, cánh / bửng thu về đúng cỡ ô cửa — ở cả bốn thân. Mặc định cánh cửa phủ cả mặt sau, để vách sau không che hàng ở Planner.
 *
 * Hạng van (`bodyStyle` khai ở loại xe, hoặc suy từ số): thân liền khối `VanBody` thay thùng sóng tôn — cùng lòng thùng, cùng ô cửa.
 */

const DOOR_THICKNESS = 0.03
/** Trụ cửa hay vách trên cửa mỏng hơn 1 mm thì không vẽ (cửa bằng đúng mặt cắt thùng). */
const MIN_FRAME = 0.001
const NO_RAYCAST = () => null

export function Container({
  vehicle,
  materials,
  detail = true,
  reducedMotion = false,
  doorOpening = false,
  edgeOpacity = 0.28,
  doorsClosed = false,
  bodyStyle,
}: {
  vehicle: VehicleConfig
  /** Kiểu thân khai ở loại xe (`SceneCanvas.vehicleBodyStyle`) */
  bodyStyle?: VehicleBodyStyle
  materials: SceneMaterials
  detail?: boolean
  reducedMotion?: boolean
  doorOpening?: boolean
  /** Cánh cửa sau quay về đóng / bửng dựng lên (khung 3D trang giới thiệu, lúc xe rời kho). Mặc định cánh mở ~110°, bửng thõng xuống. */
  doorsClosed?: boolean
  /** Độ rõ của 12 cạnh lòng thùng; xem trước ở form xe không có hàng che nên vẽ rõ hơn. */
  edgeOpacity?: number
}) {
  const { length: L, height: H, width: W } = containerSize(vehicle)
  const door = doorOpening ? doorOpeningOf(vehicle) : { width: W, height: H, jamb: 0, header: 0 }
  const { innerLengthCm, innerWidthCm, innerHeightCm, maxPayloadKg, axles, obstacles } = vehicle
  const { van, body, tailgate } = useMemo(() => truckLayout({ innerLengthCm, innerWidthCm, innerHeightCm, maxPayloadKg, axles, obstacles }, bodyStyle),
    [innerLengthCm, innerWidthCm, innerHeightCm, maxPayloadKg, axles, obstacles, bodyStyle])
  const frameColor = van ? materials.cab : body === 'TRUCK_REEFER' ? materials.insulated : materials.skirt
  const still = reducedMotion || !detail

  return (
    <group>
      {van ? <VanBody box={{ length: L, width: W, height: H }} shape={van} materials={materials} detail={detail} reducedMotion={reducedMotion}
        door={door} doorsClosed={doorsClosed} edgeOpacity={edgeOpacity} />
        : <TruckBody box={{ length: L, width: W, height: H }} body={body ?? 'TRUCK_BOX'} materials={materials} detail={detail} edgeOpacity={edgeOpacity} />}
      {/* Vách sau quanh ô cửa: hộp đặc nhìn được từ cả hai phía, vì góc nhìn mặc định nhìn vào mặt này từ bên ngoài */}
      {door.jamb > MIN_FRAME ? [door.jamb / 2, W - door.jamb / 2].map((z) => (
        <mesh key={z} name="door-jamb" position={[L + DOOR_THICKNESS / 2, H / 2, z]} raycast={NO_RAYCAST}>
          <boxGeometry args={[DOOR_THICKNESS, H, door.jamb]} />
          <meshStandardMaterial color={frameColor} roughness={0.85} />
        </mesh>
      )) : null}
      {door.header > MIN_FRAME ? (
        <mesh name="door-header" position={[L + DOOR_THICKNESS / 2, door.height + door.header / 2, W / 2]} raycast={NO_RAYCAST}>
          <boxGeometry args={[DOOR_THICKNESS, door.header, door.width]} />
          <meshStandardMaterial color={frameColor} roughness={0.85} />
        </mesh>
      ) : null}
      {van ? null : tailgate !== null
        ? <TruckTailgate length={L} height={tailgateHeight(H, door.height)} width={door.width} jamb={door.jamb} materials={materials} detail={detail} reducedMotion={still} closed={doorsClosed} />
        : ([1, -1] as const).map((side) => <ContainerDoor key={side} length={L} height={door.height} width={door.width} hingeZ={side > 0 ? door.jamb : W - door.jamb} side={side}
          materials={materials} detail={detail} reducedMotion={still} closed={doorsClosed} variant={body === 'TRUCK_REEFER' ? 'reefer' : 'box'} />)}
    </group>
  )
}
