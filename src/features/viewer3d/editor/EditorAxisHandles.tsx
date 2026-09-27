import { Html } from '@react-three/drei'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { useRef } from 'react'
import type { MeshBasicMaterial } from 'three'
import { readToken } from '@/lib/tokens'
import type { Vec3 } from '../scene/units'
import type { Axis } from './geometry'

/** Mũi tên dài 35 cm tính từ mặt kiện, vùng nắm bán kính 4,5 cm — to hơn nhiều phần vẽ để chuột và ngón tay dễ trúng. */
const LENGTH = 0.35
const SHAFT_RADIUS = 0.009
const TIP_RADIUS = 0.032
const TIP_HEIGHT = 0.08
const GRAB_RADIUS = 0.045

/**
 * Trục cm → hướng trong cảnh Three.js (x dọc thùng, y cm là z cảnh, z cm là y cảnh) và phép xoay đưa hình trụ (mặc định dọc y cảnh) về
 * trục đó.
 */
const AXIS_LAYOUT: Record<Axis, { index: 0 | 1 | 2; rotation: Vec3 }> = {
  x: { index: 0, rotation: [0, 0, -Math.PI / 2] },
  y: { index: 2, rotation: [Math.PI / 2, 0, 0] },
  z: { index: 1, rotation: [0, 0, 0] },
}

/**
 * Tay kéo theo trục (LM-108): ba mũi tên X (dọc thùng), Y (ngang thùng), Z (chiều cao) mọc từ mặt kiện đang chọn. Nắm một mũi tên
 * thì kiện chỉ chạy theo trục đó (`onGrab`); kéo thân kiện vẫn là kéo trên mặt phẳng kéo. Số mesh cố định (mỗi trục thân + đầu mũi
 * tên vẽ, vùng nắm không vẽ — `visible={false}` trên vật liệu vẫn nhận raycast), không phụ thuộc số kiện. Nhãn trục bằng chữ, không
 * dựa vào màu; rê chuột lên mũi tên thì nó sáng `--highlight`.
 */
export function EditorAxisHandles({ size, disabled, onGrab }: {
  /** Kích thước kiện theo đơn vị cảnh [x, y, z] (`boxSize`). */
  size: Vec3
  disabled: boolean
  onGrab: (axis: Axis, event: ThreeEvent<PointerEvent>) => void
}) {
  return <group>
    {(['x', 'y', 'z'] as const).map((axis) => <AxisArrow key={axis} axis={axis} size={size} disabled={disabled} onGrab={onGrab} />)}
  </group>
}

function AxisArrow({ axis, size, disabled, onGrab }: { axis: Axis; size: Vec3; disabled: boolean; onGrab: (axis: Axis, event: ThreeEvent<PointerEvent>) => void }) {
  const invalidate = useThree((state) => state.invalidate)
  const gl = useThree((state) => state.gl)
  const shaft = useRef<MeshBasicMaterial>(null), tip = useRef<MeshBasicMaterial>(null)
  const { index, rotation } = AXIS_LAYOUT[axis]
  const start = size[index] / 2
  const position: Vec3 = [0, 0, 0]
  position[index] = start + LENGTH / 2
  const tipPosition: Vec3 = [0, 0, 0]
  tipPosition[index] = start + LENGTH + TIP_HEIGHT / 2
  const grabPosition: Vec3 = [0, 0, 0]
  grabPosition[index] = start + (LENGTH + TIP_HEIGHT) / 2
  const labelPosition: Vec3 = [0, 0, 0]
  labelPosition[index] = start + LENGTH + TIP_HEIGHT + 0.06
  const color = (token: `--${string}`) => {
    for (const material of [shaft.current, tip.current]) material?.color.set(readToken(token))
    invalidate()
  }
  return <>
    <mesh position={position} rotation={rotation} raycast={() => null}>
      <cylinderGeometry args={[SHAFT_RADIUS, SHAFT_RADIUS, LENGTH, 8]} />
      <meshBasicMaterial ref={shaft} color={readToken('--bg')} transparent opacity={disabled ? 0.35 : 1} depthTest={false} />
    </mesh>
    <mesh position={tipPosition} rotation={rotation} raycast={() => null}>
      <coneGeometry args={[TIP_RADIUS, TIP_HEIGHT, 12]} />
      <meshBasicMaterial ref={tip} color={readToken('--bg')} transparent opacity={disabled ? 0.35 : 1} depthTest={false} />
    </mesh>
    {disabled ? null : (
      <mesh
        name={`editor-axis-${axis}`}
        position={grabPosition}
        rotation={rotation}
        onPointerDown={(event) => onGrab(axis, event)}
        onPointerOver={(event) => { event.stopPropagation(); color('--highlight'); gl.domElement.style.setProperty('cursor', 'grab') }}
        onPointerOut={() => { color('--bg'); gl.domElement.style.removeProperty('cursor') }}
        onClick={(event) => event.stopPropagation()}
      >
        <cylinderGeometry args={[GRAB_RADIUS, GRAB_RADIUS, LENGTH + TIP_HEIGHT, 8]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    )}
    <Html position={labelPosition} zIndexRange={[19, 0]} style={{ pointerEvents: 'none' }}>
      <span className="block -translate-x-1/2 -translate-y-1/2 rounded-sm border border-glass-dark-border bg-panel-dark/85 px-1.5 py-0.5 font-mono text-body font-semibold text-glass-dark-text xl:text-note">
        {axis.toUpperCase()}
      </span>
    </Html>
  </>
}
