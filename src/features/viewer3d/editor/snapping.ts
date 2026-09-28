import type { ScenePlacement, PositionCm } from '@/features/viewer3d/scene-input'
import type { VehicleConfig } from '@/domain/models'
import { gt, lt, roundCm } from '@/domain/geometry'
import type { TFunction } from '@/lib/i18n'
import { AXES, EDITOR_RULES, extent, limit, obstacleBox, roundPosition, type Axis, type EditorBox } from './geometry'

/** Mặt hút, không kèm câu chữ: UI dịch qua `formatSnapSource` (LM-070). */
export type SnapSourceKind = 'floor' | 'wall' | 'ceiling' | 'package' | 'obstacle' | 'grid' | 'original'
export type SnapSource = { axis: Axis; kind: SnapSourceKind; id?: string }
export type SnapTarget = SnapSource & { coordinateCm: number; placementId?: string }

export function formatSnapSource({ axis, kind, id = '' }: SnapSource, t: TFunction): string {
  const source = kind === 'package' ? t('viewer.editor.snapSources.package', { id })
    : kind === 'obstacle' ? t('viewer.editor.snapSources.obstacle', { id })
      : t(`viewer.editor.snapSources.${kind}`)
  return t('viewer.editor.snapSources.axis', { axis: axis.toUpperCase(), source })
}

/**
 * All thresholds and face distances are cm. Fixed axes stay fixed during a gesture. Magnetic faces: floor, walls, grid, other
 * packages and load-bearing obstacles (LM-034) — a non-bearing obstacle must not invite a drop the engine then rejects.
 * `home` (LM-108): vị trí gốc của kiện trong phương án — trong `homeSnapCm` thì trục đó hút về đúng vị trí gốc, thắng mọi mặt khác.
 */
export function snapPosition(
  p: ScenePlacement, requested: PositionCm, placements: readonly ScenePlacement[], vehicle: VehicleConfig,
  axes: readonly Axis[] = AXES,
  home?: PositionCm,
): { position: PositionCm; sources: SnapSource[]; targets: SnapTarget[] } {
  const position = roundPosition(requested)
  const sources: SnapSource[] = []
  const targets: SnapTarget[] = []
  for (const axis of axes) {
    if (home && !gt(Math.abs(position[axis] - home[axis]), EDITOR_RULES.homeSnapCm)) {
      position[axis] = home[axis]
      sources.push({ axis, kind: 'original' })
      targets.push({ axis, kind: 'original', coordinateCm: home[axis] })
      continue
    }
    const size = extent(p, axis)
    const candidates: { value: number; coordinateCm: number; kind: SnapSourceKind; id?: string; placementId?: string }[] = [
      { value: 0, coordinateCm: 0, kind: axis === 'z' ? 'floor' : 'wall' },
      { value: limit(vehicle, axis) - size, coordinateCm: limit(vehicle, axis), kind: axis === 'z' ? 'ceiling' : 'wall' },
    ]
    const faces: (EditorBox & { id: string; kind: 'package' | 'obstacle' })[] = [
      ...placements.filter((q) => q.id !== p.id).map((q) => ({ ...q, kind: 'package' as const })),
      ...vehicle.obstacles.filter((o) => o.loadBearing).map((o) => ({ ...obstacleBox(o), kind: 'obstacle' as const })),
    ]
    for (const q of faces) {
      // Only nearby, projected faces are magnetic; remote boxes cannot attract a drag.
      if (!AXES.filter((a) => a !== axis).every((a) =>
        position[a] <= q.position[a] + extent(q, a) + EDITOR_RULES.snapThresholdCm &&
        position[a] + extent(p, a) >= q.position[a] - EDITOR_RULES.snapThresholdCm)) continue
      for (const value of [q.position[axis] - size, q.position[axis] + extent(q, axis)]) {
        candidates.push({ value, coordinateCm: value === q.position[axis] - size ? q.position[axis] : value,
          kind: q.kind, id: q.id, placementId: q.kind === 'package' ? q.id : undefined })
      }
    }
    // Physical faces win ties with the grid.
    const grid = Math.round(position[axis] / EDITOR_RULES.gridCm) * EDITOR_RULES.gridCm
    candidates.push({ value: grid, coordinateCm: grid, kind: 'grid' })
    let best: typeof candidates[number] | undefined
    let distance = EDITOR_RULES.snapThresholdCm + 1
    for (const candidate of candidates) {
      const delta = Math.abs(candidate.value - position[axis])
      if (!lt(candidate.value, 0) && !gt(candidate.value + size, limit(vehicle, axis)) && lt(delta, distance)) {
        best = candidate
        distance = delta
      }
    }
    if (best && !gt(distance, EDITOR_RULES.snapThresholdCm)) {
      position[axis] = roundCm(best.value)
      sources.push({ axis, kind: best.kind, id: best.id })
      targets.push({ axis, kind: best.kind, id: best.id, coordinateCm: best.coordinateCm, placementId: best.placementId })
    }
  }
  return { position, sources, targets }
}
