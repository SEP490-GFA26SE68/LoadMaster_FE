import { useMemo } from 'react'
import { BoxGeometry, BufferAttribute, BufferGeometry, Color } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { SceneMaterials } from './materials'
import { containerEdges, containerFrame, containerShell, type ContainerBox, type Rgb } from './container-structure'
import { tintGeometry } from './tint-geometry'
import { useDisposeOnChange } from './useDisposeOnChange'

const NO_RAYCAST = () => null
const rgb = (hex: string): Rgb => { const c = new Color(hex); return [c.r, c.g, c.b] }

/**
 * Ba lớp của thùng, mỗi lớp **một** draw call ở mọi tier (hình học thuần ở `container-structure.ts`):
 * vỏ trong (sàn + ba vách mặt đơn, màu theo đỉnh — gân, trụ góc, đà nóc, ray chằng hàng khi `detail`), khung ngoài (gờ, ngưỡng cửa;
 * `detail` thêm trụ góc trước, xà và đà nóc) và 12 cạnh lòng thùng. Không có nóc đặc hay mặt trong suốt nào: nhìn từ góc chéo và góc
 * Trên luôn thấy hàng qua các đà nóc mảnh.
 */
export function ContainerStructure({ box, materials, detail, edgeOpacity }: {
  box: ContainerBox; materials: SceneMaterials; detail: boolean; edgeOpacity: number
}) {
  const { length, width, height } = box
  const shell = useMemo(() => {
    const data = containerShell({ length, width, height }, { floor: rgb(materials.floor), wall: rgb(materials.wall), trim: rgb(materials.skirt) }, detail)
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(data.positions, 3))
    geometry.setAttribute('normal', new BufferAttribute(data.normals, 3))
    geometry.setAttribute('color', new BufferAttribute(data.colors, 3))
    geometry.computeBoundingSphere()
    return geometry
  }, [length, width, height, materials, detail])
  const frame = useMemo(() => {
    const beam = `#${new Color(materials.wall).lerp(new Color(materials.skirt), 0.85).getHexString()}`
    const pieces = containerFrame({ length, width, height }, detail).map(({ min, max, tone }) => tintGeometry(
      new BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2])
        .translate((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2),
      tone === 'beam' ? beam : materials.skirt))
    const geometry = mergeGeometries(pieces)!
    pieces.forEach((p) => p.dispose())
    return geometry
  }, [length, width, height, materials, detail])
  const edges = useMemo(() => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(containerEdges({ length, width, height }), 3))
    return geometry
  }, [length, width, height])
  useDisposeOnChange(shell)
  useDisposeOnChange(frame)
  useDisposeOnChange(edges)
  return <>
    <mesh name="container-shell" geometry={shell} receiveShadow raycast={NO_RAYCAST}>
      <meshStandardMaterial vertexColors roughness={0.9} metalness={0.05} />
    </mesh>
    <mesh name="container-frame" geometry={frame} raycast={NO_RAYCAST}>
      <meshStandardMaterial vertexColors roughness={0.7} metalness={0.25} />
    </mesh>
    <lineSegments name="container-edges" geometry={edges} raycast={NO_RAYCAST}>
      <lineBasicMaterial color={materials.light} transparent opacity={edgeOpacity} depthWrite={false} />
    </lineSegments>
  </>
}
