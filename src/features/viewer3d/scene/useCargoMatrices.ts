import { useSpring } from '@react-spring/three'
import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef, type RefObject } from 'react'
import { DynamicDrawUsage, type InstancedMesh } from 'three'
import { freeFallDropM } from '@/domain/handling'
import type { ScenePlacement } from '@/features/viewer3d/scene-input'
import type { AnimationQuality } from '../usePerformanceFlags'
import { cargoBounds, HULL_PADDING, writeCargoMatrix, ZONE_MARK_PADDING } from './cargo-buffers'
import type { CargoInterior } from './cargo-entry'
import { REDUCED_DROP_HEIGHT, stepMotionConfig, stepMotionFor, stepMotionOffset, type StepMotion } from './cargo-step-motion'
import { toScene } from './units'
import { cargoVisibility, sameGeometry, type InstanceLayout } from './instance-layout'
import type { SceneSemantics } from '../operations/scene-semantics'

export type CargoMeshes = {
  opaque: RefObject<InstancedMesh | null>
  dim: RefObject<InstancedMesh | null>
  hull: RefObject<InstancedMesh | null>
}
type CachedSlot = { placement: ScenePlacement; visibility: ReturnType<typeof cargoVisibility>; hullVisible: boolean; marked: boolean }

/** Vỏ viền của kiện nằm ngoài vùng điểm giao dày hơn viền chung. */
function hullPadding(placement: ScenePlacement, markZones: boolean): number {
  return markZones && placement.outOfZone ? ZONE_MARK_PADDING : HULL_PADDING
}

/** Kiện đang rơi tự do sau khi mất chỗ đỡ lúc chỉnh tay: quãng rơi còn lại, đơn vị cảnh (= m). */
type FallingItem = { id: string; height: number }

