import { expect, test } from 'vitest'
import { createMockDb, type MockDb } from '@/lib/mock-db'
import { bestCandidates, candidateCards, type CandidateCardModel } from './candidate-comparison'

/** Seam: thẻ so sánh dựng từ lần chạy và revision của kho seed (ngày neo 14/09/2026). */
async function cardsOf(db: MockDb, tripId: string, runId: string) {
  const [trip, runs, revisions] = await Promise.all([db.getTrip(tripId), db.listOptimizationRuns(tripId), db.listRevisions(tripId)])
  const run = runs.find((item) => item.id === runId)
  if (run === undefined) throw new Error(`Không có lần chạy ${runId}`)
  return candidateCards(trip, run, revisions)
}

const round2 = (value: number | undefined) => (value === undefined ? undefined : Math.round(value * 100) / 100)

test('the run of the sample trip gives cards A, B, C with the metrics of each revision and the axle loads against the limits of the truck', async () => {
  const cards = await cardsOf(createMockDb(), 'TRIP-2026-0914', 'RUN-002')
  expect(cards.map((card) => ({
    id: card.id, label: card.label, objective: card.objective, placed: card.placedCount, unplaced: card.unplacedCount,
    rehandling: card.rehandlingCount, volume: round2(card.volumeUtilizationPercent), payload: round2(card.payloadUtilizationPercent),
    mock: card.isMockResult, stale: card.stale, approvedAs: card.approvedAs,
  }))).toStrictEqual([
    { id: 'REV-001-A', label: 'A', objective: 'MAX_VOLUME', placed: 132, unplaced: 0, rehandling: 43, volume: 40.76, payload: 61.52, mock: true, stale: false, approvedAs: [] },
    { id: 'REV-001-B', label: 'B', objective: 'AXLE_BALANCE', placed: 132, unplaced: 0, rehandling: 18, volume: 40.76, payload: 61.52, mock: true, stale: false, approvedAs: [] },
    // the seed approved the least-rehandling plan
    { id: 'REV-001', label: 'C', objective: 'MIN_REHANDLING', placed: 132, unplaced: 0, rehandling: 0, volume: 40.76, payload: 61.52, mock: true, stale: false, approvedAs: ['REV-002'] },
  ])
  // Hyundai HD210 của seed: trục trước giới hạn 6.500 kg, trục sau 10.000 kg
  expect(cards.map(({ axles }) => (axles.status === 'computed'
    ? [axles.front.loadKg, axles.front.limitKg, round2(axles.front.percent), axles.rear.loadKg, axles.rear.limitKg, round2(axles.rear.percent), round2(axles.gapPercent)]
    : axles.reason))).toStrictEqual([
    [5326.12, 6500, 81.94, 6217.88, 10_000, 62.18, 19.76],
    [4574.61, 6500, 70.38, 6969.39, 10_000, 69.69, 0.68],
    [4663.27, 6500, 71.74, 6880.73, 10_000, 68.81, 2.94],
  ])
})

test('best values of the sample run: B balances the axles, C rehandles nothing; equal volume and unplaced counts are not marked', async () => {
  const best = bestCandidates(await cardsOf(createMockDb(), 'TRIP-2026-0914', 'RUN-002'))
  expect(Object.fromEntries(Object.entries(best).map(([metric, ids]) => [metric, [...ids]]))).toStrictEqual({
    axleGap: ['REV-001-B'],
    rehandling: ['REV-001'],
  })
})

/** Thẻ dựng tay: chỉ các trường `bestCandidates` đọc. */
function card(id: string, values: { volume: number; unplaced: number; gap?: number; rehandling?: number }): CandidateCardModel {
  const gauge = { loadKg: 0 }
  return {
    id, volumeUtilizationPercent: values.volume, unplacedCount: values.unplaced,
    ...(values.rehandling === undefined ? {} : { rehandlingCount: values.rehandling }),
    axles: values.gap === undefined ? { status: 'unavailable', reason: 'NO_AXLES' } : { status: 'computed', front: gauge, rear: gauge, gapPercent: values.gap },
  } as CandidateCardModel
}

test('ties share the mark; a metric one plan cannot give is not marked at all', () => {
  const best = bestCandidates([
    card('A', { volume: 52, unplaced: 0, gap: 4, rehandling: 7 }),
    card('B', { volume: 52, unplaced: 0, gap: 4, rehandling: 9 }),
    card('C', { volume: 48, unplaced: 6, rehandling: 7 }),
  ])
  expect(Object.fromEntries(Object.entries(best).map(([metric, ids]) => [metric, [...ids]]))).toStrictEqual({
    volume: ['A', 'B'],
    unplaced: ['A', 'B'],
    rehandling: ['A', 'C'],
  })
})

test('a vehicle without axles has no axle figures: the card says why', async () => {
  // TRIP-013 chạy trên "Truck 6m" của Spec — xe mẫu duy nhất không khai trục
  const db = createMockDb()
  const [run] = await db.listOptimizationRuns('TRIP-013')
  const cards = await cardsOf(db, 'TRIP-013', run?.id ?? '')
  expect(cards.map(({ axles }) => axles)).toStrictEqual(Array.from({ length: 3 }, () => ({ status: 'unavailable', reason: 'NO_AXLES' })))
  expect(bestCandidates(cards).axleGap).toBeUndefined()
  // chuyến đã sửa kiện sau khi duyệt: cả ba phương án lỗi thời
  expect(cards.map(({ stale }) => stale)).toStrictEqual([true, true, true])
})

test('a run whose revisions are gone, or a failed run, gives no cards', async () => {
  const db = createMockDb()
  const trip = await db.getTrip('TRIP-2026-0914')
  expect(candidateCards(trip, { plans: [{ objective: 'MAX_VOLUME', revisionId: 'REV-404', jobId: 'x', placedCount: 0, unplacedCount: 0, volumeUtilizationPercent: 0 }] }, [])).toStrictEqual([])
  expect(candidateCards(trip, {}, await db.listRevisions(trip.id))).toStrictEqual([])
})
