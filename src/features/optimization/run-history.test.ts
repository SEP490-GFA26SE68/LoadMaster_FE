import { expect, test } from 'vitest'
import { createMockDb, type MockDb } from '@/lib/mock-db'
import { buildRunHistory } from './run-history'

/** Lịch sử lần chạy (luồng 3 Review 1, LM-104) ghép từ kho seed: lần hỏng, lần ra REV-001 đã duyệt, bản chờ duyệt, quyết định. */

async function historyOf(db: MockDb, tripId: string) {
  const [runs, revisions, decisions, queue, users] = await Promise.all([
    db.listOptimizationRuns(tripId), db.listRevisions(tripId), db.listReviewDecisions(tripId), db.listReviewQueue(), db.listUsers(),
  ])
  return buildRunHistory({
    runs, revisions, decisions,
    pendingRevisionIds: new Set(queue.map((item) => item.revisionId)),
    userNames: new Map(users.map((user) => [user.id, user.fullName])),
    vehicleNames: new Map(),
  })
}

test('the main trip lists its runs newest first: REV-001 approved, the failed run without settings from a revision', async () => {
  const { rows, openDecision } = await historyOf(createMockDb(), 'TRIP-2026-0914')
  expect(rows.map(({ id, status, review, timeLimitSeconds, runnerName }) => ({ id, status, review, timeLimitSeconds, runnerName }))).toStrictEqual([
    { id: 'RUN-002', status: 'COMPLETED', review: { kind: 'approved' }, timeLimitSeconds: 30, runnerName: 'Nguyễn Thanh Tùng' },
    { id: 'RUN-001', status: 'FAILED', review: null, timeLimitSeconds: null, runnerName: 'Nguyễn Thanh Tùng' },
  ])
  expect(rows[1]).toMatchObject({ randomSeed: null, payloadUtilizationPercent: null, failureCode: 'SERVICE_UNAVAILABLE' })
  expect(openDecision).toBeNull()
})

test('a plan in the queue is pending; the manager sending it back makes the decision open until the next run', async () => {
  const db = createMockDb()
  const before = await historyOf(db, 'TRIP-012')
  expect(before.rows[0]?.review).toStrictEqual({ kind: 'pending' })

  await db.authenticate('quanly@loadmaster.vn', 'loadmaster')
  await db.requestReoptimization(before.rows[0]?.revisionId ?? '', 'Thử cân bằng tải trục')
  const after = await historyOf(db, 'TRIP-012')
  expect(after.rows[0]?.review).toStrictEqual({ kind: 'decided', decision: 'reoptimize_requested' })
  expect(after.openDecision).toMatchObject({ kind: 'reoptimize_requested', reason: 'Thử cân bằng tải trục', byName: 'Trần Thị Mai' })

  const revision = await db.getRevision(before.rows[0]?.revisionId ?? '')
  await db.addRevision({ tripId: 'TRIP-012', request: revision.request, result: revision.result, run: { objective: 'AXLE_BALANCE', algorithm: 'EP_DBLF' } })
  const rerun = await historyOf(db, 'TRIP-012')
  expect(rerun.openDecision).toBeNull()
  expect(rerun.rows[0]).toMatchObject({ objective: 'AXLE_BALANCE', review: { kind: 'pending' }, runnerName: 'Trần Thị Mai' })
})
