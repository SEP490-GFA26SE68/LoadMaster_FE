import { describe, expect, test } from 'vitest'
import type { VehicleConfig } from '@/domain/models'
import type { LoadPlacement, LoadPlan, PlanScore } from '@/features/optimization/load-plans-backend-api'
import { axleUsage } from './axle-usage'
import { placedSummary, runPlanCards } from './run-plan-cards'
import { scoreBars } from './score-bars'
import { serverPlanThumbnail } from './server-plan-thumbnail'

const VEHICLE: VehicleConfig = {
  id: '7', name: 'Xe tải 1,5 tấn', innerLengthCm: 400, innerWidthCm: 200, innerHeightCm: 200, maxPayloadKg: 1500,
  doorWidthCm: 200, doorHeightCm: 200, doorPosition: 'REAR', clearanceCm: 0, obstacles: [],
}

const AXLE_VEHICLE: VehicleConfig = {
  ...VEHICLE,
  axles: [{ id: 'AX-1', name: 'Trục trước', positionXCm: -100, emptyLoadKg: 1200, maxLoadKg: 2500 }, { id: 'AX-2', name: 'Trục sau', positionXCm: 300, emptyLoadKg: 900, maxLoadKg: 4000 }],
}

const placement = (over: Partial<LoadPlacement> = {}): LoadPlacement => ({
  id: '11', packageId: '301', code: 'PK-301', weightKg: 20, x: 0, y: 0, z: 0, lengthCm: 100, widthCm: 50, heightCm: 40,
  rotationType: 0, step: 1, pinned: false, stopId: '91', stopSequence: 1, ...over,
})

const plan = (over: Partial<LoadPlan> = {}): LoadPlan => ({
  id: '501', tripId: '42', jobId: 'job-1', objective: 'MAX_VOLUME', label: 'A', algorithmName: 'EP_DBLF', runAlgorithm: 'EP_DBLF', computationMs: null,
  name: null, volumePercent: null, payloadPercent: null, approved: false, approvedByName: null, centerOfGravityCm: null,
  frontAxleLoadKg: null, rearAxleLoadKg: null, rehandlingCount: null, manuallyEdited: false, stale: false, placements: [placement()], unplaced: [],
  stopZones: null, ...over,
})

describe('serverPlanThumbnail', () => {
  test('dựng từ chỗ xếp thật, cm → m, đúng số kiện', () => {
    const thumbnail = serverPlanThumbnail(plan({ placements: [placement(), placement({ id: '12', x: 100, stopSequence: 2 })] }), VEHICLE)
    expect(thumbnail?.container).toStrictEqual({ length: 4, width: 2, height: 2 })
    expect(thumbnail?.boxes.map((box) => [box.x, box.length])).toEqual([[0, 1], [1, 1]])
    expect(thumbnail?.placedCount).toBe(2)
  })

  test('thiếu dữ liệu thì không có ảnh', () => {
    expect(serverPlanThumbnail(plan(), undefined)).toBeNull()
    expect(serverPlanThumbnail(plan(), { ...VEHICLE, innerLengthCm: 0 })).toBeNull()
    expect(serverPlanThumbnail(plan({ placements: [placement({ stopSequence: null })] }), VEHICLE)).toBeNull()
    expect(serverPlanThumbnail(plan({ placements: [placement({ x: 350 })] }), VEHICLE)).toBeNull()
    expect(serverPlanThumbnail(plan({ placements: [placement({ heightCm: 0 })] }), VEHICLE)).toBeNull()
  })

  test('dung sai làm tròn 0,5 cm của máy chủ vẫn vẽ', () => {
    expect(serverPlanThumbnail(plan({ placements: [placement({ x: 300.4 })] }), VEHICLE)).not.toBeNull()
  })
})

