import type { ScenePlacement } from '@/features/viewer3d/scene-input'
import type { PositionCm } from '@/features/viewer3d/scene-input'

/** Tolerance (cm) when checking if two faces are touching */
const TOUCH_TOL = 0.5

/** Check if 1D ranges [a, a+da] and [b, b+db] overlap (non-trivially) */
function rangesOverlap(a: number, da: number, b: number, db: number): boolean {
  return a + da > b + TOUCH_TOL && b + db > a + TOUCH_TOL
}

/** Check if two placements share any XY footprint area */
function xyOverlap(a: ScenePlacement, b: ScenePlacement): boolean {
  return (
    rangesOverlap(a.position.x, a.lengthCm, b.position.x, b.lengthCm) &&
    rangesOverlap(a.position.y, a.widthCm, b.position.y, b.widthCm)
  )
}

/** True if item `upper` was resting directly on `lower` (faces touching, footprint overlapping) */
function wasRestingOn(upper: ScenePlacement, lower: ScenePlacement): boolean {
  const lowerTop = lower.position.z + lower.heightCm
  return (
    Math.abs(upper.position.z - lowerTop) < TOUCH_TOL &&
    xyOverlap(upper, lower)
  )
}

/**
 * Find the highest Z surface that can support `target` among `others`.
 * Returns 0 (floor) if nothing supports it.
 */
export function findRestingZ(
  target: ScenePlacement,
  others: readonly ScenePlacement[],
): number {
  let maxZ = 0
  for (const other of others) {
    if (other.id === target.id) continue
    if (!xyOverlap(target, other)) continue
    const otherTop = other.position.z + other.heightCm
    // Only count surfaces below the target's current bottom (support, not collision)
    if (otherTop > target.position.z + target.heightCm + TOUCH_TOL) continue
    if (otherTop > maxZ) maxZ = otherTop
  }
  return maxZ
}

/**
 * Simulate gravity after moving `movedId`.
 *
 * Compares placements BEFORE and AFTER the move to find items that were
 * resting on the moved item in `prevPlacements` but are now floating in
 * `nextPlacements` (no support). Returns their updated positions (only Z changes).
 *
 * Runs one settling pass — chained falls (items resting on falling items) are
 * handled by iterating until stable (max 20 levels deep).
 */
export function simulateGravityAfterMove(
  movedId: string,
  prevPlacements: readonly ScenePlacement[],
  nextPlacements: readonly ScenePlacement[],
): Array<{ id: string; position: PositionCm }> {
  const movedPrev = prevPlacements.find((p) => p.id === movedId)
  if (!movedPrev) return []

  // Work with a mutable copy so chained falls propagate correctly
  const working = new Map<string, ScenePlacement>(nextPlacements.map((p) => [p.id, p]))

  // BFS queue: items to check for floating
  const queue = new Set<string>()

  // Seed: items that were resting on the moved item before the move
  for (const p of prevPlacements) {
    if (p.id === movedId) continue
    if (wasRestingOn(p, movedPrev)) queue.add(p.id)
  }

  const results = new Map<string, PositionCm>()

  // Settle loop: propagate falls upward (chain reaction)
  let iterations = 0
  while (queue.size > 0 && iterations < 500) {
    iterations++
    const [id] = queue
    queue.delete(id)
    const placement = working.get(id)
    if (!placement) continue

    const allNow = [...working.values()]
    const newZ = findRestingZ(placement, allNow)

    if (newZ < placement.position.z - TOUCH_TOL) {
      // This item falls — update working copy & record result
      const newPos: PositionCm = { ...placement.position, z: newZ }
      const updated = { ...placement, position: newPos }
      working.set(id, updated)
      results.set(id, newPos)

      // Check items that were resting ON this item — they may also fall
      for (const [, other] of working) {
        if (other.id === id) continue
        if (wasRestingOn(other, placement)) queue.add(other.id)
      }
    }
  }

  return [...results.entries()].map(([id, position]) => ({ id, position }))
}
