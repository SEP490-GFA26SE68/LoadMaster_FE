import type { VehicleConfig } from '@/domain/models'
import type { StopZone } from '@/domain/zones'

/** Một dải vùng trên sàn thùng: hai tam giác (18 số) và điểm neo nhãn, đều là cm nghiệp vụ xếp theo trục Three (X dọc, Y cao, Z ngang). */
export type ZoneStrip = { readonly stop: number; readonly vertices: readonly number[]; readonly labelAt: readonly [number, number, number] }

/** Độ cao của dải trên mặt sàn, cm: đủ để không trùng mặt sàn, vẫn nằm dưới đáy kiện đang rơi. */
const STRIP_HEIGHT_CM = 0.4

/**
 * Dải vùng theo điểm giao trên sàn thùng (FE-5b-07, D-79): mỗi vùng một hình chữ nhật từ `startXCm` tới `endXCm`, phủ gần hết bề
 * ngang sàn (lùi 2 cm khỏi hai vách); khoảng đệm giữa hai vùng để trống nên mép vùng đọc được. Hình nằm hoàn toàn trong mép sàn —
 * không phải dải trên thân hay gầm xe. Nhãn neo ở giữa vùng, sát mép sàn phía vách phải. Vùng dài 0 không có dải.
 */
export function zoneStrips(zones: readonly Pick<StopZone, 'stopId' | 'startXCm' | 'endXCm'>[], vehicle: Pick<VehicleConfig, 'innerLengthCm' | 'innerWidthCm'>): ZoneStrip[] {
  const width = vehicle.innerWidthCm, length = vehicle.innerLengthCm
  if (width <= 0 || length <= 0) return []
  const margin = Math.min(2, width / 10)
  const z1 = margin, z2 = width - margin, y = STRIP_HEIGHT_CM
  return zones.flatMap((zone): ZoneStrip[] => {
    const x1 = Math.max(0, zone.startXCm), x2 = Math.min(length, zone.endXCm)
    if (x2 <= x1) return []
    return [{ stop: zone.stopId, vertices: [x1, y, z1, x2, y, z1, x2, y, z2, x1, y, z1, x2, y, z2, x1, y, z2], labelAt: [(x1 + x2) / 2, y, z2] }]
  })
}
