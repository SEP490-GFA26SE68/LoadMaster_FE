import { easings, useSpring } from '@react-spring/three'
import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef, type RefObject } from 'react'
import { DynamicDrawUsage, type InstancedMesh } from 'three'
import type { ScenePlacement } from '@/features/viewer3d/scene-input'
import type { AnimationQuality } from '../usePerformanceFlags'
import { cargoBounds, DROP_HEIGHT, HULL_PADDING, writeCargoMatrix, ZONE_MARK_PADDING } from './cargo-buffers'
import { toScene } from './units'
import { cargoVisibility, sameGeometry, type InstanceLayout } from './instance-layout'
import type { SceneSemantics } from '../operations/scene-semantics'

export type CargoMeshes = {
  opaque: RefObject<InstancedMesh | null>
  dim: RefObject<InstancedMesh | null>
  hull: RefObject<InstancedMesh | null>
}
type CachedSlot = { placement: ScenePlacement; visibility: ReturnType<typeof cargoVisibility>; hullVisible: boolean; marked: boolean }
const DROP_DURATION_MS = 500
const REDUCED_DROP_HEIGHT = 0.16

/** Vỏ viền của kiện nằm ngoài vùng điểm giao dày hơn viền chung. */
function hullPadding(placement: ScenePlacement, markZones: boolean): number {
  return markZones && placement.outOfZone ? ZONE_MARK_PADDING : HULL_PADDING
}

/** Track animated items: drop (new item) hoặc settle (item rơi xuống sau khi item dưới bị kéo ra). */
type AnimatedItem = { id: string; height: number; type: 'drop' | 'settle' }

