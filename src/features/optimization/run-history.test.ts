import { expect, test } from 'vitest'
import { createMockDb, type MockDb } from '@/lib/mock-db'
import { buildRunHistory } from './run-history'

/** Lịch sử lần chạy (LM-104) ghép từ kho seed: lần hỏng, lần ra REV-001 đã duyệt, phương án mới nhất còn chờ duyệt. */

async function historyOf(db: MockDb, tripId: string) {
  const [trip, runs, revisions, users] = await Promise.all([
    db.getTrip(tripId), db.listOptimizationRuns(tripId), db.listRevisions(tripId), db.listUsers(),
  ])
  return buildRunHistory({ trip, runs, revisions, userNames: new Map(users.map((user) => [user.id, user.fullName])) })
}

test('the main trip lists its runs newest first: REV-001 approved, the failed run without settings from a revision', async () => {
  const rows = await historyOf(createMockDb(), 'TRIP-2026-0914')
  expect(rows.map(({ id, status, approval, timeLimitSeconds, runnerName }) => ({ id, status, approval, timeLimitSeconds, runnerName }))).toStrictEqual([
    { id: 'RUN-002', status: 'COMPLETED', approval: 'approved', timeLimitSeconds: 30, runnerName: 'Nguyễn Thanh Tùng' },
    { id: 'RUN-001', status: 'FAILED', approval: null, timeLimitSeconds: null, runnerName: 'Nguyễn Thanh Tùng' },
  ])
  expect(rows[1]).toMatchObject({ randomSeed: null, payloadUtilizationPercent: null, failureCode: 'SERVICE_UNAVAILABLE' })
})

test('only the newest plan of a planning trip awaits approval; approving it, a newer run or a trip edit takes that away', async () => {
  const db = createMockDb()
  const [first] = await historyOf(db, 'TRIP-012')
  expect(first?.approval).toBe('pending')
  const source = await db.getRevision(first?.revisionId ?? '')

  // Chạy lại: bản mới nhất chờ duyệt, bản cũ không còn là bản chờ (chưa từng duyệt nên để trống)
  await db.authenticate('dieuphoi@loadmaster.vn', 'loadmaster')
  await db.addRevision({ tripId: 'TRIP-012', request: source.request, result: source.result, run: { objective: 'AXLE_BALANCE', algorithm: 'EP_DBLF' } })
  const rerun = await historyOf(db, 'TRIP-012')
  expect(rerun.map((row) => row.approval)).toStrictEqual(['pending', null])
  expect(rerun[0]).toMatchObject({ objective: 'AXLE_BALANCE', runnerName: 'Nguyễn Thanh Tùng' })

  // Duyệt tạo revision mới nằm sau: lần chạy của bản nguồn là "đã duyệt", chuyến không còn bản chờ
  await db.approveRevision(rerun[0]?.revisionId ?? '', [])
  expect((await historyOf(db, 'TRIP-012')).map((row) => row.approval)).toStrictEqual(['approved', null])
})

test('a plan made stale by a trip edit no longer awaits approval', async () => {
  const db = createMockDb()
  const trip = await db.getTrip('TRIP-012')
  await db.updateTrip('TRIP-012', { packages: trip.packages.map((pkg, index) => (index === 0 ? { ...pkg, quantity: pkg.quantity + 1 } : pkg)) })
  expect((await historyOf(db, 'TRIP-012')).map((row) => row.approval)).toStrictEqual([null])
})
