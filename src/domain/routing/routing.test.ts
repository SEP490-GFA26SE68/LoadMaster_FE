import { describe, expect, test } from 'vitest'
import { deadlineStatus, haversineKm, optimizeRoute, routeEta, ROUTING_CONSTANTS, sequenceStops, type GeoPoint, type RouteInput } from '@/domain/routing'

/**
 * Số kỳ vọng không tính lại bằng code đang test (AGENTS mục 9):
 * - BNA → LAX 2.886,4444 km là số của bài "Haversine formula" trên Rosetta Code với bán kính 6.371 km.
 * - Khoảng cách và mốc giờ còn lại tính bằng máy theo **định lý cos cầu** (công thức khác haversine), R = 6.371 km, rồi ETA = giờ
 *   xuất phát + Σ(km × 1,3 ÷ 50 km/h, làm tròn ms) + 15 phút mỗi điểm đã qua.
 * Toạ độ là vị trí gần đúng của địa danh, chỉ để test.
 */
const DEPOT: GeoPoint = { lat: 10.9294, lng: 106.8747 } // Kho Long Bình (seed)
const DI_AN: GeoPoint = { lat: 10.9068, lng: 106.7694 }
const THU_DAU_MOT: GeoPoint = { lat: 10.9804, lng: 106.6519 }
const NHA_TRANG: GeoPoint = { lat: 12.2388, lng: 109.1967 }

