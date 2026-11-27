import { Box3, InstancedMesh, Object3D, Sphere, Vector3 } from 'three'
import type { ScenePlacement } from '@/features/viewer3d/scene-input'
import { boxCenter, boxSize, SCENE_SCALE } from './units'
import { entryLift, entryStartDx, type CargoInterior } from './cargo-entry'

export const HULL_PADDING = 0.012
/** Vỏ viền của kiện nằm ngoài vùng điểm giao (FE-5b-07): dày gấp ba viền chung để còn đọc được ở tier `low` (DPR 0,5). */
export const ZONE_MARK_PADDING = 0.036
export const DROP_HEIGHT = 0.22
const dummy = new Object3D()
const corner = new Vector3()

export function writeCargoMatrix(
  mesh: InstancedMesh, index: number, placement: ScenePlacement,
  visible: boolean, yOffset = 0, padding = 0, xOffset = 0,
) {
  if (visible) {
    const [x, y, z] = boxCenter(placement)
    const [length, height, width] = boxSize(placement)
    dummy.position.set(x + xOffset, y + yOffset, z)
    dummy.scale.set(length + padding * 2, height + padding * 2, width + padding * 2)
  } else {
    dummy.position.set(0, 0, 0)
    dummy.scale.set(0, 0, 0)
  }
  dummy.updateMatrix()
  mesh.setMatrixAt(index, dummy.matrix)
  mesh.instanceMatrix.addUpdateRange(index * 16, 16)
  mesh.instanceMatrix.needsUpdate = true
}

/**
 * Frustum culling is disabled, but raycast still checks the mesh sphere.
 * Cover all effective boxes AND their drop path, including future cargo.
 * `interior` có (kiện vào thùng từ cửa sau, `cargo-entry.ts`) thì bao thêm hộp lúc bắt đầu — ngoài cửa sau, đã nhấc: đường đi chỉ
 * giảm dần theo X và Y nên nằm trọn giữa hộp đó và chỗ đặt.
 * Rebuild only on geometry changes; step/slice/spring never scan bounds.
 */
export function cargoBounds(placements: readonly ScenePlacement[], interior?: CargoInterior | null): Sphere {
  const bounds = new Box3()
  for (const p of placements) {
    const reachX = interior ? entryStartDx(p, interior) : 0
    const lift = interior ? Math.max(DROP_HEIGHT, entryLift(p, interior)) : DROP_HEIGHT
    bounds.expandByPoint(corner.set(
      p.position.x * SCENE_SCALE - HULL_PADDING,
      p.position.z * SCENE_SCALE - HULL_PADDING,
      p.position.y * SCENE_SCALE - HULL_PADDING,
    ))
    bounds.expandByPoint(corner.set(
      (p.position.x + p.lengthCm) * SCENE_SCALE + reachX + HULL_PADDING,
      (p.position.z + p.heightCm) * SCENE_SCALE + lift + HULL_PADDING,
      (p.position.y + p.widthCm) * SCENE_SCALE + HULL_PADDING,
    ))
  }
  return placements.length ? bounds.getBoundingSphere(new Sphere()) : new Sphere(new Vector3(), 0)
}
