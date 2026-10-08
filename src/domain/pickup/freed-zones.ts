import { roundKg, volumeCm3, type Box } from '@/domain/geometry'
import type { StopZone } from '@/domain/zones'
import type { PickupRouteStop, PickupVehicle } from './types'

/**
 * Vùng trống của thùng xe sau các điểm đã giao (FE-BL-01, D-88, PRD v2 mục 8.7): vùng của điểm giao đã hoàn tất, mỗi vùng là một hộp
 * suốt chiều rộng và chiều cao lòng thùng (cm, hệ toạ độ thùng). Hàm thuần: kho đưa vùng của phương án đã duyệt, tiến độ giao và khối
 * lượng hàng còn trên xe.
 */

export type FreedZone = {
  /** Số điểm giao trong phương án (`StopZone.stopId`). */
  stopId: number
  zoneId: string
  box: Box
  volumeCm3: number
}

/** Một đoạn liền của vùng trống theo trục X: các vùng trống kề nhau gộp lại, kể cả khoảng đệm giữa chúng. */
export type FreedSpan = { startXCm: number; endXCm: number }

export type FreedZones = {
  /** Theo thứ tự giao của phương án: vùng đầu sát cửa. */
  zones: FreedZone[]
  /** Theo X tăng dần. */
  spans: FreedSpan[]
  totalVolumeCm3: number
  /** Tải trọng còn nhận được: tải tối đa trừ khối lượng hàng còn trên xe, không âm. */
  payloadAvailableKg: number
}

export type FreedZonesInput = {
  vehicle: Pick<PickupVehicle, 'innerWidthCm' | 'innerHeightCm' | 'maxPayloadKg'>
  /** `result.stopZones` của phương án đã duyệt; rỗng khi phương án không chia vùng. */
  zones: readonly StopZone[]
  /** Mọi điểm của chuyến; điểm đã hoàn tất mà có số trong phương án thì vùng của nó đã trống. */
  stops: readonly Pick<PickupRouteStop, 'number' | 'completed'>[]
  /** Khối lượng mọi kiện còn trên xe, kg. */
  onboardKg: number
}

export function freedZones({ vehicle, zones, stops, onboardKg }: FreedZonesInput): FreedZones {
  const done = new Set(stops.filter((stop) => stop.completed && stop.number > 0).map((stop) => stop.number))
  const freed = zones.filter((zone) => done.has(zone.stopId))
  const list = freed.map((zone): FreedZone => {
    const box: Box = { xCm: zone.startXCm, yCm: 0, zCm: 0, lengthCm: zone.endXCm - zone.startXCm, widthCm: vehicle.innerWidthCm, heightCm: vehicle.innerHeightCm }
    return { stopId: zone.stopId, zoneId: zone.id, box, volumeCm3: volumeCm3(box) }
  })

  // Hai vùng kề nhau trong phương án cùng trống thì khoảng đệm giữa chúng cũng trống
  const freedIds = new Set(freed.map((zone) => zone.id))
  const spans: FreedSpan[] = []
  let open: FreedSpan | undefined
  for (const zone of zones.toSorted((a, b) => a.startXCm - b.startXCm)) {
    if (!freedIds.has(zone.id)) {
      open = undefined
      continue
    }
    if (open === undefined) {
      open = { startXCm: zone.startXCm, endXCm: zone.endXCm }
      spans.push(open)
    } else open.endXCm = zone.endXCm
  }

  return {
    zones: list,
    spans,
    totalVolumeCm3: list.reduce((sum, zone) => sum + zone.volumeCm3, 0),
    payloadAvailableKg: Math.max(0, roundKg(vehicle.maxPayloadKg - onboardKg)),
  }
}
