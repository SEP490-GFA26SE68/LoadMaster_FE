import { Line } from '@react-three/drei'
import { animated, useSpring } from '@react-spring/three'
import { useThree } from '@react-three/fiber'
import { readToken } from '@/lib/tokens'
import type { ScenePlacement } from '@/features/viewer3d/scene-input'
import { boxCenter, boxSize, type Vec3 } from './units'
import { SelectionLabel } from './SelectionLabel'
import { selectPulseGrowth, SELECT_PULSE_MS } from './select-pulse'

const AnimatedLine = animated(Line)
const EDGES: Vec3[] = []
for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) EDGES.push([x, y, -0.5], [x, y, 0.5])
for (const x of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) EDGES.push([x, -0.5, z], [x, 0.5, z])
for (const y of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) EDGES.push([-0.5, y, z], [0.5, y, z])

/**
 * A bounded set of semantic outlines, never one React object for every cargo.
 * Kiện vừa được chọn có **một nhịp sáng một lần** (`select-pulse.ts`): viền nở ra vài cm quanh kiện rồi về sát kiện. Cha đặt `key`
 * theo kiện nên đổi kiện là nhịp mới, vẽ lại cùng kiện thì không; giảm chuyển động thì không có nhịp. Vẫn đúng các `Line` như trước.
 */
export function CargoFeedback({ placement, role, reducedMotion, xray = false }: {
  placement: ScenePlacement; role: 'selected' | 'current' | 'next' | 'hover'; reducedMotion: boolean; xray?: boolean
}) {
  const invalidate = useThree((s) => s.invalidate)
  const spring = useSpring({ from: { opacity: 0.35 }, opacity: 1, config: { duration: reducedMotion ? 100 : 180 }, onChange: () => invalidate() })
  const pulses = role === 'selected' && !reducedMotion
  const pulse = useSpring({ from: { p: pulses ? 0 : 1 }, p: 1, config: { duration: SELECT_PULSE_MS }, immediate: !pulses, onChange: () => invalidate() })
  const color = readToken(role === 'next' ? '--info' : role === 'current' ? '--highlight' : '--bg')
  const base = boxSize(placement).map((v) => v + 0.008) as Vec3
  // Nhóm bọc viền co giãn quanh tâm kiện: hệ số mỗi trục để viền nở đúng `selectPulseGrowth` mét mỗi phía, kiện to hay nhỏ cũng vậy
  const grown = (axis: 0 | 1 | 2) => pulse.p.to((p) => 1 + selectPulseGrowth(p) * 2 / base[axis])
  return <group name={`feedback-${role}`}>
    <animated.group position={boxCenter(placement)} scale-x={grown(0)} scale-y={grown(1)} scale-z={grown(2)}>
      <AnimatedLine points={EDGES} segments scale={base} color={color}
        lineWidth={role === 'hover' ? 1.5 : 2.5} transparent opacity={spring.opacity} raycast={() => null} />
      {xray ? <Line points={EDGES} segments scale={base} color={color}
        lineWidth={1} transparent opacity={0.3} depthTest={false} depthWrite={false} raycast={() => null} /> : null}
    </animated.group>
    {role !== 'hover' ? <SelectionLabel placement={placement} role={role} /> : null}
  </group>
}
