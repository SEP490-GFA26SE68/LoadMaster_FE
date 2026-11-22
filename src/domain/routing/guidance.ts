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

/** Bước kế sau bước đang hiện (HUD “Sau đó”). */
export type FollowingGuidance = {
  readonly instruction: string
  readonly maneuver: string
}

/** Bước tài xế cần làm tiếp theo: câu chỉ dẫn + khoảng còn lại tới điểm rẽ / điểm giao. */
export type NextGuidance = {
  readonly instruction: string
  readonly maneuver: string
  readonly remainingMeters: number
  readonly then?: FollowingGuidance
}

/** Quãng và giờ còn lại tới điểm giao, cộng các bước Goong chưa đi hết. */
export type RemainingTrip = {
  readonly meters: number
  readonly seconds: number
}

/** Bán kính coi là đã qua bước (m): sát ngã rẽ, không nhảy sớm. */
export const GUIDANCE_PASSED_METERS = 35

/** Tốc độ giả khi bước Goong không có duration: 30 km/h. */
const FALLBACK_MPS = 30_000 / 3600

function isLocated(step: GuidanceStep): boolean {
  return Number.isFinite(step.lat) && Number.isFinite(step.lng)
}

function thenOf(steps: readonly GuidanceStep[], index: number): FollowingGuidance | undefined {
  const following = steps[index + 1]
  if (following === undefined) return undefined
  return { instruction: following.instruction, maneuver: following.maneuver }
}

/** Chỉ số bước chưa qua (chưa vào bán kính `GUIDANCE_PASSED_METERS`). */
export function activeStepIndex(steps: readonly GuidanceStep[], here: GeoPoint | undefined): number {
  if (steps.length === 0) return -1
  if (here === undefined) return 0
  let index = 0
  while (index < steps.length - 1) {
    const step = steps[index]
    if (step === undefined) break
    if (!isLocated(step)) {
      index += 1
      continue
    }
    const meters = haversineKm(here, { lat: step.lat, lng: step.lng }) * 1000
    if (meters > GUIDANCE_PASSED_METERS) return index
    index += 1
  }
  return index
}

/** Bước kế tiếp theo vị trí hiện tại; không có GPS thì lấy bước đầu. Kèm bước “Sau đó” nếu còn. */
export function nextGuidance(steps: readonly GuidanceStep[], here: GeoPoint | undefined): NextGuidance | undefined {
  const index = activeStepIndex(steps, here)
  if (index < 0) return undefined
  const step = steps[index]
  if (step === undefined) return undefined
  const remainingMeters =
    here === undefined
      ? step.distanceMeters
      : isLocated(step)
        ? Math.round(haversineKm(here, { lat: step.lat, lng: step.lng }) * 1000)
        : step.distanceMeters
  return {
    instruction: step.instruction,
    maneuver: step.maneuver,
    remainingMeters,
    then: thenOf(steps, index),
  }
}

/** Không có bước Goong: khoảng còn lại tới điểm giao, đi thẳng. */
export function remainingTo(destination: GeoPoint, here: GeoPoint | undefined): number {
  if (here === undefined) return 0
  return Math.round(haversineKm(here, destination) * 1000)
}

/**
 * Quãng và giờ còn lại: phần bước hiện tại (tỉ lệ theo mét còn lại) cộng các bước sau.
 * Không có bước thì chim bay tới điểm giao, giờ ước 30 km/h.
 */
export function remainingTrip(
  steps: readonly GuidanceStep[],
  here: GeoPoint | undefined,
  destination?: GeoPoint,
): RemainingTrip | undefined {
  const next = nextGuidance(steps, here)
  const index = activeStepIndex(steps, here)
  if (next !== undefined && index >= 0) {
    const current = steps[index]
    let meters = next.remainingMeters
    let seconds = 0
    if (current !== undefined) {
      if (current.durationSeconds > 0 && current.distanceMeters > 0) {
        seconds += Math.round(current.durationSeconds * Math.min(1, next.remainingMeters / current.distanceMeters))
      } else if (current.durationSeconds > 0) {
        seconds += current.durationSeconds
      } else {
        seconds += Math.round(next.remainingMeters / FALLBACK_MPS)
      }
    }
    for (let i = index + 1; i < steps.length; i += 1) {
      const step = steps[i]
      if (step === undefined) continue
      meters += step.distanceMeters
      seconds += step.durationSeconds > 0 ? step.durationSeconds : Math.round(step.distanceMeters / FALLBACK_MPS)
    }
    return { meters: Math.round(meters), seconds }
  }
  if (destination === undefined || here === undefined) return undefined
  const meters = remainingTo(destination, here)
  return { meters, seconds: Math.round(meters / FALLBACK_MPS) }
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
