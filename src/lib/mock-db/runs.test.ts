import { expect, test } from 'vitest'
import { createMockDb } from '@/lib/mock-db'
import { optimizedTwoCartonTrip, twoCartonRequest, twoCartonResult } from '@/test/mock-db-samples'

/** Lịch sử lần chạy tối ưu của chuyến (LM-104): mục tiêu, thuật toán, lần chạy xong kèm revision và lần chạy không ra kết quả. */

test('optimization run history: the main trip keeps a failed run and the run behind REV-001; new runs are appended', async () => {
  const db = createMockDb()
  const runs = await db.listOptimizationRuns('TRIP-2026-0914')
  expect(runs.map(({ id, status, objective, algorithm, revisionId, failureCode }) => ({ id, status, objective, algorithm, revisionId, failureCode }))).toStrictEqual([
    { id: 'RUN-001', status: 'FAILED', objective: 'AXLE_BALANCE', algorithm: 'GENETIC_ALGORITHM', revisionId: undefined, failureCode: 'SERVICE_UNAVAILABLE' },
    { id: 'RUN-002', status: 'COMPLETED', objective: 'MAX_VOLUME', algorithm: 'EP_DBLF', revisionId: 'REV-001', failureCode: undefined },
  ])
  const failed = await db.recordFailedRun('TRIP-2026-0914', { objective: 'MAX_VOLUME', algorithm: 'EP_DBLF', failureCode: 'REQUEST_REJECTED' })
  expect(failed).toMatchObject({ status: 'FAILED', failureCode: 'REQUEST_REJECTED' })
  expect((await db.listEvents())[0]).toMatchObject({ action: 'optimization.failed', params: { reasonCode: 'REQUEST_REJECTED' } })

  const { trip, revision } = await optimizedTwoCartonTrip(db)
  const [run] = await db.listOptimizationRuns(trip.id)
  expect(run).toMatchObject({ status: 'COMPLETED', revisionId: revision.id, jobId: twoCartonResult().jobId, placedCount: twoCartonResult().metrics.placedCount })
  expect(twoCartonRequest().packages).toHaveLength(revision.request.packages.length)
})

test('a run is recorded for the signed-in user, and only for a trip that exists', async () => {
  const db = createMockDb()
  await db.authenticate('dieuphoi@loadmaster.vn', 'loadmaster')
  expect(await db.recordFailedRun('TRIP-012', { objective: 'AXLE_BALANCE', algorithm: 'EP_DBLF', failureCode: 'SERVICE_UNAVAILABLE' }))
    .toMatchObject({ tripId: 'TRIP-012', by: 'US-0001', objective: 'AXLE_BALANCE', algorithm: 'EP_DBLF' })
  await expect(db.listOptimizationRuns('TRIP-404')).rejects.toMatchObject({ code: 'NOT_FOUND', params: { collection: 'trips', id: 'TRIP-404' } })
  await expect(db.recordFailedRun('TRIP-404', { objective: 'MAX_VOLUME', algorithm: 'EP_DBLF', failureCode: 'REQUEST_REJECTED' }))
    .rejects.toMatchObject({ code: 'NOT_FOUND' })
})
