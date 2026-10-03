import { expect, test } from 'vitest'
import { SPEC_CARTON_A_PLACEMENT } from '@/domain/fixtures/spec-samples'
import { createMockDb, requirementStatus, tripManualSubStatus, tripStatus, tripSubStatus, type MockDb } from '@/lib/mock-db'
import { twoCartonRequest, twoCartonResult, twoCartonTrip } from '@/test/mock-db-samples'
import { stageAll } from '@/test/trip-flow'

/**
 * Soạn hàng, báo thiếu, kiện hỏng lúc xếp (FE-6-02, FE-6-05). Chuyến `TRIP-015` chở yêu cầu `REQ-007` gồm hai thùng 120 × 60 × 45 cm:
 * `PK-0089` (mã của bên gửi `KH-101`, instance `PKG-001-01`, xếp trước) và `PK-0090` (`KH-102`, `PKG-002-01`). Bản `stacked` đặt thùng
 * thứ hai lên trên thùng thứ nhất. Người: điều phối `US-0001`, kho `US-0003` (seed-users.ts).
 */
const NOW = '2026-09-14T03:00:00.000Z'
const TRIP = 'TRIP-015'
const CARTON = { lengthCm: 120, widthCm: 60, heightCm: 45, weightKg: 30, handlingClass: 'STANDARD' as const, destination: '203 Lê Văn Sỹ, P. 13, Q.3' }

async function plan(db: MockDb, stacked: boolean) {
  const trip = await db.getTrip(TRIP)
  const ids = (await db.listTripLabels(TRIP)).map((label) => label.packageInstanceId)
  const base = twoCartonResult()
  const placements = ids.map((packageInstanceId, index) => stacked && index === 1
    ? { ...SPEC_CARTON_A_PLACEMENT, packageInstanceId, xCm: 120, yCm: 0, zCm: 45, loadingOrder: 2, unloadingOrder: 1 }
    : { ...SPEC_CARTON_A_PLACEMENT, packageInstanceId, xCm: 120 + index * 120, yCm: 0, zCm: 0, loadingOrder: index + 1, unloadingOrder: ids.length - index })
  const revision = await db.addRevision({ tripId: TRIP, request: { ...twoCartonRequest(), packages: trip.packages }, result: { ...base, placements } })
  return db.approveRevision(revision.id, [])
}

/** Chuyến đã duyệt, kho vừa bắt đầu (bước Soạn hàng), phiên của nhân viên kho. */
async function staging({ stacked = false } = {}) {
  const db = createMockDb({ now: () => new Date(NOW) })
  db.restoreSession('US-0001')
  const first = await db.createPackage({ ...CARTON, packageCode: 'KH-101' })
  const second = await db.createPackage({ ...CARTON, packageCode: 'KH-102' })
  const requirement = await db.createDeliveryRequirement({
    destinationName: 'Nhà hàng Hương Việt', address: '203 Lê Văn Sỹ, P. 13, Q.3', lat: 10.7869, lng: 106.6803, deadline: '2026-09-16T10:00:00.000Z',
    priority: 'NORMAL', packageIds: [first.id, second.id],
  })
  const { id } = await db.createTrip({ ...twoCartonTrip(), packages: [], stops: [] })
  await db.assignDeliveryRequirement(requirement.id, id)
  // Tối ưu tuyến: chuyến Đã lập kế hoạch trước khi có phương án
  await db.optimizeTripRoute(id)
  await plan(db, stacked)
  db.restoreSession('US-0003')
  await db.startLoading(id)
  return { db, first, second, requirementId: requirement.id }
}

const statusOf = async (db: MockDb, ...ids: string[]) => Promise.all(ids.map(async (id) => (await db.getPackage(id)).status))
const subOf = async (db: MockDb) => tripSubStatus(await db.getTrip(TRIP), await db.listRevisions(TRIP))

test('fixture: the new packages, requirement and trip take the next ids of the seed', async () => {
  const { first, second, requirementId } = await staging()
  expect([first.id, second.id, requirementId]).toStrictEqual(['PK-0089', 'PK-0090', 'REQ-007'])
})

