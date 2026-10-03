import { describe, expect, test } from 'vitest'
import { locateInZones, STOP_ZONE_BUFFER_CM, stopVolumes, stopZones, zonePlacements, zoneSharePercent, type StopZone } from '@/domain/zones'

const lengths = (zones: readonly StopZone[]) => zones.map(({ startXCm, endXCm }) => endXCm - startXCm)
const total = (zones: readonly StopZone[]) => lengths(zones).reduce((sum, length) => sum + length, 0) + (zones.length - 1) * STOP_ZONE_BUFFER_CM

describe('stopZones', () => {
  test('three stops at 20 / 35 / 45 % of the cargo volume on a 720 cm box: 140 / 245 / 315 cm, first stop at the door, last stop deepest', () => {
    // Tính tay: phần chia được = 720 − (3 − 1) × 10 = 700 cm → 700 × 0,20 = 140; 700 × 0,35 = 245; 700 × 0,45 = 315; 140 + 245 + 315 + 20 = 720.
    // Điểm 3 (giao cuối) sâu nhất: 0..315; đệm 315..325; điểm 2: 325..570; đệm 570..580; điểm 1 (giao đầu) sát cửa: 580..720.
    const zones = stopZones({ innerLengthCm: 720 }, [
      { stopId: 1, volumeCm3: 2_000_000 },
      { stopId: 2, volumeCm3: 3_500_000 },
      { stopId: 3, volumeCm3: 4_500_000 },
    ])
    expect(zones).toStrictEqual([
      { id: 'ZONE-1', stopId: 1, startXCm: 580, endXCm: 720 },
      { id: 'ZONE-2', stopId: 2, startXCm: 325, endXCm: 570 },
      { id: 'ZONE-3', stopId: 3, startXCm: 0, endXCm: 315 },
    ])
    expect([lengths(zones), total(zones)]).toStrictEqual([[140, 245, 315], 720])
    expect(zones.map((zone) => zoneSharePercent(zones, zone))).toStrictEqual([20, 35, 45])
  })

  test('one stop takes the whole length, no buffer', () => {
    expect(stopZones({ innerLengthCm: 600 }, [{ stopId: 1, volumeCm3: 10 }])).toStrictEqual([{ id: 'ZONE-1', stopId: 1, startXCm: 0, endXCm: 600 }])
  })

  test('shares that do not divide evenly keep every boundary on 0,1 cm and still add up to the box length', () => {
    // 600 − 20 = 580 cm chia ba: 193,33… cm mỗi vùng. Mốc cộng dồn làm tròn 0,1 cm: 193,3 và 386,7 → vùng 193,3 / 193,4 / 193,3.
    const zones = stopZones({ innerLengthCm: 600 }, [1, 2, 3].map((stopId) => ({ stopId, volumeCm3: 1000 })))
    expect(zones.map(({ startXCm, endXCm }) => [startXCm, endXCm])).toStrictEqual([[406.7, 600], [203.3, 396.7], [0, 193.3]])
    expect(total(zones)).toBeCloseTo(600, 9)
    for (const length of lengths(zones)) expect(Math.abs(length - 580 / 3)).toBeLessThanOrEqual(0.1)
  })

  test('zones follow the order of the stops given, not their numbers', () => {
    const zones = stopZones({ innerLengthCm: 410 }, [{ stopId: 7, volumeCm3: 1 }, { stopId: 2, volumeCm3: 3 }])
    expect(zones.map(({ stopId, startXCm, endXCm }) => [stopId, startXCm, endXCm])).toStrictEqual([[7, 310, 410], [2, 0, 300]])
  })

  test('nothing to divide: no stops, no cargo volume, or a box shorter than its buffers', () => {
    expect([
      stopZones({ innerLengthCm: 600 }, []),
      stopZones({ innerLengthCm: 600 }, [{ stopId: 1, volumeCm3: 0 }, { stopId: 2, volumeCm3: 0 }]),
      stopZones({ innerLengthCm: 20 }, [1, 2, 3].map((stopId) => ({ stopId, volumeCm3: 5 }))),
    ]).toStrictEqual([[], [], []])
  })
})

