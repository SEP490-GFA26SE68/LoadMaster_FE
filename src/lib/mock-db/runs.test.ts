import { expect, test } from 'vitest'
import { PLAN_OBJECTIVES } from '@/domain/models'
import { createMockDb } from '@/lib/mock-db'
import { runMockCandidates } from '@/services/optimization'
import { optimizedTwoCartonTrip, twoCartonRequest, twoCartonResult } from '@/test/mock-db-samples'

/**
 * Lịch sử lần chạy tối ưu của chuyến (LM-104): thuật toán, lần chạy xong kèm các phương án ứng viên (FE-5b-05) và lần chạy không ra
 * kết quả.
 */

test('optimization run history: the main trip keeps a failed run and the run behind its three candidates; new runs are appended', async () => {
  const db = createMockDb()
  const runs = await db.listOptimizationRuns('TRIP-2026-0914')
  expect(runs.map(({ id, status, algorithm, plans, failureCode }) => ({ id, status, algorithm, plans: plans?.map((plan) => [plan.objective, plan.revisionId]), failureCode }))).toStrictEqual([
    { id: 'RUN-001', status: 'FAILED', algorithm: 'EP_DBLF', plans: undefined, failureCode: 'SERVICE_UNAVAILABLE' },
    {
      id: 'RUN-002', status: 'COMPLETED', algorithm: 'EP_DBLF', failureCode: undefined,
      plans: [['MAX_VOLUME', 'REV-001-A'], ['AXLE_BALANCE', 'REV-001-B'], ['MIN_REHANDLING', 'REV-001']],
    },
  ])
  const failed = await db.recordFailedRun('TRIP-2026-0914', { failureCode: 'REQUEST_REJECTED' })
  expect(failed).toMatchObject({ status: 'FAILED', algorithm: 'EP_DBLF', failureCode: 'REQUEST_REJECTED' })
  expect((await db.listEvents())[0]).toMatchObject({ action: 'optimization.failed', params: { algorithm: 'EP_DBLF', reasonCode: 'REQUEST_REJECTED' } })

  // Một kết quả lưu lẻ là một lần chạy một phương án
  const { trip, revision } = await optimizedTwoCartonTrip(db)
  const [run] = await db.listOptimizationRuns(trip.id)
  expect(run).toMatchObject({
    status: 'COMPLETED', jobId: twoCartonResult().jobId,
    plans: [{ objective: 'MAX_VOLUME', revisionId: revision.id, placedCount: twoCartonResult().metrics.placedCount }],
  })
  expect(revision.runId).toBe(run?.id)
  expect(twoCartonRequest().packages).toHaveLength(revision.request.packages.length)
})

test('one job saves three immutable candidate revisions A, B, C under one run, with one audit event (FE-5b-05)', async () => {
  const db = createMockDb()
  await db.authenticate('dieuphoi@loadmaster.vn', 'loadmaster')
  const trip = await db.getTrip('TRIP-012')
  const request = { vehicle: await db.getVehicle(trip.vehicleId), packages: trip.packages, settings: (await db.getRevision('REV-025')).request.settings }
  const job = runMockCandidates(request, { clock: () => 0 })
  const before = (await db.listRevisions(trip.id)).length

  const { run, revisions } = await db.saveOptimizationRun({ tripId: trip.id, request, jobId: job.jobId, plans: job.plans })
  expect(revisions.map(({ id, runId, run: settings, jobId, approvedAt }) => ({ id, runId, settings, jobId, approvedAt }))).toStrictEqual([
    { id: 'REV-028', runId: 'RUN-016', settings: { objective: 'MAX_VOLUME', algorithm: 'EP_DBLF' }, jobId: `${job.jobId}-A`, approvedAt: undefined },
    { id: 'REV-029', runId: 'RUN-016', settings: { objective: 'AXLE_BALANCE', algorithm: 'EP_DBLF' }, jobId: `${job.jobId}-B`, approvedAt: undefined },
    { id: 'REV-030', runId: 'RUN-016', settings: { objective: 'MIN_REHANDLING', algorithm: 'EP_DBLF' }, jobId: `${job.jobId}-C`, approvedAt: undefined },
  ])
  expect(run).toMatchObject({ id: 'RUN-016', tripId: trip.id, status: 'COMPLETED', algorithm: 'EP_DBLF', by: 'US-0001', jobId: job.jobId })
  expect(run.plans?.map(({ objective, revisionId }) => [objective, revisionId])).toStrictEqual(PLAN_OBJECTIVES.map((objective, index) => [objective, `REV-0${28 + index}`]))
  expect((await db.listRevisions(trip.id)).length).toBe(before + 3)
  expect((await db.listOptimizationRuns(trip.id)).at(-1)).toStrictEqual(run)
  expect((await db.listEvents({ targetId: trip.id }))[0]).toMatchObject({
    action: 'optimization.saved', actorId: 'US-0001', params: { runId: 'RUN-016', revisionId: 'REV-028, REV-029, REV-030' },
  })

  // Duyệt một ứng viên: bản đã duyệt giữ lần chạy và mục tiêu của bản nguồn
  const approved = await db.approveRevision('REV-029', [])
  expect(approved).toMatchObject({ id: 'REV-031', runId: 'RUN-016', run: { objective: 'AXLE_BALANCE' }, sourceRevisionId: 'REV-029' })
})

test('the load is only optimized on a Planned trip: a draft is rejected ROUTE_NOT_PLANNED, a trip at the warehouse TRIP_LOCKED; nothing is saved', async () => {
  const db = createMockDb()
  const source = await db.getRevision('REV-025')
  const job = runMockCandidates(source.request, { clock: () => 0 })
  const input = { request: source.request, jobId: job.jobId, plans: job.plans }
  const counts = async () => [(await db.listRevisions('TRIP-014')).length, (await db.listOptimizationRuns('TRIP-014')).length, (await db.listEvents()).length]
  const before = await counts()
  // TRIP-014 là chuyến nháp của seed: chưa tối ưu tuyến
  await expect(db.saveOptimizationRun({ tripId: 'TRIP-014', ...input })).rejects.toMatchObject({ code: 'ROUTE_NOT_PLANNED', params: { tripId: 'TRIP-014' } })
  await expect(db.saveOptimizationRun({ tripId: 'TRIP-011', ...input })).rejects.toMatchObject({ code: 'TRIP_LOCKED', params: { tripId: 'TRIP-011', phase: 'loading' } })
  expect(await counts()).toStrictEqual(before)
})

test('a run is recorded for the signed-in user, and only for a trip that exists', async () => {
  const db = createMockDb()
  await db.authenticate('dieuphoi@loadmaster.vn', 'loadmaster')
  expect(await db.recordFailedRun('TRIP-012', { failureCode: 'SERVICE_UNAVAILABLE' }))
    .toMatchObject({ tripId: 'TRIP-012', by: 'US-0001', algorithm: 'EP_DBLF' })
  await expect(db.listOptimizationRuns('TRIP-404')).rejects.toMatchObject({ code: 'NOT_FOUND', params: { collection: 'trips', id: 'TRIP-404' } })
  await expect(db.recordFailedRun('TRIP-404', { failureCode: 'REQUEST_REJECTED' }))
    .rejects.toMatchObject({ code: 'NOT_FOUND' })
})