describe('haversineKm', () => {
  test('matches published great-circle distances', () => {
    expect(haversineKm({ lat: 36.12, lng: -86.67 }, { lat: 33.94, lng: -118.4 })).toBeCloseTo(2886.4444, 4)
    // một độ kinh tuyến trên xích đạo = πR / 180
    expect(haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(111.1949, 4)
    // xích đạo → cực = πR / 2
    expect(haversineKm({ lat: 0, lng: 0 }, { lat: 90, lng: 0 })).toBeCloseTo(10007.5434, 4)
  })

  test('distances between the sample places, in either direction, and zero for the same point', () => {
    expect(haversineKm(DEPOT, DI_AN)).toBeCloseTo(11.7683, 4)
    expect(haversineKm(DI_AN, THU_DAU_MOT)).toBeCloseTo(15.2161, 4)
    expect(haversineKm(DEPOT, NHA_TRANG)).toBeCloseTo(291.8421, 4)
    expect(haversineKm(NHA_TRANG, DEPOT)).toBeCloseTo(291.8421, 4)
    expect(haversineKm(DEPOT, DEPOT)).toBe(0)
  })
})

test('the constants are the FE proposal awaiting business confirmation (PRD 17.2)', () => {
  expect(ROUTING_CONSTANTS).toStrictEqual({ ROAD_FACTOR: 1.3, AVERAGE_SPEED_KMH: 50, SERVICE_MINUTES_PER_STOP: 15, AT_RISK_MARGIN_MINUTES: 30 })
})

describe('stop order', () => {
  const stops = [
    { stopId: 'NHA-TRANG', location: NHA_TRANG },
    { stopId: 'THU-DAU-MOT', location: THU_DAU_MOT },
    { stopId: 'DI-AN', location: DI_AN },
  ]

  test('without deadlines: nearest neighbour from the depot, whatever the input order', () => {
    const input: RouteInput = { depot: DEPOT, departureTime: '2026-09-14T22:00:00+07:00', stops }
    expect(sequenceStops(input)).toStrictEqual(['DI-AN', 'THU-DAU-MOT', 'NHA-TRANG'])
    expect(optimizeRoute(input)).toStrictEqual({
      orderedStopIds: ['DI-AN', 'THU-DAU-MOT', 'NHA-TRANG'],
      stops: [
        { stopId: 'DI-AN', eta: '2026-09-14T15:18:21.515Z' },
        { stopId: 'THU-DAU-MOT', eta: '2026-09-14T15:57:05.741Z' },
        { stopId: 'NHA-TRANG', eta: '2026-09-15T00:16:27.656Z' },
      ],
      missedStopIds: [],
      totalKm: 438.7,
      totalMinutes: 571,
    })
  })

  test('one stop due tomorrow, two due next week: the stop due soonest goes first (S4b-05)', () => {
    // Ghé Dĩ An trước thì tới Nha Trang lúc 06:26 ngày mai — quá mốc hạn 06:30 − 30 phút; đi thẳng thì tới 05:35.
    const result = optimizeRoute({
      depot: DEPOT,
      departureTime: '2026-09-14T22:00:00+07:00',
      stops: [
        { stopId: 'DI-AN', location: DI_AN, deadline: '2026-09-21T17:00:00+07:00' },
        { stopId: 'THU-DAU-MOT', location: THU_DAU_MOT, deadline: '2026-09-21T17:00:00+07:00' },
        { stopId: 'NHA-TRANG', location: NHA_TRANG, deadline: '2026-09-15T06:30:00+07:00' },
      ],
    })
    expect(result).toStrictEqual({
      orderedStopIds: ['NHA-TRANG', 'DI-AN', 'THU-DAU-MOT'],
      stops: [
        { stopId: 'NHA-TRANG', eta: '2026-09-14T22:35:16.422Z', deadlineStatus: 'OK' },
        { stopId: 'DI-AN', eta: '2026-09-15T06:43:03.425Z', deadlineStatus: 'OK' },
        { stopId: 'THU-DAU-MOT', eta: '2026-09-15T07:21:47.651Z', deadlineStatus: 'OK' },
      ],
      missedStopIds: [],
      totalKm: 793.2,
      totalMinutes: 997,
    })
  })

  test('a deadline that the nearest-first order still meets with 30 minutes to spare does not change the order', () => {
    const order = sequenceStops({
      depot: DEPOT,
      departureTime: '2026-09-14T22:00:00+07:00',
      stops: [...stops.slice(1), { stopId: 'NHA-TRANG', location: NHA_TRANG, deadline: '2026-09-15T08:00:00+07:00' }],
    })
    expect(order).toStrictEqual(['DI-AN', 'THU-DAU-MOT', 'NHA-TRANG'])
  })

  test('several urgent stops: the earliest deadline first', () => {
    // cả hai hạn đều không kịp nếu đi theo điểm gần nhất (Dĩ An trước)
    const order = sequenceStops({
      depot: DEPOT,
      departureTime: '2026-09-14T08:00:00+07:00',
      stops: [
        { stopId: 'DI-AN', location: DI_AN },
        { stopId: 'NHA-TRANG', location: NHA_TRANG, deadline: '2026-09-14T15:00:00+07:00' },
        { stopId: 'THU-DAU-MOT', location: THU_DAU_MOT, deadline: '2026-09-14T09:00:00+07:00' },
      ],
    })
    expect(order).toStrictEqual(['THU-DAU-MOT', 'NHA-TRANG', 'DI-AN'])
  })

  describe('two stops equally far from the depot', () => {
    const depot: GeoPoint = { lat: 10.9, lng: 106.8 }
    const west: GeoPoint = { lat: 10.9, lng: 106.7 }
    const east: GeoPoint = { lat: 10.9, lng: 106.9 }
    const route = (first: object, second: object) =>
      sequenceStops({
        depot,
        departureTime: '2026-09-14T08:00:00+07:00',
        stops: [{ stopId: 'WEST', location: west, ...first }, { stopId: 'EAST', location: east, ...second }],
      })

    test('the higher priority goes first (D-93)', () => {
      expect(route({ priority: 2 }, { priority: 4 })).toStrictEqual(['EAST', 'WEST'])
      expect(route({}, { priority: 1 })).toStrictEqual(['WEST', 'EAST'])
      // không khai ưu tiên = Bình thường (2), thấp hơn Cao (3)
      expect(route({}, { priority: 3 })).toStrictEqual(['EAST', 'WEST'])
    })

    test('the earlier deadline beats priority; a stop with a deadline beats one without', () => {
      const week = '2026-09-21T17:00:00+07:00'
      expect(route({ priority: 4, deadline: week }, { priority: 1, deadline: '2026-09-20T17:00:00+07:00' })).toStrictEqual(['EAST', 'WEST'])
      expect(route({ priority: 4 }, { deadline: week })).toStrictEqual(['EAST', 'WEST'])
    })

    test('fully tied: input order', () => {
      expect(route({}, {})).toStrictEqual(['WEST', 'EAST'])
    })
  })

  test('no stops: an empty route', () => {
    expect(optimizeRoute({ depot: DEPOT, departureTime: '2026-09-14T08:00:00+07:00', stops: [] })).toStrictEqual({
      orderedStopIds: [], stops: [], missedStopIds: [], totalKm: 0, totalMinutes: 0,
    })
  })
})

describe('routeEta — the order the user set', () => {
  const input: RouteInput = {
    depot: DEPOT,
    departureTime: '2026-09-14T08:00:00+07:00',
    stops: [
      { stopId: 'DI-AN', location: DI_AN, deadline: '2026-09-14T09:00:00+07:00' },
      { stopId: 'THU-DAU-MOT', location: THU_DAU_MOT },
    ],
  }

  test('keeps the given order: departure + travel time of each leg + 15 minutes per stop already visited', () => {
    expect(routeEta(input, ['THU-DAU-MOT', 'DI-AN'])).toStrictEqual({
      orderedStopIds: ['THU-DAU-MOT', 'DI-AN'],
      stops: [
        // 24,9751 km × 1,3 ÷ 50 km/h = 38 phút 57,671 giây
        { stopId: 'THU-DAU-MOT', eta: '2026-09-14T01:38:57.671Z' },
        // + 15 phút dừng + 15,2161 km × 1,3 ÷ 50 km/h; hạn 09:00 (02:00Z) đã qua
        { stopId: 'DI-AN', eta: '2026-09-14T02:17:41.897Z', deadlineStatus: 'MISSED' },
      ],
      missedStopIds: ['DI-AN'],
      totalKm: 52.2,
      totalMinutes: 93,
    })
  })

  test('a stop without a deadline has no deadline status', () => {
    const [first] = routeEta(input, ['THU-DAU-MOT', 'DI-AN']).stops
    expect(first).not.toHaveProperty('deadlineStatus')
  })

  test('rejects an order that is not exactly the stops of the route', () => {
    expect(() => routeEta(input, ['DI-AN'])).toThrow()
    expect(() => routeEta(input, ['DI-AN', 'DI-AN'])).toThrow()
    expect(() => routeEta(input, ['DI-AN', 'BIEN-HOA'])).toThrow()
  })
})

test('deadline status: OK up to 30 minutes before the deadline, AT_RISK up to the deadline, MISSED after', () => {
  const deadline = '2026-09-14T10:00:00.000Z'
  expect(deadlineStatus('2026-09-14T08:00:00.000Z', deadline)).toBe('OK')
  expect(deadlineStatus('2026-09-14T09:30:00.000Z', deadline)).toBe('OK')
  expect(deadlineStatus('2026-09-14T09:30:00.001Z', deadline)).toBe('AT_RISK')
  expect(deadlineStatus('2026-09-14T10:00:00.000Z', deadline)).toBe('AT_RISK')
  expect(deadlineStatus('2026-09-14T10:00:00.001Z', deadline)).toBe('MISSED')
  // mốc giờ ISO khác múi giờ so đúng thời điểm
  expect(deadlineStatus('2026-09-14T16:45:00+07:00', deadline)).toBe('AT_RISK')
})