describe('scoreBars', () => {
  const score: PlanScore = {
    profile: 'A', assumedWeights: false, j: 63.2,
    volume: { ratio: 0.8, weight: 0.6 }, count: { ratio: 1, weight: 0.3 },
    components: [
      { code: 'S1', computed: true, value: 0.1, weight: 0.5, contribution: -5 },
      { code: 'S2', computed: true, value: 0.2, weight: 0.4, contribution: -8 },
      { code: 'S3', computed: false },
      { code: 'S4', computed: true, value: 0, weight: 0.1, contribution: 0 },
    ],
  }

  test('khoản cộng 100 × w × U, khoản trừ là |phần trừ|; khoản không tính không có thanh', () => {
    const { bars } = scoreBars(score)
    expect(bars.map((bar) => [bar.key, bar.sign, Math.round(bar.points * 10) / 10])).toEqual([
      ['volume', 'plus', 48], ['count', 'plus', 30], ['S1', 'minus', 5], ['S2', 'minus', 8], ['S4', 'minus', 0],
    ])
    expect(bars[0]?.share).toBe(1)
    expect(bars[2]?.share).toBeCloseTo(5 / 48, 6)
  })

  test('khoản trừ lớn nhất; không khoản nào lấy điểm thì null', () => {
    expect(scoreBars(score).largestPenalty?.key).toBe('S2')
    expect(scoreBars({ ...score, components: [{ code: 'S4', computed: true, value: 0, weight: 0.1, contribution: 0 }] }).largestPenalty).toBeNull()
    expect(scoreBars({ ...score, volume: null, count: null, components: [] }).bars).toEqual([])
  })
})

describe('runPlanCards', () => {
  test('phương án trùng trỏ về phương án gốc của chuỗi', () => {
    const a = plan({ id: '1', label: 'A' })
    const b = plan({ id: '2', label: 'B', duplicateOf: 'A' })
    const c = plan({ id: '3', label: 'C', duplicateOf: 'B' })
    expect(runPlanCards([a, b, c]).map(({ plan: item, sameAs }) => [item.id, sameAs?.id ?? null])).toEqual([['1', null], ['2', '1'], ['3', '1']])
  })

  test('nhãn trỏ tới phương án vắng thì thẻ đầy đủ', () => {
    expect(runPlanCards([plan({ id: '2', label: 'B', duplicateOf: 'A' })])[0]?.sameAs).toBeNull()
  })

  test('số kiện xếp được: một số hay khoảng so với tổng', () => {
    const unplaced = [{ packageId: '9', code: 'PK-9', reason: null, size: null, weightKg: null }]
    expect(placedSummary([plan(), plan({ id: '2' })])).toStrictEqual({ min: 1, max: 1, total: 1 })
    expect(placedSummary([plan({ placements: [placement(), placement({ id: '12' })] }), plan({ id: '2', unplaced })]))
      .toStrictEqual({ min: 1, max: 2, total: 2 })
    expect(placedSummary([])).toBeNull()
  })
})

describe('axleUsage', () => {
  test('so tải máy chủ trả với giới hạn của xe; vượt có số kg vượt', () => {
    expect(axleUsage(plan({ frontAxleLoadKg: 1250, rearAxleLoadKg: 4400 }), AXLE_VEHICLE)).toStrictEqual([
      { group: 'front', loadKg: 1250, limitKg: 2500, share: 0.5, overKg: 0 },
      { group: 'rear', loadKg: 4400, limitKg: 4000, share: 1, overKg: 400 },
    ])
  })

  test('thiếu tải, thiếu xe hay xe không khai trục thì không có thanh', () => {
    expect(axleUsage(plan({ frontAxleLoadKg: 1250 }), AXLE_VEHICLE).map((item) => item.group)).toEqual(['front'])
    expect(axleUsage(plan({ frontAxleLoadKg: 1250, rearAxleLoadKg: 10 }), VEHICLE)).toEqual([])
    expect(axleUsage(plan({ frontAxleLoadKg: 1250 }), undefined)).toEqual([])
  })
})
