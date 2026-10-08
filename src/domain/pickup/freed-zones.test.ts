import { expect, test } from 'vitest'
import { freedZones } from '@/domain/pickup'

/**
 * Vùng trống sau các điểm đã giao (FE-BL-01). Thùng 600 × 240 × 250 cm, tải 3.000 kg; ba vùng của phương án — điểm 1 sát cửa:
 * X 400–600, điểm 2 X 200–390, điểm 3 X 0–190 (khoảng đệm 10 cm giữa các vùng). Số đo tính tay: 200 × 240 × 250 = 12.000.000 cm³.
 */

const vehicle = { innerWidthCm: 240, innerHeightCm: 250, maxPayloadKg: 3000 }
const zones = [
  { id: 'ZONE-3', stopId: 3, startXCm: 0, endXCm: 190 },
  { id: 'ZONE-2', stopId: 2, startXCm: 200, endXCm: 390 },
  { id: 'ZONE-1', stopId: 1, startXCm: 400, endXCm: 600 },
]
const stop = (number: number, completed: boolean) => ({ number, completed })

test('no stop delivered yet: nothing is freed and the whole payload minus the cargo is left', () => {
  const freed = freedZones({ vehicle, zones, stops: [stop(1, false), stop(2, false), stop(3, false)], onboardKg: 1200 })
  expect(freed).toStrictEqual({ zones: [], spans: [], totalVolumeCm3: 0, payloadAvailableKg: 1800 })
})

test('one stop delivered: its zone is a box over the whole width and height of the interior', () => {
  const freed = freedZones({ vehicle, zones, stops: [stop(1, true), stop(2, false), stop(3, false)], onboardKg: 1200 })
  expect(freed.zones).toStrictEqual([{
    stopId: 1, zoneId: 'ZONE-1', volumeCm3: 12_000_000,
    box: { xCm: 400, yCm: 0, zCm: 0, lengthCm: 200, widthCm: 240, heightCm: 250 },
  }])
  expect(freed.spans).toStrictEqual([{ startXCm: 400, endXCm: 600 }])
  expect(freed.totalVolumeCm3).toBe(12_000_000)
  expect(freed.payloadAvailableKg).toBe(1800)
})

test('two neighbouring stops delivered: one span that also covers the 10 cm gap between their zones', () => {
  const freed = freedZones({ vehicle, zones, stops: [stop(1, true), stop(2, true), stop(3, false)], onboardKg: 0 })
  expect(freed.zones.map((zone) => zone.stopId)).toStrictEqual([2, 1])
  expect(freed.spans).toStrictEqual([{ startXCm: 200, endXCm: 600 }])
  // 190 × 240 × 250 + 200 × 240 × 250
  expect(freed.totalVolumeCm3).toBe(11_400_000 + 12_000_000)
})

test('zones separated by a stop that is not delivered stay two spans', () => {
  const freed = freedZones({ vehicle, zones, stops: [stop(1, true), stop(2, false), stop(3, true)], onboardKg: 0 })
  expect(freed.spans).toStrictEqual([{ startXCm: 0, endXCm: 190 }, { startXCm: 400, endXCm: 600 }])
})

test('stops inserted on the road (number 0) free nothing, and cargo over the payload leaves no payload, never a negative one', () => {
  const freed = freedZones({ vehicle, zones, stops: [stop(0, true), stop(1, false)], onboardKg: 3500 })
  expect(freed.zones).toStrictEqual([])
  expect(freed.payloadAvailableKg).toBe(0)
})
