import { Html } from '@react-three/drei'
import { animated, useSpring } from '@react-spring/three'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Color, DoubleSide, Vector3, type Group } from 'three'
import type { VehicleConfig } from '@/domain/models'
import type { SceneZone } from '@/features/viewer3d/scene-input'
import { useFormat, useT } from '@/lib/i18n'
import { stopColor, stopForeground } from '@/lib/stops'
import { SCENE_SCALE } from '../scene/units'
import { zoneStrips } from './stop-map'

/** Nhãn nằm dưới điểm neo chừng này px; hai nhãn đè nhau thì nhãn thấp hơn trên màn lùi xuống, cách nhãn kia chừng này px. */
const LABEL_DROP_PX = 8
const LABEL_SPACING_PX = 4
/** Nội dung `<Html>` hiện ra sau khung hình đầu vài nhịp: xin thêm tối đa chừng này khung để đo nhãn, rồi thôi — demand loop phải nghỉ được. */
const MEASURE_RETRIES = 12

type LabelBox = { index: number; x: number; y: number; width: number; height: number }
type Rect = { left: number; right: number; top: number; bottom: number }

/**
 * Dải vùng theo điểm giao trên sàn thùng (FE-5b-07, D-79): **một** mesh tô màu theo đỉnh cho mọi vùng — một draw call dù phương án có
 * 1 hay 8 điểm giao. Nhãn của từng vùng (số điểm kèm màu, tên điểm, tỷ lệ thể tích hàng) là DOM neo ở mép sàn, không phải hình 3D.
 * Tier `low` vẫn vẽ: đây là cue nghiệp vụ.
 *
 * Nhãn không đè nhau và không đè nhãn "Cửa sau": mỗi khung hình được vẽ, điểm neo chiếu ra màn rồi nhãn nào chạm nhãn đã đặt thì lùi
 * xuống dưới nhãn đó. Vị trí ghi thẳng vào DOM, không qua React, và chỉ ghi khi đổi.
 *
 * `<Html>` của drei dựng nội dung ở một React root riêng, không có context của app: chữ dịch và số đã định dạng được tính ở đây rồi
 * truyền vào, trong nhãn không gọi `useT` / `useFormat`.
 */
