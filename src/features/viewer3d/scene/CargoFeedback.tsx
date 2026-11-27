import { Line } from '@react-three/drei'
import { animated, useSpring } from '@react-spring/three'
import { useThree } from '@react-three/fiber'
import { memo, useMemo } from 'react'
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
 * theo **vai trò**, không theo kiện: bước phát lại đổi kiện "hiện tại" / "kế tiếp" chỉ đổi props — các `Line`, vật liệu và nhãn neo giữ
 * nguyên, không dựng lại mỗi bước. Hai spring chạy lại từ đầu (`reset`) khi `placement.id` đổi, nên đổi kiện vẫn là nhịp mới; vẽ lại
 * cùng kiện thì không. Giảm chuyển động thì không có nhịp. Vẫn đúng các `Line` như trước.
 */
export const CargoFeedback = memo(function CargoFeedback({ placement, role, reducedMotion, xray = false }: {
  placement: ScenePlacement; role: 'selected' | 'current' | 'next' | 'hover'; reducedMotion: boolean; xray?: boolean
}) {
  const invalidate = useThree((s) => s.invalidate)
  const id = placement.id
  const [spring] = useSpring(() => ({ from: { opacity: 0.35 }, to: { opacity: 1 }, reset: true,
    config: { duration: reducedMotion ? 100 : 180 }, onChange: () => invalidate() }), [id, reducedMotion, invalidate])
  const pulses = role === 'selected' && !reducedMotion
  const [pulse] = useSpring(() => ({ from: { p: pulses ? 0 : 1 }, to: { p: 1 }, reset: true, config: { duration: SELECT_PULSE_MS },
    immediate: !pulses, onChange: () => invalidate() }), [id, pulses, invalidate])
  const color = readToken(role === 'next' ? '--info' : role === 'current' ? '--highlight' : '--bg')
  const base = useMemo(() => boxSize(placement).map((v) => v + 0.008) as Vec3, [placement])
  const center = useMemo(() => boxCenter(placement), [placement])
  // Nhóm bọc viền co giãn quanh tâm kiện: hệ số mỗi trục để viền nở đúng `selectPulseGrowth` mét mỗi phía, kiện to hay nhỏ cũng vậy
  const grown = (axis: 0 | 1 | 2) => pulse.p.to((p) => 1 + selectPulseGrowth(p) * 2 / base[axis])
  return <group name={`feedback-${role}`}>
    <animated.group position={center} scale-x={grown(0)} scale-y={grown(1)} scale-z={grown(2)}>
      <AnimatedLine points={EDGES} segments scale={base} color={color}
        lineWidth={role === 'hover' ? 1.5 : 2.5} transparent opacity={spring.opacity} raycast={noRaycast} />
      {xray ? <Line points={EDGES} segments scale={base} color={color}
        lineWidth={1} transparent opacity={0.3} depthTest={false} depthWrite={false} raycast={noRaycast} /> : null}
    </animated.group>
    {role !== 'hover' ? <SelectionLabel placement={placement} role={role} /> : null}
  </group>
})

/** Viền không nhận tia chọn kiện: cùng một hàm qua các lần vẽ để R3F không gắn lại `raycast` mỗi lần. */
function noRaycast() { return null }
