import { gt, lt, roundCm } from '@/domain/geometry'

/** Khoảng đệm giữa hai vùng liền nhau, cm (D-79). */
export const STOP_ZONE_BUFFER_CM = 10

/** Thể tích hàng của một điểm giao. `stopId` là số điểm giao của contract (`CargoPackage.deliveryStop`, 1 là điểm giao đầu). */
export type StopVolume = { readonly stopId: number; readonly volumeCm3: number }

/**
 * Vùng của một điểm giao trên trục X của thùng (vách trước = 0, cửa sau = chiều dài thùng), cm, mốc là bội 0,1 cm.
 * `stopId` là số điểm giao (`deliveryStop`) — khoá điểm giao duy nhất mà request của Spec mang theo.
 */
export type StopZone = { readonly id: string; readonly stopId: number; readonly startXCm: number; readonly endXCm: number }

type ZoneBox = { readonly xCm: number; readonly lengthCm: number }

/**
 * Chia chiều dài thùng thành vùng theo điểm giao (D-79, FE-5b-02):
 * chiều dài vùng i = (L − (n − 1) × đệm) × tỷ lệ thể tích hàng của điểm i; giữa hai vùng liền nhau có đệm 10 cm.
 * `stops` theo **thứ tự giao**: điểm đầu nằm sát cửa (X lớn), điểm cuối nằm sâu nhất (X = 0). Trả về cùng thứ tự đó.
 *
 * Mốc vùng tính cộng dồn từ vách trong rồi làm tròn 0,1 cm, mốc cuối đặt đúng bằng L — nên tổng vùng + đệm luôn bằng L, và mỗi
 * vùng lệch công thức không quá 0,1 cm. Không chia được (không có điểm nào, tổng thể tích bằng 0, thùng ngắn hơn tổng đệm) thì trả
 * mảng rỗng. Điểm không có hàng nhận vùng dài 0 — nơi gọi nên bỏ các điểm đó trước.
 */
export function stopZones(vehicle: { readonly innerLengthCm: number }, stops: readonly StopVolume[]): StopZone[] {
  const totalCm3 = stops.reduce((sum, stop) => sum + stop.volumeCm3, 0)
  const usableCm = vehicle.innerLengthCm - (stops.length - 1) * STOP_ZONE_BUFFER_CM
  if (stops.length === 0 || !gt(totalCm3, 0) || !gt(usableCm, 0)) return []
  const zones: StopZone[] = []
  let cumulativeCm3 = 0
  let startXCm = 0
  for (let index = stops.length - 1; index >= 0; index -= 1) {
    const stop = stops[index] as StopVolume
    const depth = stops.length - 1 - index
    cumulativeCm3 += stop.volumeCm3
    const endXCm = index === 0 ? vehicle.innerLengthCm : roundCm(roundCm((usableCm * cumulativeCm3) / totalCm3) + depth * STOP_ZONE_BUFFER_CM)
    zones.unshift({ id: `ZONE-${stop.stopId}`, stopId: stop.stopId, startXCm, endXCm })
    startXCm = roundCm(endXCm + STOP_ZONE_BUFFER_CM)
  }
  return zones
}

/** Thể tích hàng theo điểm giao của một tập instance, theo thứ tự giao (số điểm tăng dần); điểm không có kiện thì không có dòng. */
export function stopVolumes(
  instances: readonly { readonly deliveryStop: number; readonly lengthCm: number; readonly widthCm: number; readonly heightCm: number }[],
): StopVolume[] {
  const volumes = new Map<number, number>()
  for (const { deliveryStop, lengthCm, widthCm, heightCm } of instances) {
    volumes.set(deliveryStop, (volumes.get(deliveryStop) ?? 0) + lengthCm * widthCm * heightCm)
  }
  return [...volumes].toSorted(([a], [b]) => a - b).map(([stopId, volumeCm3]) => ({ stopId, volumeCm3 }))
}

/** Tỷ lệ của một vùng trong phần thùng chia cho các vùng (không tính đệm), %, làm tròn 0,1 — bằng tỷ lệ thể tích hàng của điểm đó. */
export function zoneSharePercent(zones: readonly StopZone[], zone: StopZone): number {
  const usableCm = zones.reduce((sum, { startXCm, endXCm }) => sum + (endXCm - startXCm), 0)
  return gt(usableCm, 0) ? roundCm(((zone.endXCm - zone.startXCm) * 100) / usableCm) : 0
}

/** Vùng chứa điểm `xCm` (mép vùng vẫn là trong vùng); điểm rơi vào đệm thuộc vùng gần hơn, đúng giữa đệm thì thuộc vùng sâu hơn. */
function zoneAt(zones: readonly StopZone[], xCm: number): StopZone | undefined {
  let nearest: StopZone | undefined
  let nearestGapCm = Number.POSITIVE_INFINITY
  for (const zone of zones) {
    const gapCm = Math.max(zone.startXCm - xCm, xCm - zone.endXCm, 0)
    if (lt(gapCm, nearestGapCm) || (!gt(gapCm, nearestGapCm) && nearest !== undefined && lt(zone.startXCm, nearest.startXCm))) {
      nearest = zone
      nearestGapCm = gapCm
    }
  }
  return nearest
}

/**
 * Kiện đang nằm ở vùng nào và có phải dỡ-xếp lại không (định nghĩa của backend: kiện nằm ngoài vùng của điểm giao mình).
 * Vùng của kiện là vùng chứa **tâm kiện theo X** — một kiện lấn qua mép vùng vài cm vẫn thuộc vùng chứa phần lớn thân nó. Vùng đó
 * không phải vùng của điểm giao mình là **một lần dỡ-xếp lại**. Phương án không có vùng nào thì không có gì để tính.
 */
export function locateInZones(zones: readonly StopZone[], box: ZoneBox, stopId: number): { zoneId: string | undefined; rehandled: boolean } {
  const zone = zoneAt(zones, box.xCm + box.lengthCm / 2)
  return { zoneId: zone?.id, rehandled: zone !== undefined && zone.stopId !== stopId }
}

/**
 * Ghi `stopZoneId` cho từng placement theo vị trí hiện tại và đếm số lần dỡ-xếp lại. Điểm giao của placement lấy từ
 * `stopByInstanceId`; placement không có trong đó là lỗi lập trình (instance luôn sinh từ kiện gốc).
 */
export function zonePlacements<P extends { readonly packageInstanceId: string; readonly xCm: number; readonly placedLengthCm: number }>(
  zones: readonly StopZone[],
  placements: readonly P[],
  stopByInstanceId: ReadonlyMap<string, number>,
): { placements: (P & { stopZoneId?: string })[]; rehandlingCount: number } {
  let rehandlingCount = 0
  const zoned = placements.map((placement): P & { stopZoneId?: string } => {
    const stopId = stopByInstanceId.get(placement.packageInstanceId)
    if (stopId === undefined) throw new Error(`Không có điểm giao cho placement ${placement.packageInstanceId}`)
    const { zoneId, rehandled } = locateInZones(zones, { xCm: placement.xCm, lengthCm: placement.placedLengthCm }, stopId)
    if (rehandled) rehandlingCount += 1
    return zoneId === undefined ? placement : { ...placement, stopZoneId: zoneId }
  })
  return { placements: zoned, rehandlingCount }
}