test('staging: packages are verified into the staging area in any order; a re-scan only reports it; a foreign code writes nothing', async () => {
  const { db, first, second } = await staging()
  expect((await db.getTrip(TRIP)).loading).toStrictEqual({ revisionId: 'REV-029', startedAt: NOW, startedBy: 'US-0003', stagedIds: [], steps: [] })
  expect(await subOf(db)).toStrictEqual({ kind: 'staging', recorded: 0, total: 2 })
  // Chưa soạn đủ thì bước xếp chưa mở
  await expect(db.confirmLoadingByQr(TRIP, first.qrToken)).rejects.toMatchObject({ code: 'STAGING_INCOMPLETE', params: { tripId: TRIP, remaining: 2 } })
  await expect(db.completeLoading(TRIP)).rejects.toMatchObject({ code: 'LOADING_INCOMPLETE', params: { remaining: 2 } })

  // Kiện xếp sau được soạn trước: soạn không cần thứ tự
  const staged = await db.confirmStagingByQr(TRIP, second.qrToken)
  expect([staged.packageInstanceId, staged.alreadyStaged, staged.trip.loading?.stagedIds]).toStrictEqual(['PKG-002-01', false, ['PKG-002-01']])
  expect(staged.trip.verifications).toStrictEqual([{ id: 'VF-001', context: 'STAGING', packageInstanceId: 'PKG-002-01', method: 'QR', at: NOW, by: 'US-0003' }])
  expect(await statusOf(db, first.id, second.id)).toStrictEqual(['ASSIGNED', 'STAGED'])
  expect(await subOf(db)).toStrictEqual({ kind: 'staging', recorded: 1, total: 2 })

  const again = await db.confirmStagingByQr(TRIP, second.qrToken)
  expect([again.alreadyStaged, again.trip.loading?.stagedIds, again.trip.verifications?.length]).toStrictEqual([true, ['PKG-002-01'], 1])

  // Mã lạ, và mã QR của một kiện có thật nhưng không thuộc chuyến
  const foreign = await db.getPackage('PK-0023')
  await expect(db.confirmStagingByQr(TRIP, 'LM-0000-0000-0000')).rejects.toMatchObject({ code: 'PACKAGE_NOT_IN_TRIP' })
  await expect(db.confirmStagingByQr(TRIP, foreign.qrToken)).rejects.toMatchObject({ code: 'PACKAGE_NOT_IN_TRIP', params: { tripId: TRIP } })
  expect((await db.getTrip(TRIP)).loading?.stagedIds).toStrictEqual(['PKG-002-01'])

  // Gõ mã của bên gửi cũng soạn được; soạn đủ thì sang bước xếp
  await db.confirmStagingByQr(TRIP, ' kh-101 ', 'CODE')
  expect(await subOf(db)).toStrictEqual({ kind: 'loading', recorded: 0, total: 2 })
  expect((await db.confirmLoadingByQr(TRIP, first.qrToken)).packageInstanceId).toBe('PKG-001-01')
})

test('staging: a manual confirmation stages the package only once the dispatcher approves; rejected, the package is staged again', async () => {
  const { db, first, second } = await staging()
  await db.confirmStagingByQr(TRIP, second.qrToken)
  await expect(db.confirmStagingManually(TRIP, { packageInstanceId: 'PKG-002-01', reason: 'LABEL_DAMAGED' })).rejects.toMatchObject({ code: 'PACKAGE_ALREADY_STAGED' })
  const { trip } = await db.confirmStagingManually(TRIP, { packageInstanceId: 'PKG-001-01', reason: 'LABEL_DAMAGED' })
  expect(trip.loading?.stagedIds).toStrictEqual(['PKG-002-01', 'PKG-001-01'])
  expect(trip.verifications?.[1]).toStrictEqual({
    id: 'VF-002', context: 'STAGING', packageInstanceId: 'PKG-001-01', method: 'MANUAL', at: NOW, by: 'US-0003', manual: { status: 'MANUAL_PENDING', reason: 'LABEL_DAMAGED' },
  })
  // Kho làm tiếp được, nhưng kiện chưa là "đã soạn" và chưa xong xếp được
  expect(await statusOf(db, first.id)).toStrictEqual(['ASSIGNED'])
  expect(tripManualSubStatus(trip)).toStrictEqual({ kind: 'manualPending', count: 1 })
  await db.confirmLoadingByQr(TRIP, first.qrToken)
  await db.confirmLoadingByQr(TRIP, second.qrToken)
  await expect(db.completeLoading(TRIP)).rejects.toMatchObject({ code: 'MANUAL_CONFIRM_PENDING', params: { count: 1 } })

  db.restoreSession('US-0001')
  const rejected = await db.rejectManualConfirmation(TRIP, 'VF-002', 'Chưa thấy kiện ở khu chờ')
  // Kiện rời danh sách đã soạn và mất kết quả xếp: chuyến quay lại bước soạn cho đúng kiện đó
  expect([rejected.loading?.stagedIds, rejected.loading?.steps.map((step) => step.packageInstanceId)]).toStrictEqual([['PKG-002-01'], ['PKG-002-01']])
  expect(await subOf(db)).toStrictEqual({ kind: 'staging', recorded: 1, total: 2 })

  db.restoreSession('US-0003')
  await db.confirmStagingManually(TRIP, { packageInstanceId: 'PKG-001-01', reason: 'QR_UNREADABLE' })
  db.restoreSession('US-0001')
  await db.approveManualConfirmation(TRIP, 'VF-005')
  expect(await statusOf(db, first.id)).toStrictEqual(['STAGED'])
  db.restoreSession('US-0003')
  await db.confirmLoadingByQr(TRIP, first.qrToken)
  expect((await db.completeLoading(TRIP)).phase).toBe('loaded')
  expect(await statusOf(db, first.id, second.id)).toStrictEqual(['LOADED', 'LOADED'])
})

