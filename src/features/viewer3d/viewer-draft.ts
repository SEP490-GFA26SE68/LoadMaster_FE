import type { OrientationCode } from '@/domain/geometry'
import type { ScenePlacement, PositionCm } from '@/features/viewer3d/scene-input'
import { orientedSize, zoneFields, type ViewerSceneModel } from '@/features/viewer3d/scene-input'

export type PlacementPatch = {
  readonly position?: PositionCm
  readonly orientation?: OrientationCode
  readonly pinned?: boolean
}

/** Chỉ lưu khác biệt so với snapshot, sẵn sàng nhận một commit sau gesture. */
export type ViewerDraft = {
  readonly patches: ReadonlyMap<string, PlacementPatch>
}

export type EffectiveViewerScene = {
  /** Array mới để giữ tương thích API panel/renderer; không sửa các phần tử. */
  readonly placements: ScenePlacement[]
  readonly placementById: ReadonlyMap<string, ScenePlacement>
}

export function createViewerDraft(): ViewerDraft {
  return Object.freeze({ patches: new Map<string, PlacementPatch>() })
}

function samePosition(a: PositionCm | undefined, b: PositionCm | undefined): boolean {
  return a === b || Boolean(a && b && a.x === b.x && a.y === b.y && a.z === b.z)
}

function samePatch(a: PlacementPatch | undefined, b: PlacementPatch): boolean {
  return a?.orientation === b.orientation && a?.pinned === b.pinned && samePosition(a?.position, b.position)
}

/**
 * Các field được truyền sẽ thay field tương ứng; undefined xoá field đó.
 * Giá trị bằng snapshot được bỏ để reset hướng/ghim không để lại draft rỗng.
 */
export function patchPlacement(
  model: ViewerSceneModel,
  draft: ViewerDraft,
  id: string,
  update: PlacementPatch,
): ViewerDraft {
  const source = model.placementById.get(id)
  if (!source) return draft
  const previous = draft.patches.get(id)
  const merged = { ...previous, ...update }
  const position = merged.position && !samePosition(merged.position, source.position)
    ? Object.freeze({ ...merged.position })
    : undefined
  const orientation = merged.orientation !== source.orientation ? merged.orientation : undefined
  const pinned = merged.pinned !== source.pinned ? merged.pinned : undefined
  const patch = Object.freeze({ position, orientation, pinned })
  if (samePatch(previous, patch)) return draft

  const patches = new Map(draft.patches)
  if (position === undefined && orientation === undefined && pinned === undefined) patches.delete(id)
  else patches.set(id, patch)
  return Object.freeze({ patches })
}

/**
 * Immutable snapshot + draft keyed by id = effective dimensions/positions. Kiện đã dời hoặc xoay được xét lại vùng điểm giao theo vị
 * trí mới (FE-5b-07), nên dấu "ngoài vùng" và số lần dỡ-xếp lại đi theo bản đang chỉnh tay.
 */
export function resolveEffectiveScene(model: ViewerSceneModel, draft: ViewerDraft): EffectiveViewerScene {
  const placementById = new Map<string, ScenePlacement>()
  const placements = model.placements.map((source) => {
    const patch = draft.patches.get(source.id)
    const baseDimensions = model.baseDimensionsById.get(source.id)
    if (!patch || !baseDimensions) {
      placementById.set(source.id, source)
      return source
    }
    const orientation = patch.orientation ?? source.orientation
    const size = orientedSize(baseDimensions, orientation)
    const position = patch.position ?? source.position
    const { zoneId: _sourceZone, ...rest } = source
    const placement: ScenePlacement = Object.freeze({
      ...rest,
      ...size,
      orientation,
      position,
      pinned: patch.pinned ?? source.pinned,
      ...zoneFields(model.zones, { position, lengthCm: size.lengthCm, stop: source.stop }),
    })
    placementById.set(source.id, placement)
    return placement
  })
  return { placements, placementById }
}
