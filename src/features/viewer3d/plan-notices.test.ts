import { expect, test } from 'vitest'
import { approvedElsewhere, planTripDelta, warehouseProgress } from './plan-notices'

/** Số của các thanh thông báo Planner V2.3 (LM-107): chênh kiện khi lỗi thời, tiến độ kho, bản duyệt kho đang đọc. */

test('the stale plan counts packages against the trip and names only the stops that differ', () => {
  const plan = [{ quantity: 80, deliveryStop: 1 }, { quantity: 60, deliveryStop: 1 }, { quantity: 60, deliveryStop: 2 }]
  const trip = [{ quantity: 86, deliveryStop: 1 }, { quantity: 60, deliveryStop: 1 }, { quantity: 60, deliveryStop: 2 }]
  expect(planTripDelta(plan, trip)).toStrictEqual({ plan: 200, trip: 206, stops: [{ number: 1, plan: 140, trip: 146 }] })
})

test('a stop added or removed after the optimization shows up with zero on the other side', () => {
  expect(planTripDelta([{ quantity: 5, deliveryStop: 1 }], [{ quantity: 5, deliveryStop: 1 }, { quantity: 2, deliveryStop: 3 }]).stops)
    .toStrictEqual([{ number: 3, plan: 0, trip: 2 }])
})

test('warehouse progress counts loaded steps without damaged packages left out, out of the plan the warehouse locked', () => {
  const trip = {
    loading: {
      revisionId: 'REV-024', startedAt: '2026-09-24T04:45:00.000Z', startedBy: 'US-0011', stagedIds: ['a', 'b', 'c'],
      steps: [
        { packageInstanceId: 'a', outcome: 'loaded' as const, at: '2026-09-24T05:00:00.000Z' },
        { packageInstanceId: 'b', outcome: 'damaged' as const, at: '2026-09-24T05:01:00.000Z' },
        { packageInstanceId: 'c', outcome: 'loaded' as const, at: '2026-09-24T05:02:00.000Z' },
      ],
    },
  }
  const revisions = [{ id: 'REV-024', result: { placements: Array.from({ length: 280 }) } }] as never
  expect(warehouseProgress(trip, revisions)).toStrictEqual({ loaded: 2, total: 280, startedAt: '2026-09-24T04:45:00.000Z', startedBy: 'US-0011' })
  expect(warehouseProgress({}, revisions)).toBeNull()
})

test('an unapproved revision points to the approved one the warehouse reads; the approved one itself does not', () => {
  const revisions = [{ id: 'REV-001' }, { id: 'REV-002', approvedAt: '2026-09-24T02:00:00.000Z' }, { id: 'REV-003' }]
  expect(approvedElsewhere('REV-001', revisions)?.id).toBe('REV-002')
  expect(approvedElsewhere('REV-003', revisions)?.id).toBe('REV-002')
  expect(approvedElsewhere('REV-002', revisions)).toBeNull()
  expect(approvedElsewhere('REV-001', [{ id: 'REV-001' }])).toBeNull()
})
