import { expect, test } from 'vitest'
import { createMockDb, type MockDb } from '@/lib/mock-db'
import { runMockCandidates } from '@/services/optimization'
import { buildRunHistory } from './run-history'

/** Lịch sử lần chạy (LM-104) ghép từ kho seed: lần hỏng, lần ra ba phương án mà REV-001 đã được duyệt, lần chạy mới nhất còn chờ duyệt. */

async function historyOf(db: MockDb, tripId: string) {
  const [trip, runs, revisions, users] = await Promise.all([
    db.getTrip(tripId), db.listOptimizationRuns(tripId), db.listRevisions(tripId), db.listUsers(),
  ])
  return buildRunHistory({ trip, runs, revisions, userNames: new Map(users.map((user) => [user.id, user.fullName])) })
}

test('the main trip lists its runs newest first: plan C (REV-001) approved, the failed run without settings from a revision', async () => {
  const rows = await historyOf(createMockDb(), 'TRIP-2026-0914')
  expect(rows.map(({ id, status, approval, timeLimitSeconds, runnerName }) => ({ id, status, approval, timeLimitSeconds, runnerName }))).toStrictEqual([
    { id: 'RUN-002', status: 'COMPLETED', approval: 'approved', timeLimitSeconds: 30, runnerName: 'Nguyễn Thanh Tùng' },
    { id: 'RUN-001', status: 'FAILED', approval: null, timeLimitSeconds: null, runnerName: 'Nguyễn Thanh Tùng' },
  ])
  expect(rows[0]?.plans.map(({ label, objective, revisionId, approved }) => [label, objective, revisionId, approved])).toStrictEqual([
    ['A', 'MAX_VOLUME', 'REV-001-A', false],
    ['B', 'AXLE_BALANCE', 'REV-001-B', false],
    ['C', 'MIN_REHANDLING', 'REV-001', true],
  ])
  expect(rows[1]).toMatchObject({ randomSeed: null, plans: [], failureCode: 'SERVICE_UNAVAILABLE' })
})

test('only the newest run of a planning trip awaits approval; approving one of its plans, a newer run or a trip edit takes that away', async () => {
  const db = createMockDb()
  const [first] = await historyOf(db, 'TRIP-012')
  expect(first?.approval).toBe('pending')
  const source = await db.getRevision(first?.plans[0]?.revisionId ?? '')

  // Chạy lại: lần chạy mới nhất chờ duyệt, lần cũ không còn là bản chờ (chưa từng duyệt nên để trống)
  await db.authenticate('dieuphoi@loadmaster.vn', 'loadmaster')
  const job = runMockCandidates(source.request, { clock: () => 0 })
  await db.saveOptimizationRun({ tripId: 'TRIP-012', request: source.request, jobId: job.jobId, plans: job.plans })
  const rerun = await historyOf(db, 'TRIP-012')
  expect(rerun.map((row) => row.approval)).toStrictEqual(['pending', null])
  expect(rerun[0]).toMatchObject({ algorithm: 'EP_DBLF', runnerName: 'Nguyễn Thanh Tùng' })
  expect(rerun[0]?.plans.map(({ label }) => label)).toStrictEqual(['A', 'B', 'C'])

  // Duyệt phương án B: tạo revision mới nằm sau — lần chạy là "đã duyệt" và nói rõ phương án nào, chuyến không còn bản chờ
  await db.approveRevision(rerun[0]?.plans[1]?.revisionId ?? '', [])
  const approved = await historyOf(db, 'TRIP-012')
  expect(approved.map((row) => row.approval)).toStrictEqual(['approved', null])
  expect(approved[0]?.plans.map((plan) => plan.approved)).toStrictEqual([false, true, false])
})

test('a plan made stale by a trip edit no longer awaits approval', async () => {
  const db = createMockDb()
  const trip = await db.getTrip('TRIP-012')
  await db.updateTrip('TRIP-012', { packages: trip.packages.map((pkg, index) => (index === 0 ? { ...pkg, quantity: pkg.quantity + 1 } : pkg)) })
  expect((await historyOf(db, 'TRIP-012')).map((row) => row.approval)).toStrictEqual([null])
})
