import { animated, easings, useSpring } from '@react-spring/three'
import { useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import { bodyToneColors, piecesGeometry } from './body-piece-geometry'
import { TAILGATE_THICKNESS, tailgatePieces } from './body-pieces'
import type { SceneMaterials } from './materials'
import { useDisposeOnChange } from './useDisposeOnChange'

const NO_RAYCAST = () => null

/**
 * Bửng sau hạ xuống của thân mui bạt và thân lửng (thay hai cánh cửa): bản lề ngang ở mép sàn sau, mở là thõng xuống dưới sàn (−180°),
 * `closed` là dựng đứng đóng mặt sau. Lò xo 500 ms giảm tốc như `ContainerDoor`, mỗi bước gọi `invalidate` (`frameloop="demand"`); giảm
 * chuyển động thì đặt thẳng vị trí cuối. **Một** lưới màu theo đỉnh (`tailgatePieces`): tấm, gân, nẹp, chốt và bản lề khi `detail`.
 */
export function TruckTailgate({ length, height, width, jamb, materials, detail, reducedMotion, closed }: {
  length: number; height: number; width: number; jamb: number
  materials: SceneMaterials; detail: boolean; reducedMotion: boolean; closed: boolean
}) {
  const invalidate = useThree((state) => state.invalidate)
  const spring = useSpring({ from: { angle: -Math.PI / 2 }, angle: closed ? 0 : -Math.PI,
    immediate: reducedMotion, config: { duration: 500, easing: easings.easeOutCubic }, onChange: () => invalidate() })
  const geometry = useMemo(() => piecesGeometry(tailgatePieces(height, width, jamb, detail), bodyToneColors(materials), 8),
    [height, width, jamb, detail, materials])
  useDisposeOnChange(geometry)
  return <animated.group name="truck-tailgate" position={[length + TAILGATE_THICKNESS, 0, 0]} rotation-z={spring.angle}>
    <mesh geometry={geometry} castShadow raycast={NO_RAYCAST}>
      <meshStandardMaterial vertexColors roughness={0.78} metalness={0.12} />
    </mesh>
  </animated.group>
}
