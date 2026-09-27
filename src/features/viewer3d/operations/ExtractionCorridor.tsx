import { Line } from '@react-three/drei'
import { animated, useSpring } from '@react-spring/three'
import { useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import type { ScenePlacement } from '@/features/viewer3d/scene-input'
import type { VehicleConfig } from '@/domain/models'
import { useT } from '@/lib/i18n'
import { readToken } from '@/lib/tokens'
import { boxCenter, SCENE_SCALE, type Vec3 } from '../scene/units'
import { SceneCallout } from '../scene/SceneCallout'
import { SceneTag } from '../scene/SceneTag'

/** Hành lang dỡ thẳng về cửa sau (hình ảnh, không phải lộ trình đã chứng minh). `blockers`: kiện giao sau che lối dỡ theo kiểm LIFO của domain, gần kiện đích trước. */
export function ExtractionCorridor({ target, vehicle, blockers, reducedMotion }: {
  target: ScenePlacement; vehicle: VehicleConfig; blockers: readonly ScenePlacement[]; reducedMotion: boolean
}) {
  const t = useT()
  const invalidate = useThree((s) => s.invalidate)
  const spring = useSpring({ from: { opacity: 0.05 }, opacity: 0.22, config: { duration: reducedMotion ? 100 : 180 }, onChange: () => invalidate() })
  const start = (target.position.x + target.lengthCm) * SCENE_SCALE, end = vehicle.innerLengthCm * SCENE_SCALE + 0.6
  const y = target.position.z * SCENE_SCALE + 0.008, z = (target.position.y + target.widthCm / 2) * SCENE_SCALE
  const color = readToken(blockers.length ? '--warning' : '--success')
  const points = useMemo(() => {
    const points: Vec3[] = [[start, y, z], [end, y, z]]
    const count = Math.min(10, Math.max(1, Math.ceil((end - start) / 0.5)))
    for (let i = 1; i <= count; i++) {
      const x = start + (end - start) * i / count
      points.push([x - 0.12, y, z - 0.08], [x, y, z], [x, y, z], [x - 0.12, y, z + 0.08])
    }
    // Two relationship lines at most; all blocker IDs remain available in the panel.
    for (const blocker of blockers.slice(0, 2)) {
      const from = boxCenter(target), to = boxCenter(blocker)
      from[1] += target.heightCm * SCENE_SCALE / 2 + 0.02
      to[1] += blocker.heightCm * SCENE_SCALE / 2 + 0.02
      points.push(from, to)
    }
    return points
  }, [start, end, y, z, target, blockers])
  return <group name="extraction-corridor">
    <mesh position={[(start + end) / 2, y, z]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
      <planeGeometry args={[Math.max(0.001, end - start), target.widthCm * SCENE_SCALE]} />
      <animated.meshBasicMaterial color={color} transparent opacity={spring.opacity} depthWrite={false} />
    </mesh>
    <Line points={points} segments color={color} lineWidth={2} raycast={() => null} />
    {blockers[0] ? <SceneCallout position={boxCenter(blockers[0])} offset={[150, 36]} width={180}>
      <SceneTag tone="warn" title={t('viewer.operations.blockers.callout', { count: blockers.length })} />
    </SceneCallout> : null}
  </group>
}