/** Keep high frequency spring writes outside React. Only changed GPU slots upload. */
export function useCargoMatrices({
  meshes, layout, placements, step, sliceCm, outlines, reducedMotion, animationQuality, hiddenId, semantics, markZones = false,
}: {
  meshes: CargoMeshes
  layout: InstanceLayout
  placements: readonly ScenePlacement[]
  step: number
  sliceCm: number
  outlines: boolean
  reducedMotion: boolean
  animationQuality: AnimationQuality
  hiddenId?: string | null
  semantics?: SceneSemantics
  /** Giữ viền của kiện nằm ngoài vùng điểm giao kể cả khi viền chung tắt (tier `low`). */
  markZones?: boolean
}) {
  const invalidate = useThree((state) => state.invalidate)
  const cache = useRef<CachedSlot[]>([])
  const previousMeshes = useRef<Array<InstancedMesh | null>>([])
  const previousStep = useRef(step)
  const animation = useRef<{ id: string; height: number } | null>(null)
  /** Multi-item settle animation: id → yOffset trước khi settle */
  const settleAnimations = useRef<Map<string, AnimatedItem>>(new Map())
  /** Drop spring: dùng cho 1 item mới (playback step forward) */
  const [spring, api] = useSpring(() => ({ t: 1 }))
  /** Settle spring: dùng cho nhiều items rơi xuống sau khi item bên dưới bị di chuyển */
  const [settleSpring, settleApi] = useSpring(() => ({ t: 1 }))
  /** Snapshot position của các placement trước lần render — để detect item nào đã dịch chuyển xuống */
  const previousPositions = useRef<Map<string, { z: number }>>(new Map())
  /** Đổi phương án (layout mới) thì không coi chênh `z` giữa hai phương án là kiện rơi */
  const previousLayout = useRef(layout)

  useLayoutEffect(() => {
    const opaque = meshes.opaque.current
    const dim = meshes.dim.current
    const hull = meshes.hull.current
    if (!opaque || !dim) return
    const currentMeshes = [opaque, dim, hull]
    const recreated = currentMeshes.some((mesh, index) => mesh !== previousMeshes.current[index])
    const interruptedId = animation.current?.id
    animation.current = null
    api.stop()
    api.set({ t: 1 })
    const placementCountChanged = cache.current.length !== placements.length
    let geometryChanged = recreated || placementCountChanged

    // Kiện rơi theo trọng lực khi chỉnh tay (LM-108): `z` giảm so với lần vẽ trước thì rơi từ chỗ cũ xuống chỗ mới. Kiện đang kéo
    // (`hiddenId`, proxy thay nó) đã hiện đúng chỗ nên không rơi lại; đổi phương án thì không phải rơi. Reduced motion: đặt thẳng.
    const newSettles = new Map<string, AnimatedItem>()
    if (layout !== previousLayout.current) previousPositions.current = new Map()
    previousLayout.current = layout
    if (!reducedMotion && animationQuality !== 'none' && previousPositions.current.size > 0) {
      for (const placement of placements) {
        const prev = previousPositions.current.get(placement.id)
        if (placement.id === hiddenId || !prev || placement.position.z >= prev.z - 0.5) continue
        // Chất lượng thấp chỉ rơi một quãng ngắn như kiện mới xếp, không vẽ cả quãng rơi
        const fall = toScene(prev.z - placement.position.z)
        const height = animationQuality === 'full' ? fall : Math.min(fall, REDUCED_DROP_HEIGHT)
        newSettles.set(placement.id, { id: placement.id, height, type: 'settle' })
      }
    }
    settleAnimations.current = newSettles

    const nextCache = layout.instanceToPlacementId.map((id, index): CachedSlot => {
      const placement = layout.placementById.get(id)!
      const semantic = semantics?.appearanceById.get(id)
      let visibility = semantic?.visibility ?? cargoVisibility(placement, step, sliceCm)
      if (id === hiddenId) visibility = 'hidden'
      else if (visibility === 'opaque' && placement.position.x + placement.lengthCm > sliceCm) visibility = 'dim'
      const marked = markZones && placement.outOfZone
      const hullVisible = visibility === 'opaque' && (outlines || semantic?.tone === 'blocker' || marked)
      const before = cache.current[index]
      const geometryDiffers = before?.placement.id !== id || !sameGeometry(before?.placement, placement)
      geometryChanged ||= geometryDiffers
      if (recreated || geometryDiffers || before?.visibility !== visibility || before?.hullVisible !== hullVisible || before?.marked !== marked || interruptedId === id) {
        // Nếu item này đang trong settle animation, bắt đầu từ vị trí cao hơn
        const settle = newSettles.get(id)
        const yOffset = settle ? settle.height : 0
        writeCargoMatrix(opaque, index, placement, visibility === 'opaque', yOffset)
        writeCargoMatrix(dim, index, placement, visibility === 'dim', yOffset)
        if (hull) writeCargoMatrix(hull, index, placement, hullVisible, yOffset, hullPadding(placement, markZones))
      }
      return { placement, visibility, hullVisible, marked }
    })
    if (geometryChanged) {
      const bounds = cargoBounds(placements)
      for (const mesh of currentMeshes) {
        if (!mesh) continue
        mesh.boundingSphere = bounds
        mesh.instanceMatrix.setUsage(DynamicDrawUsage)
      }
    }
    cache.current = nextCache
    previousMeshes.current = currentMeshes
    // Cập nhật snapshot positions sau mỗi render
    const nextPositions = new Map<string, { z: number }>()
    for (const p of placements) nextPositions.set(p.id, { z: p.position.z })
    previousPositions.current = nextPositions

    // Restore the interrupted box before starting another. Scrubs never leave
    // a floating instance, even when 4× playback interrupts a 500ms spring.
    if (step === previousStep.current + 1 && !reducedMotion && animationQuality !== 'none') {
      const placement = placements.find((p) => p.step === step)
      if (placement && placement.id !== hiddenId && (!semantics || semantics.appearanceById.get(placement.id)?.visibility === 'opaque')) {
        const height = animationQuality === 'full' ? DROP_HEIGHT : REDUCED_DROP_HEIGHT
        animation.current = { id: placement.id, height }
        const index = layout.placementIdToInstance.get(placement.id)!
        const beyond = cargoVisibility(placement, step, sliceCm) === 'dim'
        writeCargoMatrix(beyond ? dim : opaque, index, placement, true, height)
        if (hull && !beyond && outlines) writeCargoMatrix(hull, index, placement, true, height, hullPadding(placement, markZones))
        invalidate()
        void api.start({
          from: { t: 0 }, to: { t: 1 },
          config: { duration: DROP_DURATION_MS, easing: easings.easeOutCubic },
        })
      }
    }

    // Settle animation: các item rơi xuống khi item bên dưới bị di chuyển
    if (newSettles.size > 0) {
      settleApi.stop()
      settleApi.set({ t: 0 })
      void settleApi.start({
        to: { t: 1 },
        config: { duration: DROP_DURATION_MS, easing: easings.easeOutCubic },
      })
      invalidate()
    }
    previousStep.current = step
    invalidate()
  }, [meshes, layout, placements, step, sliceCm, outlines, reducedMotion, animationQuality, hiddenId, semantics, markZones, api, settleApi, invalidate])

  useFrame(() => {
    const opaque = meshes.opaque.current
    const dim = meshes.dim.current
    if (!opaque || !dim) return
    const t = spring.t.get()
    let needsInvalidate = false

    // Drop animation: item mới được thêm vào (playback step)
    const active = animation.current
    if (active) {
      const placement = layout.placementById.get(active.id)
      const index = layout.placementIdToInstance.get(active.id)
      if (!placement || index === undefined) {
        animation.current = null
      } else {
        const offset = (1 - t) * active.height
        const beyond = cargoVisibility(placement, step, sliceCm) === 'dim'
        writeCargoMatrix(beyond ? dim : opaque, index, placement, true, offset)
        if (meshes.hull.current && !beyond && outlines) {
          writeCargoMatrix(meshes.hull.current, index, placement, true, offset, hullPadding(placement, markZones))
        }
        if (t >= 1) animation.current = null
        else needsInvalidate = true
      }
    }

    // Settle animation: các item phía trên rơi xuống khi item dưới bị kéo ra
    if (settleAnimations.current.size > 0) {
      const st = settleSpring.t.get()
      for (const [id, settle] of settleAnimations.current) {
        const placement = layout.placementById.get(id)
        const index = layout.placementIdToInstance.get(id)
        if (!placement || index === undefined) continue
        const offset = (1 - st) * settle.height
        const beyond = cargoVisibility(placement, step, sliceCm) === 'dim'
        // Render vào đúng mesh theo visibility, mesh kia ẩn đi
        writeCargoMatrix(beyond ? dim : opaque, index, placement, true, offset)
        writeCargoMatrix(beyond ? opaque : dim, index, placement, false, offset)
        if (meshes.hull.current && !beyond && outlines) {
          writeCargoMatrix(meshes.hull.current, index, placement, true, offset, hullPadding(placement, markZones))
        }
        needsInvalidate = true
      }
      if (st >= 1) settleAnimations.current.clear()
    }

    if (needsInvalidate) invalidate()
  })
}