test('shortage: the warehouse reports a package it cannot find; "keep searching" closes the report and the package can be staged', async () => {
  const { db, first, second } = await staging()
  await db.confirmStagingByQr(TRIP, second.qrToken)
  await expect(db.reportStagingShortage(TRIP, 'PKG-002-01')).rejects.toMatchObject({ code: 'PACKAGE_ALREADY_STAGED', params: { packageInstanceId: 'PKG-002-01' } })
  await expect(db.reportStagingShortage(TRIP, 'PKG-404-01')).rejects.toMatchObject({ code: 'INSTANCE_NOT_IN_PLAN' })
  const reported = await db.reportStagingShortage(TRIP, 'PKG-001-01')
  expect(reported.loading?.shortages).toStrictEqual([{ packageInstanceId: 'PKG-001-01', at: NOW, by: 'US-0003' }])
  expect(await subOf(db)).toStrictEqual({ kind: 'shortage', count: 1 })
  expect((await db.listEvents({ targetId: TRIP }))[0]).toMatchObject({
    action: 'loading.shortageReported', actorId: 'US-0003', params: { packageInstanceId: 'PKG-001-01', packageCode: 'KH-101' },
  })
  // Báo lại không ghi thêm
  expect((await db.reportStagingShortage(TRIP, 'PKG-001-01')).loading?.shortages).toHaveLength(1)

  // Quyết là việc của điều phối viên
  await expect(db.resolveStagingShortage(TRIP, 'PKG-001-01', 'DROP')).rejects.toMatchObject({ code: 'ROLE_NOT_ALLOWED', params: { role: 'warehouse' } })
  db.restoreSession('US-0001')
  await expect(db.resolveStagingShortage(TRIP, 'PKG-002-01', 'DROP')).rejects.toMatchObject({ code: 'SHORTAGE_NOT_OPEN', params: { packageInstanceId: 'PKG-002-01' } })
  const kept = await db.resolveStagingShortage(TRIP, 'PKG-001-01', 'KEEP_SEARCHING')
  expect([kept.phase, kept.loading?.shortages]).toStrictEqual(['loading', undefined])
  expect((await db.listEvents({ targetId: TRIP }))[0]).toMatchObject({ action: 'loading.shortageKept', actorId: 'US-0001', params: { packageInstanceId: 'PKG-001-01', requestedBy: 'US-0003' } })
  expect(await subOf(db)).toStrictEqual({ kind: 'staging', recorded: 1, total: 2 })

  // Kiện đang bị báo thiếu mà quét thấy: báo thiếu tự đóng
  db.restoreSession('US-0003')
  await db.reportStagingShortage(TRIP, 'PKG-001-01')
  const found = await db.confirmStagingByQr(TRIP, first.qrToken)
  expect([found.trip.loading?.shortages, found.trip.loading?.stagedIds]).toStrictEqual([undefined, ['PKG-002-01', 'PKG-001-01']])
})

test('shortage: dropping the package flags it, marks its requirement partial and sends the trip back to planned with a stale plan; staged packages stay staged', async () => {
  const { db, first, second, requirementId } = await staging()
  await db.confirmStagingByQr(TRIP, second.qrToken)
  await db.reportStagingShortage(TRIP, 'PKG-001-01')
  db.restoreSession('US-0001')
  const dropped = await db.resolveStagingShortage(TRIP, 'PKG-001-01', 'DROP')
  expect([dropped.phase, tripStatus(dropped), dropped.loading, dropped.verifications, dropped.inputVersion, dropped.replan]).toStrictEqual([
    'planning', 'PLANNED', undefined, undefined, 3, { reason: 'SHORTAGE', at: NOW, unload: false },
  ])
  // Dòng của kiện bị bỏ mất hẳn; điểm giao còn kiện kia nên ở lại
  expect([dropped.packages.map((line) => [line.id, line.quantity]), dropped.stops.length]).toStrictEqual([[['PKG-002', 1]], 1])
  expect(await subOf(db)).toStrictEqual({ kind: 'stale' })
  expect(await db.getPackage(first.id)).toMatchObject({ status: 'IMPORTED', flags: ['NOT_FOUND'], requirementId })
  expect(await statusOf(db, second.id)).toStrictEqual(['STAGED'])
  const requirement = await db.getDeliveryRequirement(requirementId)
  expect([requirement.status, requirement.tripId, requirementStatus(requirement, [await db.getPackage(first.id), await db.getPackage(second.id)])]).toStrictEqual(['ASSIGNED', TRIP, 'PARTIAL'])
  expect((await db.listEvents({ targetId: TRIP }))[0]).toMatchObject({
    action: 'loading.shortageDropped', actorId: 'US-0001', params: { packageInstanceId: 'PKG-001-01', packageCode: 'KH-101', requirementId, requestedBy: 'US-0003' },
  })
  // Phương án lỗi thời: kho chưa bắt đầu lại được
  db.restoreSession('US-0003')
  await expect(db.startLoading(TRIP)).rejects.toMatchObject({ code: 'REVISION_STALE' })

  // Điều phối viên tối ưu lại và duyệt; kho quay lại: kiện đã soạn vẫn tính là đã soạn, sang thẳng bước xếp
  db.restoreSession('US-0001')
  await plan(db, false)
  db.restoreSession('US-0003')
  const restarted = await db.startLoading(TRIP)
  expect([restarted.loading?.stagedIds, restarted.replan]).toStrictEqual([['PKG-002-01'], undefined])
  expect(await subOf(db)).toStrictEqual({ kind: 'loading', recorded: 0, total: 1 })
  await db.confirmLoadingByQr(TRIP, second.qrToken)
  expect((await db.completeLoading(TRIP)).phase).toBe('loaded')
})

