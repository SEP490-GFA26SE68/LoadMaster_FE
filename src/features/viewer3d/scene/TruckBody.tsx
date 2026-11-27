import { useMemo } from 'react'
import { BufferAttribute, BufferGeometry, Color } from 'three'
import type { TruckBodyStyle } from '@/types/vehicle-body-style'
import { bodyToneColors, piecesGeometry } from './body-piece-geometry'
import { containerEdges, type ContainerBox, type Rgb } from './container-structure'
import { FloorScale } from './ContainerDetails'
import type { SceneMaterials } from './materials'
import { truckBodyExterior } from './truck-body-exterior'
import { truckBodyShell } from './truck-body-shells'
import { useDisposeOnChange } from './useDisposeOnChange'

const NO_RAYCAST = () => null
const rgb = (hex: string): Rgb => { const c = new Color(hex); return [c.r, c.g, c.b] }

/**
 * Thân xe tải (thùng kín, mui bạt, lửng, đông lạnh) quanh đúng lòng thùng đã khai — số draw call như nhau cho cả bốn thân ở mọi tier:
 * vỏ trong mặt đơn màu theo đỉnh (`truck-body-shells.ts`), mảnh đặc ngoài lòng thùng gộp một lưới (`truck-body-exterior.ts`), 12 cạnh
 * lòng thùng (cue định hướng ở mọi tier) và thước sàn khi `detail`. Cửa sau / bửng sau do `Container` vẽ. Nhóm mang tên `truck-body`
 * và `userData.body` để E2E đo đúng thân đang vẽ.
 */
export function TruckBody({ box, body, materials, detail, edgeOpacity }: {
  box: ContainerBox; body: TruckBodyStyle; materials: SceneMaterials; detail: boolean; edgeOpacity: number
}) {
  const { length, width, height } = box
  const shell = useMemo(() => {
    const colors = {
      floor: rgb(materials.floor), wall: rgb(materials.wall), trim: rgb(materials.skirt),
      tarp: rgb(materials.tarp), insulated: rgb(materials.insulated), metal: rgb(materials.metal),
    }
    const data = truckBodyShell(body, { length, width, height }, colors, detail)
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(data.positions, 3))
    geometry.setAttribute('normal', new BufferAttribute(data.normals, 3))
    geometry.setAttribute('color', new BufferAttribute(data.colors, 3))
    geometry.computeBoundingSphere()
    return geometry
  }, [body, length, width, height, materials, detail])
  const exterior = useMemo(() => piecesGeometry(truckBodyExterior(body, { length, width, height }, detail), bodyToneColors(materials), detail ? 12 : 8),
    [body, length, width, height, materials, detail])
  const edges = useMemo(() => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(containerEdges({ length, width, height }), 3))
    return geometry
  }, [length, width, height])
  useDisposeOnChange(shell)
  useDisposeOnChange(exterior)
  useDisposeOnChange(edges)
  return <group name="truck-body" userData={{ body }}>
    <mesh name="container-shell" geometry={shell} receiveShadow raycast={NO_RAYCAST}>
      <meshStandardMaterial vertexColors roughness={0.9} metalness={0.05} />
    </mesh>
    <mesh name="container-frame" geometry={exterior} raycast={NO_RAYCAST}>
      <meshStandardMaterial vertexColors roughness={0.7} metalness={0.25} />
    </mesh>
    <lineSegments name="container-edges" geometry={edges} raycast={NO_RAYCAST}>
      <lineBasicMaterial color={materials.light} transparent opacity={edgeOpacity} depthWrite={false} />
    </lineSegments>
    {detail ? <FloorScale length={length} width={width} color={materials.light} /> : null}
  </group>
}
