import { animated, easings, useSpring } from '@react-spring/three'
import { useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import { DOOR_LEAF, doorHardware, type DoorVariant } from './door-hardware'
import type { SceneMaterials } from './materials'
import { useDisposeOnChange } from './useDisposeOnChange'

export function FloorScale({ length, width, color }: { length: number; width: number; color: string }) {
  const positions = useMemo(() => {
    const values: number[] = []
    // Thước sàn: vạch mỗi 25 cm sát hai vách, vạch dài ở từng mét — một draw call. Vân ván sàn nằm ở màu đỉnh của vỏ thùng.
    for (let x = 0; x <= length; x += 0.25) {
      const tick = Number.isInteger(x) ? 0.16 : 0.07
      values.push(x, 0.005, 0, x, 0.005, tick, x, 0.005, width, x, 0.005, width - tick)
    }
    return new Float32Array(values)
  }, [length, width])
  return <lineSegments raycast={() => null}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
    <lineBasicMaterial color={color} transparent opacity={0.24} />
  </lineSegments>
}

/**
 * Door opening is presentation only; no state is written to the domain plan. `width` × `height` là cả ô cửa (hai cánh),
 * `hingeZ` là vị trí bản lề của cánh này theo chiều ngang thùng. `closed` (mặc định tắt) cho cánh quay về 0° — đóng kín mặt sau.
 * Van hai cánh (`leafColor` màu thân, `hardware` tắt): cánh trơn, không thanh khoá của thùng tải. `variant` `reefer` (thân đông lạnh):
 * cánh cách nhiệt dày 6 cm màu trắng, gioăng tối quanh mép, bốn bản lề (`doorHardware`).
 */
export function ContainerDoor({ length, height, width, hingeZ, side, materials, detail, reducedMotion, closed = false, leafColor, hardware: withHardware = true, variant = 'box' }: {
  length: number; height: number; width: number; hingeZ: number; side: -1 | 1
  materials: SceneMaterials; detail: boolean; reducedMotion: boolean; closed?: boolean; leafColor?: string; hardware?: boolean
  variant?: DoorVariant
}) {
  const invalidate = useThree((state) => state.invalidate)
  const spring = useSpring({ from: { angle: side * Math.PI / 2 }, angle: closed ? 0 : side * 110 * Math.PI / 180,
    immediate: reducedMotion, config: { duration: 500, easing: easings.easeOutCubic }, onChange: () => invalidate() })
  const showHardware = detail && withHardware
  const hardware = useMemo(() => showHardware ? doorHardware(height, width, side, variant, materials) : null,
    [showHardware, height, width, side, variant, materials])
  useDisposeOnChange(hardware)
  const thickness = DOOR_LEAF[variant]
  return <animated.group position={[length, 0, hingeZ]} rotation-y={spring.angle}>
    <mesh position={[thickness / 2, height / 2, side * width / 4]} castShadow>
      <boxGeometry args={[thickness, height, width / 2]} />
      <meshStandardMaterial color={leafColor ?? (variant === 'reefer' ? materials.insulated : materials.wall)} roughness={0.82} />
    </mesh>
    {hardware ? <mesh geometry={hardware}>
      <meshStandardMaterial vertexColors roughness={0.5} metalness={0.4} />
    </mesh> : null}
  </animated.group>
}
