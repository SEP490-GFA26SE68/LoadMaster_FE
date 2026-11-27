import { animated, easings, useSpring } from '@react-spring/three'
import { useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import { BoxGeometry, BufferAttribute, BufferGeometry, Color, CylinderGeometry, DoubleSide, FrontSide, PlaneGeometry } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { SceneMaterials } from './materials'
import { containerEdges, type ContainerBox, type Rgb } from './container-structure'
import { ContainerDoor, FloorScale } from './ContainerDetails'
import { tintGeometry } from './tint-geometry'
import { useDisposeOnChange } from './useDisposeOnChange'
import { vanExterior, vanShell } from './van-body'
import { LIFTGATE_OPEN_RAD, type VanShape } from './van-shape'
import type { DoorOpening } from './vehicle-spec-marks'

const NO_RAYCAST = () => null
const rgb = (hex: string, k = 1): Rgb => { const c = new Color(hex).multiplyScalar(k); return [c.r, c.g, c.b] }
/** Vách trong màu thân hơi tối hơn nắp mũi (ánh sáng trong khoang), khe cửa tối hẳn. */
const WALL_SHADE = 0.9
const SEAM_SHADE = 0.55
/** Cửa hất: tấm cửa dày chừng này, khung viền quanh cửa rộng chừng này. */
const GATE_THICKNESS = 0.03
const GATE_RIM = 0.05

function merged(parts: BufferGeometry[]) {
  const geometry = mergeGeometries(parts)!
  parts.forEach((part) => part.dispose())
  return geometry
}

/**
 * Thân van liền khối thay cho thùng sóng tôn (dáng ở `van-shape.ts`, hình học thuần ở `van-body.ts`): vỏ trong một draw, khối ngoài
 * (mép nóc bo, trụ D, xà cửa, gờ chân thân) một draw, 12 cạnh lòng thùng một draw, thước sàn khi `detail`, rồi cửa sau — cửa hất một
 * draw (Blind Van, Towner, HiAce) hoặc hai cánh trơn màu thân (Transit). Không thêm mặt đặc hai phía nào che hàng.
 */
export function VanBody({ box, shape, materials, detail, reducedMotion, door, doorsClosed, edgeOpacity }: {
  box: ContainerBox; shape: VanShape; materials: SceneMaterials; detail: boolean; reducedMotion: boolean
  door: DoorOpening; doorsClosed: boolean; edgeOpacity: number
}) {
  const { length: L, width: W, height: H } = box
  const { wall, roofY } = shape
  const shell = useMemo(() => {
    const data = vanShell({ length: L, width: W, height: H },
      { floor: rgb(materials.floor), wall: rgb(materials.cab, WALL_SHADE), seam: rgb(materials.cab, SEAM_SHADE) }, detail)
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(data.positions, 3))
    geometry.setAttribute('normal', new BufferAttribute(data.normals, 3))
    geometry.setAttribute('color', new BufferAttribute(data.colors, 3))
    geometry.computeBoundingSphere()
    return geometry
  }, [L, W, H, materials, detail])
  const exterior = useMemo(() => merged(vanExterior({ length: L, width: W, height: H }, { wall, roofY }).map((piece) => {
    if (piece.kind === 'rod') {
      return tintGeometry(new CylinderGeometry(piece.radius, piece.radius, piece.x[1] - piece.x[0], 10).rotateZ(Math.PI / 2)
        .translate((piece.x[0] + piece.x[1]) / 2, piece.y, piece.z), materials.cab)
    }
    const { min, max } = piece
    return tintGeometry(new BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2])
      .translate((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2), materials.cab)
  })), [L, W, H, wall, roofY, materials])
  const edges = useMemo(() => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(containerEdges({ length: L, width: W, height: H }), 3))
    return geometry
  }, [L, W, H])
  useDisposeOnChange(shell)
  useDisposeOnChange(exterior)
  useDisposeOnChange(edges)
  const still = reducedMotion || !detail
  return <>
    <mesh name="van-shell" geometry={shell} receiveShadow raycast={NO_RAYCAST}>
      <meshStandardMaterial vertexColors roughness={0.82} metalness={0.05} />
    </mesh>
    <mesh name="van-exterior" geometry={exterior} raycast={NO_RAYCAST}>
      <meshStandardMaterial vertexColors roughness={0.45} metalness={0.18} />
    </mesh>
    <lineSegments name="container-edges" geometry={edges} raycast={NO_RAYCAST}>
      <lineBasicMaterial color={materials.light} transparent opacity={edgeOpacity} depthWrite={false} />
    </lineSegments>
    {detail ? <FloorScale length={L} width={W} color={materials.light} /> : null}
    {shape.rearDoor === 'liftgate'
      ? <VanLiftgate length={L} door={door} materials={materials} detail={detail} reducedMotion={still} closed={doorsClosed} />
      : [1, -1].map((side) => <ContainerDoor key={side} length={L} height={door.height} width={door.width} hingeZ={side > 0 ? door.jamb : W - door.jamb}
        side={side as 1 | -1} materials={materials} detail={detail} reducedMotion={still} closed={doorsClosed} leafColor={materials.cab} hardware={false} />)}
  </>
}

