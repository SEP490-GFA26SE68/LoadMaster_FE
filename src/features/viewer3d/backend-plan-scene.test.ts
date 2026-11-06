import { describe, expect, test } from 'vitest'
import { ORIENTATION_CODES, orientDimensions } from '@/domain/geometry'
import type { VehicleConfig } from '@/domain/models'
import type { LoadPlan, LoadPlacement } from '@/features/optimization/load-plan-dto'
import { isApiError } from '@/lib/api-client'
import { backendPlacementIds, backendPlanScene, baseDimensionsOf, orientationOf } from './backend-plan-scene'

const VEHICLE: VehicleConfig = {
  id: '7', name: 'Xe tải 1,5 tấn', innerLengthCm: 400, innerWidthCm: 200, innerHeightCm: 200, maxPayloadKg: 1500,
  doorWidthCm: 200, doorHeightCm: 200, doorPosition: 'REAR', clearanceCm: 0, obstacles: [],
}

const placement = (over: Partial<LoadPlacement> = {}): LoadPlacement => ({
  id: '11', packageId: '301', code: 'PK-301', weightKg: 20, x: 0, y: 0, z: 0, lengthCm: 100, widthCm: 50, heightCm: 40,
  rotationType: 0, step: 1, pinned: false, stopId: '91', stopSequence: null, ...over,
})

const plan = (over: Partial<LoadPlan> = {}): LoadPlan => ({
  id: '501', tripId: '42', jobId: 'job-1', objective: 'MAX_VOLUME', label: 'A', algorithmName: 'EP_DBLF', computationMs: null,
  name: null, volumePercent: null, payloadPercent: 12.5, approved: false, approvedByName: null, centerOfGravityCm: null,
  frontAxleLoadKg: null, rearAxleLoadKg: null, rehandlingCount: null, manuallyEdited: false, stale: false, placements: [placement()], unplaced: [], ...over,
})

const STOPS = [
  { id: '92', sequence: 2, name: 'Kho Biên Hoà', deadline: null },
  { id: '91', sequence: 1, name: 'Cửa hàng Thủ Đức', deadline: '2026-11-06T03:00:00.000Z' },
]

describe('backendPlanScene', () => {
  test('mã xoay của dịch vụ tối ưu là bộ ba cạnh dọc X, Y, Z; ngược lại đúng `orientDimensions`', () => {
    expect([0, 1, 2, 3, 4, 5].map(orientationOf)).toEqual(['LWH', 'WLH', 'LHW', 'WHL', 'HLW', 'HWL'])
    expect(orientationOf(null)).toBe('LWH')
    const base = { lengthCm: 120, widthCm: 80, heightCm: 30 }
    for (const code of ORIENTATION_CODES) {
      const placed = orientDimensions(base, code)
      expect(baseDimensionsOf({ lengthCm: placed.placedLengthCm, widthCm: placed.placedWidthCm, heightCm: placed.placedHeightCm }, code)).toEqual(base)
    }
  })

  test('điểm giao theo thứ tự của máy chủ; kiện không mang số điểm thì tra theo mã điểm', () => {
    const scene = backendPlanScene({ tripCode: 'TRIP-1', plan: plan(), vehicle: VEHICLE, stops: STOPS })
    expect(scene.stops.map((stop) => [stop.number, stop.name, stop.packageCount])).toEqual([[1, 'Cửa hàng Thủ Đức', 1], [2, 'Kho Biên Hoà', 0]])
    expect(scene.stops[0]?.deadline).toBe('2026-11-06T03:00:00.000Z')
    expect(scene.placements[0]?.stop).toBe(1)
    expect(scene.isMockResult).toBe(false)
    expect(scene.engineInput?.instances?.map(({ packageInstanceId }) => packageInstanceId)).toEqual(['PK-301'])
  })

  test('kiện thuộc điểm không có trong chuyến là lỗi dữ liệu của máy chủ', () => {
    const broken = plan({ placements: [placement({ stopId: '999' })] })
    expect(() => backendPlanScene({ tripCode: 'TRIP-1', plan: broken, vehicle: VEHICLE, stops: STOPS })).toThrow()
    try { backendPlanScene({ tripCode: 'TRIP-1', plan: broken, vehicle: VEHICLE, stops: STOPS }) } catch (error) { expect(isApiError(error)).toBe(true) }
  })

  test('số máy chủ không trả thì vắng, không vẽ 0', () => {
    const scene = backendPlanScene({ tripCode: 'TRIP-1', plan: plan(), vehicle: VEHICLE, stops: STOPS })
    expect(scene.metrics?.payloadUtilizationPercent).toBe(12.5)
    // Máy chủ không trả lấp đầy thể tích: tính từ chính kiện đã xếp và lòng thùng (100 × 50 × 40 / 400 × 200 × 200)
    expect(scene.metrics?.volumeUtilizationPercent).toBeCloseTo(1.25)
    expect(Number.isNaN(scene.metrics?.runtimeMs)).toBe(true)
    expect(scene.metrics).not.toHaveProperty('frontAxleLoadKg')
    expect(scene.metrics).not.toHaveProperty('rehandlingCount')
    expect(scene.metrics).not.toHaveProperty('centerOfGravityCm')
  })

  test('kiện chưa xếp chỉ có mã và lý do; lý do lạ là UNKNOWN', () => {
    const scene = backendPlanScene({
      tripCode: 'TRIP-1', vehicle: VEHICLE, stops: STOPS,
      plan: plan({ unplaced: [{ packageId: '302', code: 'PK-302', reason: 'OVER_WEIGHT', size: null, weightKg: null }, { packageId: '303', code: 'PK-303', reason: 'LẠ', size: null, weightKg: null }] }),
    })
    expect(scene.unplaced.map((item) => [item.name, item.reasonCode, item.detailUnknown])).toEqual([['PK-302', 'OVER_PAYLOAD', true], ['PK-303', 'UNKNOWN', true]])
  })
})

describe('backendPlacementIds', () => {
  test('mã trên khung 3D (mã kiện khi duy nhất, không thì mã chỗ xếp) dẫn về đúng mã chỗ xếp của máy chủ để ghim', () => {
    const twin = plan({ placements: [placement(), placement({ id: '12', packageId: '302', code: 'PK-302' }), placement({ id: '13', packageId: '303', code: 'PK-302' })] })
    const scene = backendPlanScene({ tripCode: 'TRIP-1', plan: twin, vehicle: VEHICLE, stops: STOPS })
    const ids = backendPlacementIds(twin)
    expect(scene.placements.map((item) => ids.get(item.id))).toEqual(['11', '12', '13'])
    expect([...ids.keys()]).toEqual(['PK-301', '12', '13'])
  })

  test('giờ đến dự kiến của tuyến máy chủ cho mức hạn từng điểm; điểm chưa có giờ đến thì không có mức hạn', () => {
    const stops = [
      { id: '91', sequence: 1, name: 'Cửa hàng Thủ Đức', deadline: '2026-11-06T03:00:00.000Z', plannedArrival: '2026-11-06T02:50:00.000Z' },
      { id: '92', sequence: 2, name: 'Kho Biên Hoà', deadline: '2026-11-06T04:00:00.000Z', plannedArrival: null },
    ]
    const scene = backendPlanScene({ tripCode: 'TRIP-1', plan: plan(), vehicle: VEHICLE, stops })
    expect(scene.stops.map((stop) => [stop.eta, stop.deadlineStatus])).toEqual([['2026-11-06T02:50:00.000Z', 'AT_RISK'], [undefined, undefined]])
  })
})