test('stopVolumes sums the volume of the instances of each delivery stop, in visiting order', () => {
  const box = { lengthCm: 10, widthCm: 10, heightCm: 10 }
  expect(stopVolumes([{ ...box, deliveryStop: 3 }, { ...box, deliveryStop: 1 }, { ...box, deliveryStop: 3 }])).toStrictEqual([
    { stopId: 1, volumeCm3: 1000 },
    { stopId: 3, volumeCm3: 2000 },
  ])
})

describe('where a package sits', () => {
  const zones = stopZones({ innerLengthCm: 720 }, [
    { stopId: 1, volumeCm3: 20 },
    { stopId: 2, volumeCm3: 35 },
    { stopId: 3, volumeCm3: 45 },
  ])

  test('in the zone of its own stop: that zone, no rehandling', () => {
    expect(locateInZones(zones, { xCm: 325, lengthCm: 245 }, 2)).toStrictEqual({ zoneId: 'ZONE-2', rehandled: false })
  })

  test('in the zone of another stop: that zone, counted as rehandling', () => {
    expect(locateInZones(zones, { xCm: 200, lengthCm: 100 }, 2)).toStrictEqual({ zoneId: 'ZONE-3', rehandled: true })
  })

  test('the zone is the one holding the centre of the package: sticking out a few cm is still inside, lying mostly in the next zone is not', () => {
    // Vùng 2 là 325..570. Kiện 500..575 (tâm 537,5) lấn 5 cm vào đệm; kiện 280..380 (tâm 330) lấn 45 cm vào vùng 3;
    // kiện 250..350 (tâm 300) nằm phần lớn trong vùng 3.
    expect([[500, 75], [280, 100], [250, 100]].map(([xCm = 0, lengthCm = 0]) => locateInZones(zones, { xCm, lengthCm }, 2))).toStrictEqual([
      { zoneId: 'ZONE-2', rehandled: false },
      { zoneId: 'ZONE-2', rehandled: false },
      { zoneId: 'ZONE-3', rehandled: true },
    ])
  })

  test('a centre inside a buffer goes to the nearer zone, the deeper one when exactly halfway', () => {
    // Đệm 315..325: tâm 318 gần vùng 3 (kết thúc ở 315), tâm 322 gần vùng 2 (bắt đầu ở 325), tâm 320 nằm đúng giữa.
    expect([316, 320, 318].map((xCm) => locateInZones(zones, { xCm, lengthCm: 4 }, 1).zoneId)).toStrictEqual(['ZONE-3', 'ZONE-2', 'ZONE-3'])
  })

  test('a centre exactly on a zone edge is inside that zone', () => {
    expect(locateInZones(zones, { xCm: 560, lengthCm: 20 }, 2)).toStrictEqual({ zoneId: 'ZONE-2', rehandled: false })
  })

  test('without zones there is nothing to be outside of', () => {
    expect(locateInZones([], { xCm: 0, lengthCm: 50 }, 1)).toStrictEqual({ zoneId: undefined, rehandled: false })
  })

  test('zonePlacements writes stopZoneId on every placement and counts the packages outside the zone of their stop', () => {
    const placements = [
      { packageInstanceId: 'A-01', xCm: 0, placedLengthCm: 120 },
      { packageInstanceId: 'B-01', xCm: 120, placedLengthCm: 120 },
      { packageInstanceId: 'C-01', xCm: 600, placedLengthCm: 120 },
    ]
    const stops = new Map([['A-01', 3], ['B-01', 1], ['C-01', 1]])
    expect(zonePlacements(zones, placements, stops)).toStrictEqual({
      placements: [
        { packageInstanceId: 'A-01', xCm: 0, placedLengthCm: 120, stopZoneId: 'ZONE-3' },
        { packageInstanceId: 'B-01', xCm: 120, placedLengthCm: 120, stopZoneId: 'ZONE-3' },
        { packageInstanceId: 'C-01', xCm: 600, placedLengthCm: 120, stopZoneId: 'ZONE-1' },
      ],
      rehandlingCount: 1,
    })
  })
})