/**
 * Cửa hất sau: bản lề ngang ở mép trên ô cửa, mở `LIFTGATE_OPEN_RAD` (lò xo 500 ms giảm tốc như hai cánh của thùng tải; giảm chuyển
 * động thì đứng ngay). Một draw: tấm cửa là **mặt đơn** quay ra ngoài — khi mở nó hướng lên trời, nhìn từ cửa sau thấp hơn cửa thì
 * tấm biến mất, chỉ còn khung viền, không che hàng — cộng khung viền đặc và tay nắm khi `detail`. Đóng thì vẽ cả hai mặt.
 */
function VanLiftgate({ length, door, materials, detail, reducedMotion, closed }: {
  length: number; door: DoorOpening; materials: SceneMaterials; detail: boolean; reducedMotion: boolean; closed: boolean
}) {
  const invalidate = useThree((state) => state.invalidate)
  const spring = useSpring({ from: { angle: LIFTGATE_OPEN_RAD * 0.6 }, angle: closed ? 0 : LIFTGATE_OPEN_RAD,
    immediate: reducedMotion, config: { duration: 500, easing: easings.easeOutCubic }, onChange: () => invalidate() })
  const { width, height, jamb } = door
  const geometry = useMemo(() => {
    const zc = jamb + width / 2, t = GATE_THICKNESS
    const slab = (sx: number, sy: number, sz: number, x: number, y: number, z: number, color: string) =>
      tintGeometry(new BoxGeometry(sx, sy, sz).translate(x, y, z), color).toNonIndexed()
    const parts = [
      // Tấm cửa: mặt phẳng hướng +x (ra sau khi đóng), y từ −cao cửa tới bản lề
      tintGeometry(new PlaneGeometry(width, height).rotateY(Math.PI / 2).translate(t, -height / 2, zc), materials.cab).toNonIndexed(),
      slab(t, height, GATE_RIM, t / 2, -height / 2, jamb + GATE_RIM / 2, materials.cab),
      slab(t, height, GATE_RIM, t / 2, -height / 2, jamb + width - GATE_RIM / 2, materials.cab),
      slab(t, GATE_RIM, width, t / 2, -GATE_RIM / 2, zc, materials.cab),
      slab(t + 0.005, GATE_RIM * 1.4, width, (t + 0.005) / 2, -height + GATE_RIM * 0.7, zc, materials.cab),
    ]
    if (detail) parts.push(slab(0.025, 0.035, Math.min(0.24, width * 0.2), t + 0.012, -height + 0.13, zc, materials.chassis))
    return merged(parts)
  }, [width, height, jamb, materials, detail])
  useDisposeOnChange(geometry)
  return <animated.group position={[length, height, 0]} rotation-z={spring.angle}>
    <mesh name="van-liftgate" geometry={geometry} castShadow raycast={NO_RAYCAST}>
      <meshStandardMaterial vertexColors roughness={0.45} metalness={0.18} side={closed ? DoubleSide : FrontSide} />
    </mesh>
  </animated.group>
}
