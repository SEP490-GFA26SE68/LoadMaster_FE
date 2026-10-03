import { expect, test } from 'vitest'
import { createMockDb } from '@/lib/mock-db'
import { optimizedTwoCartonTrip, twoCartonRequest, twoCartonResult } from '@/test/mock-db-samples'
import { bestValues, defaultRevisionId, revisionCards } from './revision-comparison'

async function threeRevisions() {
  const db = createMockDb()
  const { trip, revision: first } = await optimizedTwoCartonTrip(db)
  // Lần chạy thứ hai: chỉ xếp được một thùng, chạy lâu hơn. Số dựng tay: 1 × 120 × 60 × 45 = 324.000 cm³ / 36.000.000 = 0,9%.
  const partial = twoCartonResult()
  await db.addRevision({
    tripId: trip.id,
    request: { ...twoCartonRequest(), settings: { ...twoCartonRequest().settings, randomSeed: 7, enforceLifo: false } },
    result: {
      ...partial,
      jobId: 'MOCK-JOB-002',
      placements: partial.placements.slice(0, 1),
      unplacedPackages: [{ packageInstanceId: 'PKG-002-01', reasonCode: 'NO_SPACE', message: 'NO_SPACE' }],
      metrics: { ...partial.metrics, volumeUtilizationPercent: 0.9, placedCount: 1, unplacedCount: 1, runtimeMs: 30 },
    },
  })
  await db.approveRevision(first.id, [])
  return { db, trip: await db.getTrip(trip.id), revisions: await db.listRevisions(trip.id) }
}

test('thẻ lấy thiết lập và metrics của revision; bản duyệt và bản nguồn phân biệt bằng mã revision', async () => {
  const { trip, revisions } = await threeRevisions()
  const [first, second, approved] = revisionCards(trip, revisions)
  if (!first || !second || !approved) throw new Error('Cần đủ ba thẻ')

  expect(first).toMatchObject({
    jobId: 'MOCK-JOB-001',
    method: 'MOCK',
    randomSeed: 42,
    enforceLifo: true,
    prioritizeLowCenterOfGravity: false,
    timeLimitSeconds: 10,
    volumeUtilizationPercent: 1.8,
    payloadUtilizationPercent: 1.2,
    placedCount: 2,
    unplacedCount: 0,
    runtimeMs: 12,
    isMockResult: true,
    latest: false,
    approved: false,
    stale: false,
    approvedAs: [approved.id],
  })
  expect(second).toMatchObject({ randomSeed: 7, enforceLifo: false, placedCount: 1, unplacedCount: 1, latest: false, approvedAs: [] })
  expect(approved).toMatchObject({ jobId: 'MOCK-JOB-001', approved: true, latest: true, sourceRevisionId: first.id })
  // kết quả lưu lẻ không phải ứng viên của lần chạy ba phương án
  expect([first.candidate, second.candidate, approved.candidate]).toStrictEqual([undefined, undefined, undefined])
  expect(approved.id).not.toBe(first.id)
  expect(defaultRevisionId([first, second, approved])).toBe(approved.id)
  expect(defaultRevisionId([first, second])).toBe(second.id)
  expect(defaultRevisionId([])).toBeUndefined()
})

test('bản của lần chạy ba phương án mang nhãn A · B · C; bản duyệt giữ nhãn của bản nguồn (FE-5b-05)', async () => {
  const db = createMockDb()
  const cards = revisionCards(await db.getTrip('TRIP-2026-0914'), await db.listRevisions('TRIP-2026-0914'))
  expect(cards.map((card) => [card.id, card.candidate, card.approved])).toStrictEqual([
    ['REV-001-A', 'A', false], ['REV-001-B', 'B', false], ['REV-001', 'C', false], ['REV-002', 'C', true],
  ])
})

test('sửa kiện sau khi tối ưu: mọi thẻ lỗi thời', async () => {
  const { db, trip } = await threeRevisions()
  const changed = await db.updateTrip(trip.id, { packages: trip.packages.map((pkg) => ({ ...pkg, weightKg: 31 })) })

  expect(revisionCards(changed, await db.listRevisions(trip.id)).map((card) => card.stale)).toEqual([true, true, true])
})

test('giá trị tốt nhất chỉ có ở chỉ số khác nhau giữa các thẻ', async () => {
  const { trip, revisions } = await threeRevisions()
  const [first, second] = revisionCards(trip, revisions)
  if (!first || !second) throw new Error('Cần đủ hai thẻ')

  expect(bestValues([first, second])).toEqual({ volumeUtilizationPercent: 1.8, placedCount: 2, unplacedCount: 0, runtimeMs: 12 })
  expect(bestValues([first, { ...first, id: 'REV-X' }])).toEqual({})
})