test('damaged while loading: with nothing resting on it in the plan the package is left out, flagged, and loading goes on', async () => {
  const { db, first, second, requirementId } = await staging()
  // Chưa soạn đủ thì chưa ở bước xếp
  await expect(db.reportDamagedPackage(TRIP, 'PKG-001-01')).rejects.toMatchObject({ code: 'STAGING_INCOMPLETE', params: { remaining: 2 } })
  await stageAll(db, TRIP)
  await expect(db.reportDamagedPackage(TRIP, 'PKG-002-01')).rejects.toMatchObject({ code: 'WRONG_PACKAGE_SCANNED', params: { expected: 'PKG-001-01', scanned: 'PKG-002-01' } })
  await db.confirmLoadingByQr(TRIP, first.qrToken)
  const trip = await db.reportDamagedPackage(TRIP, 'PKG-002-01')
  expect([trip.phase, trip.loading?.steps.map((step) => [step.packageInstanceId, step.outcome])]).toStrictEqual(['loading', [['PKG-001-01', 'loaded'], ['PKG-002-01', 'damaged']]])
  expect(await db.getPackage(second.id)).toMatchObject({ status: 'IMPORTED', flags: ['DAMAGED'], requirementId })
  expect((await db.listEvents({ targetId: TRIP }))[0]).toMatchObject({ action: 'loading.damaged', actorId: 'US-0003', params: { packageInstanceId: 'PKG-002-01', packageCode: 'KH-102', requirementId } })
  const loaded = await db.completeLoading(TRIP)
  expect([loaded.phase, tripStatus(loaded), await subOf(db)]).toStrictEqual(['loaded', 'LOADING', { kind: 'loaded' }])
  expect((await db.listEvents({ targetId: TRIP }))[0]).toMatchObject({ action: 'loading.completed', params: { loaded: 1, damaged: 1 } })
  expect(await statusOf(db, first.id)).toStrictEqual(['LOADED'])
  // Kiện hỏng không có trên xe: tài xế không dỡ được nó
  db.restoreSession('US-0001')
  await db.updateTrip(TRIP, { driverId: 'US-0004' })
  db.restoreSession('US-0004')
  await db.startDelivery(TRIP)
  await db.arriveAtStop(TRIP, 1)
  await expect(db.confirmUnloadByQr(TRIP, 1, second.qrToken)).rejects.toMatchObject({ code: 'INSTANCE_NOT_LOADED' })
})

test('damaged while loading: with a package resting on it in the plan the trip goes back to planned; the warehouse reloads by the new plan', async () => {
  const { db, first, second } = await staging({ stacked: true })
  await stageAll(db, TRIP)
  const trip = await db.reportDamagedPackage(TRIP, 'PKG-001-01')
  expect([trip.phase, trip.loading, trip.replan, tripStatus(trip)]).toStrictEqual(['planning', undefined, { reason: 'DAMAGED', at: NOW, unload: false }, 'PLANNED'])
  expect(await db.getPackage(first.id)).toMatchObject({ status: 'IMPORTED', flags: ['DAMAGED'] })
  expect(await statusOf(db, second.id)).toStrictEqual(['STAGED'])
  expect((await db.listEvents({ targetId: TRIP }))[0]).toMatchObject({ action: 'loading.damaged', params: { packageInstanceId: 'PKG-001-01', supporting: 1 } })
  expect(await subOf(db)).toStrictEqual({ kind: 'stale' })
})
