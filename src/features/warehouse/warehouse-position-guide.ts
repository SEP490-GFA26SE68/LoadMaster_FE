import type { ServerCargoBox, ServerLoadingSession } from './warehouse-dto'

type Geometry = { readonly [K in 'x' | 'y' | 'z' | 'lengthCm' | 'widthCm' | 'heightCm']?: number | null } & { readonly rotation?: number | null }
export type GuideFace = 'front' | 'rear' | 'left' | 'right' | 'floor' | 'roof'
/** View-only change detector; never a replacement for the persisted loadPlanId or executionId. */
export function previewGeometryKey(session: ServerLoadingSession): string {
  return JSON.stringify([
    session.loadPlanId, session.box,
    [...(session.obstacles ?? [])].sort((a, b) => a.id.localeCompare(b.id)),
    session.placements.map((p) => [p.id, p.packageId, p.packageCode, p.sequence, p.stopSequence, p.x, p.y, p.z, p.lengthCm, p.widthCm, p.heightCm, p.rotation]),
  ])
}

export type OriginalEdge = 'L' | 'W' | 'H'
const AXES: readonly (readonly OriginalEdge[])[] = [
  ['L', 'W', 'H'], ['W', 'L', 'H'], ['L', 'H', 'W'],
  ['W', 'H', 'L'], ['H', 'L', 'W'], ['H', 'W', 'L'],
]
export type PositionGuideResult = {
  readonly issue: 'missing' | 'invalid' | 'outside' | null
  readonly distances: Readonly<Record<GuideFace, number>> | null
  readonly axes: readonly OriginalEdge[] | null
}
/** Business cm only. Packed dimensions already describe X/Y/Z; never rotate them again. */
export function positionGuide(box: ServerCargoBox | null, item: Geometry): PositionGuideResult {
  const rotation = item.rotation
  const axes = typeof rotation === 'number' && Number.isInteger(rotation) ? AXES[rotation] ?? null : null
  const values = [item.x, item.y, item.z, item.lengthCm, item.widthCm, item.heightCm,
    box?.innerLengthCm, box?.innerWidthCm, box?.innerHeightCm]
  if (values.some((v) => v == null)) return { issue: 'missing', distances: null, axes }
  if (values.some((v) => typeof v !== 'number' || !Number.isFinite(v)) ||
      values.slice(3).some((v) => (v as number) <= 0)) return { issue: 'invalid', distances: null, axes }
  const [x, y, z, l, w, h, L, W, H] = values as [number, number, number, number, number, number, number, number, number]
  const distances = { front: x, rear: L - (x + l), left: y, right: W - (y + w), floor: z, roof: H - (z + h) }
  return { issue: Object.values(distances).some((v) => v < 0) ? 'outside' : null, distances, axes }
}
