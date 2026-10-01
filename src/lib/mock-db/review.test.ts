import { expect, test } from 'vitest'
import { createMockDb } from '@/lib/mock-db'

/** Luồng 4 Review 1 (LM-104): hàng đợi chờ duyệt và quyết định của quản lý. Lịch sử lần chạy: `runs.test.ts`. */

test('the review queue holds the latest completed, fresh, unapproved plan of each planning trip', async () => {
  const db = createMockDb()
  const queue = await db.listReviewQueue()
  // Chỉ TRIP-012 "đã tối ưu": chuyến chính đã duyệt, TRIP-013 lỗi thời, TRIP-014 chưa tối ưu
  expect(queue.map((item) => item.tripId)).toStrictEqual(['TRIP-012'])
  const [item] = queue
  const revisions = await db.listRevisions('TRIP-012')
  expect(item).toMatchObject({ revisionId: revisions.at(-1)?.id, submittedBy: 'US-0001', isMockResult: true, run: { objective: 'MAX_VOLUME', algorithm: 'EP_DBLF' } })
  expect(item?.metrics.placedCount).toBe(revisions.at(-1)?.result.metrics.placedCount)
})

test('reject, request re-optimization and suggestions need a reason, drop the plan from the queue and are logged', async () => {
  const db = createMockDb()
  await db.authenticate('quanly@loadmaster.vn', 'loadmaster')
  const [item] = await db.listReviewQueue()
  const revisionId = item?.revisionId ?? ''
  await expect(db.rejectRevision(revisionId, ' ')).rejects.toMatchObject({ code: 'REASON_REQUIRED' })
  await expect(db.rejectRevision('REV-002', 'Không hợp lý')).rejects.toMatchObject({ code: 'REVISION_NOT_REVIEWABLE' })
  const decision = await db.suggestPlanChange(revisionId, { kind: 'change_vehicle', note: 'Dùng xe 7 tấn cho gọn chuyến', vehicleId: 'VEHICLE-006' })
  expect(decision).toMatchObject({ id: 'RVW-001', tripId: 'TRIP-012', kind: 'change_vehicle_suggested', vehicleId: 'VEHICLE-006', by: 'US-0002' })
  expect(await db.listReviewQueue()).toStrictEqual([])
  await expect(db.rejectRevision(revisionId, 'Trễ')).rejects.toMatchObject({ code: 'REVISION_NOT_REVIEWABLE' })
  expect(await db.listReviewDecisions('TRIP-012')).toStrictEqual([decision])
  expect((await db.listEvents())[0]).toMatchObject({ action: 'review.changeSuggested', target: { id: 'TRIP-012' }, params: { suggestion: 'change_vehicle_suggested' } })
})

test('a new optimization puts the trip back in the queue; approving takes it out and records who approved', async () => {
  const db = createMockDb()
  await db.authenticate('quanly@loadmaster.vn', 'loadmaster')
  const [item] = await db.listReviewQueue()
  await db.requestReoptimization(item?.revisionId ?? '', 'Tối ưu lại với mục tiêu cân bằng tải trục')
  const trip = await db.getTrip('TRIP-012')
  const rerun = await db.addRevision({ tripId: 'TRIP-012', request: { ...(await db.getRevision(item?.revisionId ?? '')).request }, result: (await db.getRevision(item?.revisionId ?? '')).result, run: { objective: 'AXLE_BALANCE', algorithm: 'GENETIC_ALGORITHM' } })
  expect(rerun.run).toStrictEqual({ objective: 'AXLE_BALANCE', algorithm: 'GENETIC_ALGORITHM' })
  expect((await db.listReviewQueue()).map((entry) => entry.revisionId)).toStrictEqual([rerun.id])
  const approved = await db.approveRevision(rerun.id, [])
  expect(approved).toMatchObject({ approvedBy: 'US-0002', run: { objective: 'AXLE_BALANCE' } })
  expect(await db.listReviewQueue()).toStrictEqual([])
  expect(trip.phase).toBe('planning')
})
