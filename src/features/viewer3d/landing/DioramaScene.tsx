import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, Color, DoubleSide, Matrix4, type InstancedMesh, type Mesh, type MeshBasicMaterial } from 'three'
import type { VehicleConfig } from '@/domain/models'
import { stopColor } from '@/lib/stops'
import { readToken } from '@/lib/tokens'
import { applyCargoSurface, createCargoSurface } from '../scene/cargo-surface'
import { containerSize } from '../scene/units'
import { laneVisible, type LaneSlot } from './diorama-layout'
import { dioramaBaseGeometry, dioramaPalette, laneBoxGeometry } from './diorama-geometry'
import type { StorySource } from './story-clock'
import { LANE_DROP_MS, laneArrival, laneDrop, loadedCount, sweepFade, sweepX } from './story-timeline'

/** Khe giữa hai hộp cạnh nhau và giữa hai tầng (m): chồng hàng đọc ra từng kiện. */
const SIDE_GAP = 0.04
const TOP_GAP = 0.012
/** Độ đục cao nhất của mặt quét lúc tối ưu. */
const SWEEP_OPACITY = 0.22

const matrix = new Matrix4()
const color = new Color()

type Written = { step: number; time: number; motion: boolean }

/**
 * Hộp của làn chờ theo thời điểm `time` của chuyện: kiện còn ở làn khi chưa vào thùng ở bước `step` (`laneVisible`); có chuyển động
 * thì hộp chỉ hiện từ lúc tầng của nó tới làn (`laneArrival`) và rơi xuống trong `LANE_DROP_MS`. Hộp ẩn thu về kích thước 0.
 */
function writeLanes(mesh: InstancedMesh, slots: readonly LaneSlot[], time: number, step: number, motion: boolean) {
  slots.forEach((slot, index) => {
    if (!laneVisible(slot, step) || (motion && time < laneArrival(slot.lane, slot.layer))) {
      mesh.setMatrixAt(index, matrix.makeScale(0, 0, 0))
      return
    }
    const [x, y, z] = slot.center, [sx, sy, sz] = slot.size
    const drop = motion ? laneDrop(slot.lane, slot.layer, time) : 0
    mesh.setMatrixAt(index, matrix.makeScale(sx - SIDE_GAP, sy - TOP_GAP, sz - SIDE_GAP).setPosition(x, y - TOP_GAP / 2 + drop, z))
  })
  mesh.instanceMatrix.needsUpdate = true
}

/**
 * Sân kho quanh xe của khung 3D trang giới thiệu (`DIORAMA`): đúng ba draw call thêm vào cảnh dùng chung — nền gộp một mesh tô màu
 * theo đỉnh, các hộp của bốn làn chờ (một InstancedMesh, cùng atlas bề mặt với kiện trong thùng) và mặt quét lúc tối ưu (chỉ vẽ trong
 * pha quét). Ánh sáng của cảnh không đổi.
 *
 * Mọi chuyển động đọc `story.time()` trong `useFrame`, không qua React: ma trận của làn chỉ ghi lại khi bước xếp đổi, khi hộp còn đang
 * rơi, hoặc khi chuyện quay lại từ đầu. `low` (tier thấp): vật liệu Lambert, không thả hộp, không quét — làn đầy ngay từ đầu, và nền
 * thêm một khối xe giản lược vì tier thấp không vẽ cabin, bánh xe.
 */
export function DioramaScene({ slots, total, vehicle, story, low, reducedMotion }: {
  slots: readonly LaneSlot[]
  /** Số kiện của lần chạy, cùng số `LandingStageViewer` dùng để tính bước xếp của thùng */
  total: number
  vehicle: VehicleConfig
  story: StorySource
  low: boolean
  reducedMotion: boolean
}) {
  const motion = !low && !reducedMotion
  const lanes = useRef<InstancedMesh>(null)
  const sweep = useRef<Mesh>(null)
  const sweepMaterial = useRef<MeshBasicMaterial>(null)
  const written = useRef<Written>({ step: -1, time: -1, motion })
  const { length, width, height } = containerSize(vehicle)

  const base = useMemo(() => dioramaBaseGeometry(dioramaPalette(), low ? vehicle : undefined), [low, vehicle])
  const boxes = useMemo(() => laneBoxGeometry(slots.length), [slots.length])
  const surface = useMemo(() => low ? null : createCargoSurface(), [low])
  const sweepColor = useMemo(() => readToken('--cyan-300'), [])
  /** Hộp cuối cùng chạm dock: sau mốc này ma trận làn chỉ đổi theo bước xếp. */
  const intakeEnd = useMemo(() => Math.max(0, ...slots.map((slot) => laneArrival(slot.lane, slot.layer))) + LANE_DROP_MS, [slots])
  useEffect(() => () => base.dispose(), [base])
  useEffect(() => () => boxes.dispose(), [boxes])
  useEffect(() => () => surface?.dispose(), [surface])

  useLayoutEffect(() => {
    const mesh = lanes.current
    if (!mesh) return
    slots.forEach((slot, index) => mesh.setColorAt(index, color.set(stopColor(slot.stop))))
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    const time = story.time(), step = loadedCount(total, time)
    writeLanes(mesh, slots, time, step, motion)
    written.current = { step, time, motion }
  }, [slots, total, story, motion])

  useFrame(() => {
    const time = story.time()
    const mesh = lanes.current
    if (mesh) {
      const step = loadedCount(total, time), last = written.current
      // Ghi lại khi bước đổi, khi chuyện tua về đầu, và tới hết lần ghi đầu tiên sau pha thả (khung hình thưa vẫn đặt hộp chạm đáy)
      if (step !== last.step || time < last.time || (motion && last.time < intakeEnd)) {
        writeLanes(mesh, slots, time, step, motion)
        written.current = { step, time, motion }
      }
    }
    const plane = sweep.current, material = sweepMaterial.current
    if (!plane || !material) return
    const x = motion ? sweepX(time, length) : null
    plane.visible = x !== null
    if (x === null) return
    plane.position.x = x
    material.opacity = SWEEP_OPACITY * sweepFade(time)
  })

  return <group name="landing-diorama">
    <mesh name="diorama-base" geometry={base} raycast={() => null}>
      {low ? <meshLambertMaterial vertexColors /> : <meshStandardMaterial vertexColors roughness={0.9} metalness={0} />}
    </mesh>
    <instancedMesh name="diorama-lanes" key={`lanes-${slots.length}`} ref={lanes} args={[undefined, undefined, slots.length]}
      geometry={boxes} frustumCulled={false} raycast={() => null}>
      {surface
        ? <meshStandardMaterial map={surface} onBeforeCompile={applyCargoSurface} customProgramCacheKey={() => 'cargo-surface-atlas-v1'} roughness={0.86} metalness={0.02} />
        : <meshLambertMaterial />}
    </instancedMesh>
    <mesh name="diorama-sweep" ref={sweep} visible={false} position={[0, height / 2, width / 2]} rotation={[0, Math.PI / 2, 0]} raycast={() => null}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial ref={sweepMaterial} color={sweepColor} transparent opacity={0} blending={AdditiveBlending} side={DoubleSide}
        forceSinglePass depthWrite={false} toneMapped={false} />
    </mesh>
  </group>
}
