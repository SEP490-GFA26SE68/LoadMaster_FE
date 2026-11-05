import { haversineKm, type GeoPoint } from './haversine'

/** Một bước chỉ dẫn Goong đã rút gọn (lưu trên RouteLeg.steps). */
export type GuidanceStep = {
  readonly instruction: string
  readonly maneuver: string
  readonly distanceMeters: number
  readonly durationSeconds: number
  readonly lat: number
  readonly lng: number
}

/** Bước tài xế cần làm tiếp theo: câu chỉ dẫn + khoảng còn lại tới điểm rẽ / điểm giao. */
export type NextGuidance = {
  readonly instruction: string
  readonly maneuver: string
  readonly remainingMeters: number
}

/** Bán kính coi là đã qua bước (m): sát ngã rẽ, không nhảy sớm. */
export const GUIDANCE_PASSED_METERS = 35

function isLocated(step: GuidanceStep): boolean {
  return Number.isFinite(step.lat) && Number.isFinite(step.lng)
}

/** Bước kế tiếp theo vị trí hiện tại; không có GPS thì lấy bước đầu. */
export function nextGuidance(steps: readonly GuidanceStep[], here: GeoPoint | undefined): NextGuidance | undefined {
  if (steps.length === 0) return undefined
  const first = steps[0]
  if (first === undefined) return undefined
  if (here === undefined) {
    return { instruction: first.instruction, maneuver: first.maneuver, remainingMeters: first.distanceMeters }
  }
  let index = 0
  while (index < steps.length - 1) {
    const step = steps[index]
    if (step === undefined) break
    if (!isLocated(step)) {
      index += 1
      continue
    }
    const meters = haversineKm(here, { lat: step.lat, lng: step.lng }) * 1000
    if (meters > GUIDANCE_PASSED_METERS) {
      return { instruction: step.instruction, maneuver: step.maneuver, remainingMeters: Math.round(meters) }
    }
    index += 1
  }
  const last = steps[index] ?? first
  const remaining = isLocated(last)
    ? Math.round(haversineKm(here, { lat: last.lat, lng: last.lng }) * 1000)
    : last.distanceMeters
  return { instruction: last.instruction, maneuver: last.maneuver, remainingMeters: remaining }
}

/** Không có bước Goong: khoảng còn lại tới điểm giao, đi thẳng. */
export function remainingTo(destination: GeoPoint, here: GeoPoint | undefined): number {
  if (here === undefined) return 0
  return Math.round(haversineKm(here, destination) * 1000)
}

export function parseGuidanceSteps(raw: readonly unknown[] | null | undefined): GuidanceStep[] {
  if (!raw?.length) return []
  const steps: GuidanceStep[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const row = item as Record<string, unknown>
    const lat = typeof row.lat === 'number' ? row.lat : Number.NaN
    const lng = typeof row.lng === 'number' ? row.lng : Number.NaN
    steps.push({
      instruction: typeof row.instruction === 'string' ? row.instruction : '',
      maneuver: typeof row.maneuver === 'string' && row.maneuver !== '' ? row.maneuver : 'straight',
      distanceMeters: typeof row.distanceMeters === 'number' ? row.distanceMeters : 0,
      durationSeconds: typeof row.durationSeconds === 'number' ? row.durationSeconds : 0,
      lat,
      lng,
    })
  }
  return steps
}
