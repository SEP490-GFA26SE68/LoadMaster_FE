import { useMemo } from 'react'
import type { VehicleConfig } from '@/domain/models'
import type { VehicleBodyStyle } from '@/types/vehicle-body-style'
import type { SceneMaterials } from './materials'
import { containerSize } from './units'
import { ContainerDoor, FloorScale } from './ContainerDetails'
import { ContainerStructure } from './ContainerStructure'
import { truckLayout } from './truck-layout'
import { VanBody } from './VanBody'
import { doorOpening as doorOpeningOf } from './vehicle-spec-marks'

/**
 * Thùng xe: vỏ trong (sàn ván + ba vách sóng tôn có trụ góc, đà nóc, ray chằng hàng), khung ngoài (gờ, ngưỡng cửa, trụ góc trước, xà
 * và đà nóc mảnh), 12 cạnh lòng thùng và hai cánh cửa sau mở ~110° (`ContainerStructure`). Vách dùng mặt đơn với pháp tuyến hướng vào
 * trong nên vách gần camera tự biến mất cùng mọi chi tiết vẽ trên nó — nhìn từ góc nào cũng thấy hàng bên trong; cạnh lòng thùng vẫn
 * còn để định hình thùng.
 *
 * `doorOpening` (xem trước ở form xe): vẽ vách sau với ô cửa đúng `doorWidthCm` × `doorHeightCm` — hai trụ cửa, phần vách
 * trên cửa, hai cánh thu về đúng cỡ ô cửa. Mặc định cánh cửa phủ cả mặt sau, để vách sau không che hàng ở Planner.
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
  /** Hai cánh cửa sau quay về đóng (khung 3D trang giới thiệu, lúc xe rời kho). Mặc định mở ~110°. */
  doorsClosed?: boolean
  /** Độ rõ của 12 cạnh lòng thùng; xem trước ở form xe không có hàng che nên vẽ rõ hơn. */
  edgeOpacity?: number
}) {
  const { length: L, height: H, width: W } = containerSize(vehicle)
  const door = doorOpening ? doorOpeningOf(vehicle) : { width: W, height: H, jamb: 0, header: 0 }
  const { innerLengthCm, innerWidthCm, innerHeightCm, maxPayloadKg, axles } = vehicle
  const van = useMemo(() => truckLayout({ innerLengthCm, innerWidthCm, innerHeightCm, maxPayloadKg, axles }, bodyStyle).van,
    [innerLengthCm, innerWidthCm, innerHeightCm, maxPayloadKg, axles, bodyStyle])
  const frameColor = van ? materials.cab : materials.skirt

  return (
    <group>
      {van ? <VanBody box={{ length: L, width: W, height: H }} shape={van} materials={materials} detail={detail} reducedMotion={reducedMotion}
        door={door} doorsClosed={doorsClosed} edgeOpacity={edgeOpacity} /> : <>
        <ContainerStructure box={{ length: L, width: W, height: H }} materials={materials} detail={detail} edgeOpacity={edgeOpacity} />
        {detail ? <FloorScale length={L} width={W} color={materials.light} /> : null}
      </>}
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
      {van ? null : <>
        <ContainerDoor length={L} height={door.height} width={door.width} hingeZ={door.jamb} side={1} materials={materials} detail={detail} reducedMotion={reducedMotion || !detail} closed={doorsClosed} />
        <ContainerDoor length={L} height={door.height} width={door.width} hingeZ={W - door.jamb} side={-1} materials={materials} detail={detail} reducedMotion={reducedMotion || !detail} closed={doorsClosed} />
      </>}
    </group>
  )
}
