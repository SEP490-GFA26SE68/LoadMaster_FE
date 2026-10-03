import { useLayoutEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { Color, DynamicDrawUsage, type InstancedMesh } from 'three'
import type { ColorMode } from '@/features/viewer3d/viewer-types'
import type { ScenePlacement } from '@/features/viewer3d/scene-input'
import { dimColor, placementColor, type ColorContext } from '../colors'
import type { InstanceLayout } from './instance-layout'
import type { CargoMeshes } from './useCargoMatrices'
import { readToken } from '@/lib/tokens'
import type { CargoAppearance, SceneSemantics } from '../operations/scene-semantics'

const color = new Color()
type ColorSlot = Pick<ScenePlacement, 'id' | 'stop' | 'packageId' | 'weightKg'> & { tone?: CargoAppearance['tone']; marked: boolean }

/**
 * Màu từng instance; chỉ ghi lại slot đã đổi. Vỏ viền: kiện chắn lối dỡ `--warning`, kiện nằm ngoài vùng điểm giao (`markZones`,
 * FE-5b-07) trắng `--bg` — màu duy nhất tách khỏi cả tám màu điểm giao (hổ phách lẫn vào cam của điểm 1 và vàng của điểm 4) —, còn
 * lại màu viền chung.
 */
export function useCargoColors(
  meshes: CargoMeshes, layout: InstanceLayout, mode: ColorMode, context: ColorContext, outlineColor: string, showHull: boolean,
  semantics?: SceneSemantics, markZones = false,
) {
  const invalidate = useThree((state) => state.invalidate)
  const cache = useRef<{ slots: ColorSlot[]; mode?: ColorMode; context?: ColorContext; mesh?: InstancedMesh; hull?: InstancedMesh | null }>({ slots: [] })
  useLayoutEffect(() => {
    const opaque = meshes.opaque.current
    const dim = meshes.dim.current
    const hull = meshes.hull.current
    if (!opaque || !dim) return
    const previous = cache.current
    const reset = previous.mode !== mode || previous.context !== context || previous.mesh !== opaque || previous.hull !== hull
    let changed = false
    const slots = layout.instanceToPlacementId.map((id, index) => {
      const p = layout.placementById.get(id)!
      const old = previous.slots[index]
      const tone = semantics?.appearanceById.get(id)?.tone
      const marked = markZones && p.outOfZone
      if (reset || old?.id !== id || old.stop !== p.stop || old.packageId !== p.packageId || old.weightKg !== p.weightKg || old.tone !== tone || old.marked !== marked) {
        const hex = placementColor(p, mode, context)
        color.set(tone === 'current' ? readToken('--highlight') : hex)
        if (tone === 'muted') color.multiplyScalar(0.68)
        opaque.setColorAt(index, color)
        dim.setColorAt(index, color.set(dimColor(hex)))
        hull?.setColorAt(index, color.set(tone === 'blocker' ? readToken('--warning') : marked ? readToken('--bg') : outlineColor))
        opaque.instanceColor?.addUpdateRange(index * 3, 3)
        dim.instanceColor?.addUpdateRange(index * 3, 3)
        hull?.instanceColor?.addUpdateRange(index * 3, 3)
        changed = true
      }
      return { id, stop: p.stop, packageId: p.packageId, weightKg: p.weightKg, tone, marked }
    })
    if (changed) {
      for (const mesh of [opaque, dim, hull]) {
        if (!mesh) continue
        if (mesh.instanceColor) {
          mesh.instanceColor.setUsage(DynamicDrawUsage)
          mesh.instanceColor.needsUpdate = true
        }
      }
      invalidate()
    }
    cache.current = { slots, mode, context, mesh: opaque, hull }
  }, [meshes, layout, mode, context, outlineColor, showHull, semantics, markZones, invalidate])
}
