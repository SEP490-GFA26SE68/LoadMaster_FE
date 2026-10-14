import { animated, easings, useSpring } from '@react-spring/three'
import { useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { BoxGeometry } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { SceneMaterials } from './materials'

export function FloorScale({ length, width, color }: { length: number; width: number; color: string }) {
  const positions = useMemo(() => {
    const values: number[] = []
    // A light floor pattern plus actual one-metre station marks, one draw call.
    for (let z = 0.2; z < width; z += 0.2) values.push(0, 0.003, z, length, 0.003, z)
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
 * `hingeZ` là vị trí bản lề của cánh này theo chiều ngang thùng.
 */
export function ContainerDoor({ length, height, width, hingeZ, side, materials, detail, reducedMotion }: {
  length: number; height: number; width: number; hingeZ: number; side: -1 | 1
  materials: SceneMaterials; detail: boolean; reducedMotion: boolean
}) {
  const invalidate = useThree((state) => state.invalidate)
  const spring = useSpring({ from: { angle: side * Math.PI / 2 }, angle: side * 110 * Math.PI / 180,
    immediate: reducedMotion, config: { duration: 500, easing: easings.easeOutCubic }, onChange: () => invalidate() })
  const hardware = useMemo(() => {
    const pieces: BoxGeometry[] = []
    const add = (x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
      pieces.push(new BoxGeometry(sx, sy, sz).translate(x, y, z * side))
    }
    for (const z of [0.04, width / 2 - 0.04]) add(0.035, height / 2, z, 0.025, height, 0.05)
    for (const y of [0.04, height - 0.04]) add(0.035, y, width / 4, 0.025, 0.05, width / 2)
    for (const z of [width * 0.14, width * 0.36]) {
      add(0.06, height / 2, z, 0.04, height - 0.2, 0.025)
      add(0.09, height * 0.42, z + 0.07, 0.035, 0.035, 0.18)
    }
    for (const y of [height * 0.15, height * 0.5, height * 0.85]) add(0.045, y, 0.035, 0.065, 0.12, 0.14)
    const geometry = mergeGeometries(pieces)!
    pieces.forEach((p) => p.dispose())
    return geometry
  }, [height, width, side])
  useEffect(() => () => hardware.dispose(), [hardware])
  return <animated.group position={[length, 0, hingeZ]} rotation-y={spring.angle}>
    <mesh position={[0.015, height / 2, side * width / 4]} castShadow>
      <boxGeometry args={[0.03, height, width / 2]} />
      <meshStandardMaterial color={materials.wall} roughness={0.82} />
    </mesh>
    {detail ? <mesh geometry={hardware}>
      <meshStandardMaterial color={materials.metal} roughness={0.5} metalness={0.4} />
    </mesh> : null}
  </animated.group>
}
