import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useRef, type ReactNode } from 'react'
import { Group, Vector3 } from 'three'
import type { Vec3 } from './units'
import { useObservedSizes } from './useObservedSizes'

/**
 * A bounded screen-size label; its leader always ends at the actual world anchor. `anchor` draws the V2.3 ring on that point (SVG in
 * the same DOM layer: no extra draw call). Chiều cao nhãn đo bằng ResizeObserver (`useObservedSizes`), không đọc `offsetHeight` mỗi khung hình.
 */
export function SceneCallout({ position, offset = [0, -64], width = 160, anchor = false, children }: {
  position?: Vec3; offset?: [number, number]; width?: number; anchor?: boolean; children: ReactNode
}) {
  const group = useRef<Group>(null), label = useRef<HTMLDivElement>(null), leader = useRef<SVGSVGElement>(null)
  const path = useRef<SVGPathElement>(null)
  const projected = useRef(new Vector3()), previous = useRef('')
  const invalidate = useThree((state) => state.invalidate)
  const { track, sizeOf } = useObservedSizes(invalidate)
  const labelRef = useCallback((element: HTMLDivElement | null) => { track(element, label.current); label.current = element }, [track])
  useFrame(({ camera, size }) => {
    if (!group.current || !label.current || !leader.current || !path.current) return
    let visible = true
    for (let node = group.current.parent; node; node = node.parent) if (!node.visible) visible = false
    label.current.style.display = visible ? '' : 'none'
    leader.current.style.display = visible ? '' : 'none'
    if (!visible) return
    group.current.getWorldPosition(projected.current).project(camera)
    const x = (projected.current.x + 1) * size.width / 2, y = (1 - projected.current.y) * size.height / 2
    const halfWidth = Math.min(width, size.width - 24) / 2, halfHeight = (sizeOf(label.current)?.height ?? 0) / 2
    const dx = Math.max(halfWidth + 12, Math.min(size.width - halfWidth - 12, x + offset[0])) - x
    const dy = Math.max(halfHeight + 12, Math.min(size.height - halfHeight - 12, y + offset[1])) - y
    const key = `${dx.toFixed(1)},${dy.toFixed(1)},${halfHeight}`
    if (key === previous.current) return
    previous.current = key
    label.current.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`
    path.current.setAttribute('d', `M 0 0 L ${dx} ${dy + (dy < 0 ? halfHeight : -halfHeight)}`)
  })
  return <group ref={group} position={position}>
    <Html zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <svg ref={leader} className="absolute overflow-visible text-glass-dark-text/80" width="1" height="1" aria-hidden>
        <path ref={path} fill="none" stroke="currentColor" strokeWidth="1.5" />
        {anchor ? <circle r="4.5" className="fill-canvas-1/60" stroke="currentColor" strokeWidth="2" /> : null}
      </svg>
      <div ref={labelRef} data-scene-callout className="absolute text-center" style={{ width }}>{children}</div>
    </Html>
  </group>
}