export function ZoneStrips({ zones, vehicle, reducedMotion }: { zones: readonly SceneZone[]; vehicle: VehicleConfig; reducedMotion: boolean }) {
  const format = useFormat()
  const t = useT()
  const invalidate = useThree((s) => s.invalidate)
  const canvas = useThree((s) => s.gl.domElement)
  const spring = useSpring({ from: { opacity: 0 }, opacity: 0.6, config: { duration: reducedMotion ? 100 : 160 }, onChange: () => invalidate() })
  const strips = useMemo(() => zoneStrips(zones, vehicle), [zones, vehicle])
  const buffers = useMemo(() => {
    const vertices: number[] = [], colors: number[] = [], color = new Color()
    for (const strip of strips) {
      vertices.push(...strip.vertices.map((value) => value * SCENE_SCALE))
      color.set(stopColor(strip.stop))
      for (let i = 0; i < 6; i++) colors.push(color.r, color.g, color.b)
    }
    return { positions: new Float32Array(vertices), colors: new Float32Array(colors) }
  }, [strips])

  const group = useRef<Group>(null)
  const labels = useRef<(HTMLSpanElement | null)[]>([])
  const applied = useRef('')
  const retries = useRef(0)
  const point = useMemo(() => new Vector3(), [])
  useFrame(({ camera, size }) => {
    const root = group.current
    if (!root) return
    const boxes: LabelBox[] = []
    let unmeasured = false
    strips.forEach((strip, index) => {
      const element = labels.current[index]
      if (!element || element.offsetWidth === 0) { unmeasured = true; return }
      root.localToWorld(point.set(strip.labelAt[0], strip.labelAt[1], strip.labelAt[2]).multiplyScalar(SCENE_SCALE)).project(camera)
      boxes.push({ index, x: (point.x + 1) * size.width / 2, y: (1 - point.y) * size.height / 2, width: element.offsetWidth, height: element.offsetHeight })
    })
    const placed: Rect[] = []
    const drops: number[] = []
    // Nội dung <Html> của drei nằm trong khung bọc canvas của R3F, không phải ngay cạnh canvas
    const door = canvas.closest('[data-experience]')?.querySelector('[data-rear-door-cue]')?.getBoundingClientRect()
    if (door && door.width > 0) {
      const frame = canvas.getBoundingClientRect()
      placed.push({ left: door.left - frame.left, right: door.right - frame.left, top: door.top - frame.top, bottom: door.bottom - frame.top })
    } else unmeasured = true
    if (unmeasured && retries.current < MEASURE_RETRIES) { retries.current += 1; invalidate() }
    for (const box of boxes.sort((a, b) => a.y - b.y || a.x - b.x)) {
      const left = box.x - box.width / 2, right = box.x + box.width / 2
      let top = box.y + LABEL_DROP_PX
      for (let pass = 0; pass <= placed.length; pass += 1) {
        const hit = placed.find((rect) => left < rect.right && right > rect.left && top < rect.bottom + LABEL_SPACING_PX && top + box.height > rect.top - LABEL_SPACING_PX)
        if (!hit) break
        top = hit.bottom + LABEL_SPACING_PX
      }
      placed.push({ left, right, top, bottom: top + box.height })
      drops[box.index] = Math.round(top - box.y)
    }
    const key = drops.join(',')
    if (key === applied.current) return
    applied.current = key
    drops.forEach((drop, index) => {
      const element = labels.current[index]
      if (element) element.style.transform = `translate(-50%, ${drop}px)`
    })
  })

  return <group ref={group} name="stop-zones">
    <mesh name="stop-zone-strips" raycast={() => null}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[buffers.positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[buffers.colors, 3]} />
      </bufferGeometry>
      {/* `forceSinglePass`: vật liệu trong suốt hai mặt mặc định vẽ hai lượt (mặt sau rồi mặt trước) — dải phẳng chỉ cần một */}
      <animated.meshBasicMaterial vertexColors side={DoubleSide} transparent forceSinglePass opacity={spring.opacity} depthWrite={false} />
    </mesh>
    {strips.map((strip, index) => {
      const zone = zones.find(({ stopId }) => stopId === strip.stop)
      const [x, y, z] = strip.labelAt
      return <Html key={strip.stop} position={[x * SCENE_SCALE, y * SCENE_SCALE, z * SCENE_SCALE]} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <span ref={(element) => { labels.current[index] = element }} data-zone-label={strip.stop} title={zone?.name}
          style={{ transform: `translate(-50%, ${LABEL_DROP_PX}px)` }}
          className="flex w-max items-center gap-1.5 rounded-md border border-glass-dark-border bg-panel-dark/85 px-2 py-1 text-body-lg leading-tight whitespace-nowrap text-glass-dark-text shadow-e2 xl:text-fine">
          <span aria-hidden className="grid size-5.5 flex-none place-items-center rounded-sm font-display text-note leading-none font-semibold"
            style={{ background: stopColor(strip.stop), color: stopForeground(strip.stop) }}>{format.integer(strip.stop)}</span>
          <span className="sr-only">{t('viewer.zones.zoneOf', { number: strip.stop })}</span>
          {/* Tên điểm giao dài xuống tối đa hai dòng, không cắt bằng dấu ba chấm (`layout-1366`) */}
          <span className="line-clamp-2 max-w-40 whitespace-normal">{zone?.name}</span>
          <span className="font-display font-semibold tabular-nums text-sky-text">{format.percent(zone?.sharePercent ?? 0)}</span>
        </span>
      </Html>
    })}
  </group>
}