/** Keep high frequency spring writes outside React. Only changed GPU slots upload. */
export function useCargoMatrices({
  meshes, layout, placements, step, sliceCm, outlines, reducedMotion, animationQuality, hiddenId, semantics, markZones = false, entry = null,
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
  /** Lòng thùng: có thì bước phát lại ở chất lượng `full` đưa kiện vào từ cửa sau (`cargo-entry.ts`); vắng thì rơi ngắn tại chỗ. */
  entry?: CargoInterior | null
}) {
  const invalidate = useThree((state) => state.invalidate)
  const cache = useRef<CachedSlot[]>([])
  const previousMeshes = useRef<Array<InstancedMesh | null>>([])
  const previousStep = useRef(step)
  const animation = useRef<StepMotion | null>(null)
  const previousEntry = useRef(entry)
  /** Kiện rơi theo trọng lực khi chỉnh tay và mốc buông (`performance.now()`), đặt lại mỗi lần vẽ */
  const falling = useRef<{ items: Map<string, FallingItem>; startedAt: number }>({ items: new Map(), startedAt: 0 })
  /** Drop spring: dùng cho 1 item mới (playback step forward) */
  const [spring, api] = useSpring(() => ({ t: 1 }))
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
    let geometryChanged = recreated || placementCountChanged || entry !== previousEntry.current
    previousEntry.current = entry

    // Kiện rơi theo trọng lực khi chỉnh tay (LM-108): `z` giảm so với lần vẽ trước thì rơi từ chỗ cũ xuống chỗ mới. Kiện đang kéo
    // (`hiddenId`, proxy thay nó) đã hiện đúng chỗ nên không rơi lại; đổi phương án thì không phải rơi. Reduced motion: đặt thẳng.
    const newSettles = new Map<string, FallingItem>()
    if (layout !== previousLayout.current) previousPositions.current = new Map()
    previousLayout.current = layout
    if (!reducedMotion && animationQuality !== 'none' && previousPositions.current.size > 0) {
      for (const placement of placements) {
        const prev = previousPositions.current.get(placement.id)
        if (placement.id === hiddenId || !prev || placement.position.z >= prev.z - 0.5) continue
        // Chất lượng thấp chỉ rơi một quãng ngắn như kiện mới xếp, không vẽ cả quãng rơi
        const fall = toScene(prev.z - placement.position.z)
        const height = animationQuality === 'full' ? fall : Math.min(fall, REDUCED_DROP_HEIGHT)
        newSettles.set(placement.id, { id: placement.id, height })
      }
    }
    // Vẽ lại giữa lúc rơi mà không có kiện rơi mới thì để kiện đang rơi rơi tiếp; đổi phương án thì bỏ
    if (newSettles.size > 0) falling.current = { items: newSettles, startedAt: performance.now() }
    else if (previousPositions.current.size === 0) falling.current.items.clear()

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
      const bounds = cargoBounds(placements, entry)
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
    // a floating instance, even when 10× playback interrupts the spring.
    if (step === previousStep.current + 1 && !reducedMotion && animationQuality !== 'none') {
      const placement = placements.find((p) => p.step === step)
      if (placement && placement.id !== hiddenId && (!semantics || semantics.appearanceById.get(placement.id)?.visibility === 'opaque')) {
        const motion = stepMotionFor(placement.id, animationQuality, entry)
        animation.current = motion
        const index = layout.placementIdToInstance.get(placement.id)!
        const beyond = cargoVisibility(placement, step, sliceCm) === 'dim'
        const [dx, dy] = stepMotionOffset(motion, placement, 0)
        writeCargoMatrix(beyond ? dim : opaque, index, placement, true, dy, 0, dx)
        if (hull && !beyond && outlines) writeCargoMatrix(hull, index, placement, true, dy, hullPadding(placement, markZones), dx)
        invalidate()
        void api.start({ from: { t: 0 }, to: { t: 1 }, config: stepMotionConfig(motion) })
      }
    }

    previousStep.current = step
    invalidate()
  }, [meshes, layout, placements, step, sliceCm, outlines, reducedMotion, animationQuality, hiddenId, semantics, markZones, entry, api, invalidate])

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
        const [dx, dy] = stepMotionOffset(active, placement, t)
        const beyond = cargoVisibility(placement, step, sliceCm) === 'dim'
        writeCargoMatrix(beyond ? dim : opaque, index, placement, true, dy, 0, dx)
        if (meshes.hull.current && !beyond && outlines) {
          writeCargoMatrix(meshes.hull.current, index, placement, true, dy, hullPadding(placement, markZones), dx)
        }
        if (t >= 1) animation.current = null
        else needsInvalidate = true
      }
    }

    // Rơi tự do (Spec vật lý 10.1): z(t) = z₀ − ½·g·t², mỗi kiện chạm mặt đỡ ở √(2h/g) của riêng nó và dừng ngay, không nảy
    const { items: fallingItems, startedAt } = falling.current
    if (fallingItems.size > 0) {
      const dropped = freeFallDropM((performance.now() - startedAt) / 1000)
      let airborne = false
      for (const [id, item] of fallingItems) {
        const placement = layout.placementById.get(id)
        const index = layout.placementIdToInstance.get(id)
        if (!placement || index === undefined) continue
        const offset = Math.max(0, item.height - dropped)
        airborne ||= offset > 0
        const beyond = cargoVisibility(placement, step, sliceCm) === 'dim'
        // Render vào đúng mesh theo visibility, mesh kia ẩn đi
        writeCargoMatrix(beyond ? dim : opaque, index, placement, true, offset)
        writeCargoMatrix(beyond ? opaque : dim, index, placement, false, offset)
        if (meshes.hull.current && !beyond && outlines) {
          writeCargoMatrix(meshes.hull.current, index, placement, true, offset, hullPadding(placement, markZones))
        }
      }
      if (airborne) needsInvalidate = true
      else fallingItems.clear()
    }

    if (needsInvalidate) invalidate()
  })
}
