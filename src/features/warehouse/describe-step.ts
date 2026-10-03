import { eq, gt, isUpright, lt, roundCm, type OrientationCode } from '@/domain/geometry'
import type { VehicleConfig, VehicleObstacle } from '@/domain/models'
import type { ScenePlacement, SceneZone } from '@/features/viewer3d/scene-input'

/**
 * Số liệu hướng dẫn cho công nhân kho, suy ra từ placement cm của revision đã duyệt (LM-060).
 * Chỉ trả số và mã; câu chữ do component dịch qua `t()` và format theo locale.
 */

/** Khe tối đa để coi kiện "nằm cạnh" một vật cản, cm — bằng một bước lưới của editor. */
export const ADJACENT_OBSTACLE_CM = 5
/** Từ khối lượng này trở lên nhắc hai người khiêng. */
const HEAVY_KG = 50

type Box = Pick<ScenePlacement, 'position' | 'lengthCm' | 'widthCm' | 'heightCm'>

export type StepMeasurements = {
  /** 1 = đặt trên sàn hoặc vật cản; mỗi kiện đỡ phía dưới cộng một lớp. */
  layer: number
  belowId: string | undefined
  frontCm: number
  rearCm: number
  leftCm: number
  rightCm: number
  floorCm: number
}

/** Hai hình chiếu sàn có diện tích chung dương; chỉ chạm cạnh thì không. */
function footprintsOverlap(a: Box, b: Box): boolean {
  return lt(a.position.x, b.position.x + b.lengthCm) && lt(b.position.x, a.position.x + a.lengthCm)
    && lt(a.position.y, b.position.y + b.widthCm) && lt(b.position.y, a.position.y + a.widthCm)
}

/** Kiện ngay dưới: đỉnh cao nhất trong các kiện chung hình chiếu có đỉnh không cao hơn đáy kiện này. */
function findBelow<T extends Box & { id: string }>(p: T, all: readonly T[]): T | undefined {
  let best: T | undefined
  for (const q of all) {
    if (q.id === p.id || !footprintsOverlap(p, q)) continue
    const top = q.position.z + q.heightCm
    if (gt(top, p.position.z)) continue
    if (!best || gt(top, best.position.z + best.heightCm)) best = q
  }
  return best
}

export function measureStep(
  p: ScenePlacement,
  all: readonly ScenePlacement[],
  vehicle: Pick<VehicleConfig, 'innerLengthCm' | 'innerWidthCm'>,
): StepMeasurements {
  const below = findBelow(p, all)
  let layer = 1
  for (let current = below; current && layer <= all.length; current = findBelow(current, all)) layer += 1
  return {
    layer,
    belowId: below?.id,
    frontCm: p.position.x,
    rearCm: roundCm(vehicle.innerLengthCm - p.position.x - p.lengthCm),
    leftCm: p.position.y,
    rightCm: roundCm(vehicle.innerWidthCm - p.position.y - p.widthCm),
    floorCm: p.position.z,
  }
}

/** Chỗ của một vùng trong thùng: sát cửa sau, giữa thùng, sát vách trước; `whole` khi phương án chỉ có một vùng. */
export type ZonePlace = 'door' | 'middle' | 'front' | 'whole'

/**
 * Vùng theo điểm giao mà kiện đang nằm (FE-6-05): tên điểm giao của vùng và chỗ của vùng trong thùng — vùng có mốc X lớn nhất sát cửa,
 * vùng bắt đầu từ vách trong (X nhỏ nhất) sát vách trước. Phương án không chia vùng, hoặc kiện không thuộc vùng nào: `undefined`.
 */
export function zonePlace(zones: readonly Pick<SceneZone, 'id' | 'name' | 'startXCm'>[], zoneId: string | undefined): { name: string; place: ZonePlace } | undefined {
  const fromDoor = zones.toSorted((a, b) => b.startXCm - a.startXCm)
  const index = fromDoor.findIndex((zone) => zone.id === zoneId)
  const zone = fromDoor[index]
  if (!zone) return undefined
  const place = fromDoor.length === 1 ? 'whole' : index === 0 ? 'door' : index === fromDoor.length - 1 ? 'front' : 'middle'
  return { name: zone.name, place }
}

export type NearbyObstacle = { obstacle: VehicleObstacle; gapCm: number }

/** Khoảng trống giữa hai đoạn trên một trục; chồng hoặc chạm nhau là 0. */
function axisGap(aStart: number, aSize: number, bStart: number, bSize: number): number {
  return Math.max(0, bStart - (aStart + aSize), aStart - (bStart + bSize))
}

/** Vật cản gần kiện nhất với khe (khoảng cách hai hộp) không quá `maxGapCm`; không có thì `undefined`. */
export function nearestObstacle(
  p: Box,
  obstacles: readonly VehicleObstacle[],
  maxGapCm = ADJACENT_OBSTACLE_CM,
): NearbyObstacle | undefined {
  let nearest: NearbyObstacle | undefined
  for (const obstacle of obstacles) {
    const gapCm = roundCm(Math.hypot(
      axisGap(p.position.x, p.lengthCm, obstacle.xCm, obstacle.lengthCm),
      axisGap(p.position.y, p.widthCm, obstacle.yCm, obstacle.widthCm),
      axisGap(p.position.z, p.heightCm, obstacle.zCm, obstacle.heightCm),
    ))
    if (gt(gapCm, maxGapCm)) continue
    if (!nearest || lt(gapCm, nearest.gapCm)) nearest = { obstacle, gapCm }
  }
  return nearest
}

export type StepNoteCode = 'fragile' | 'fragileBelow' | 'heavy' | 'notUpright' | 'default'
export type StepNote = { tone: 'warning' | 'neutral'; code: StepNoteCode }

export function stepNote(p: ScenePlacement, all: readonly ScenePlacement[]): StepNote {
  if (p.fragile) return { tone: 'warning', code: 'fragile' }
  if (findBelow(p, all)?.fragile) return { tone: 'warning', code: 'fragileBelow' }
  if (gt(p.weightKg, HEAVY_KG) || eq(p.weightKg, HEAVY_KG)) return { tone: 'neutral', code: 'heavy' }
  if (!isUpright(p.orientation)) return { tone: 'neutral', code: 'notUpright' }
  return { tone: 'neutral', code: 'default' }
}

export type OrientationHint = {
  /** Cạnh cao danh nghĩa vẫn ở trục Z (mặt trên gốc hướng lên). */
  upright: boolean
  /** Trục thùng chứa cạnh cao danh nghĩa H: Spec đọc mã theo thứ tự X, Y, Z. */
  heightAxis: 'x' | 'y' | 'z'
}

const AXES = ['x', 'y', 'z'] as const

export function orientationHint(code: OrientationCode): OrientationHint {
  return { upright: isUpright(code), heightAxis: AXES[code.indexOf('H')] ?? 'z' }
}
