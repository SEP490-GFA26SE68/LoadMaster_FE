import { expect, test } from 'vitest'
import { SPEC_CARTON_A } from '@/domain/fixtures/spec-samples'
import { createMockDb, pendingManualConfirms, rejectedConfirms, resolveVerifyCode, tripManualSubStatus, type MockDb, type TripLabel } from '@/lib/mock-db'
import { twoCartonRequest, twoCartonResult, twoCartonTrip } from '@/test/mock-db-samples'
import { loadAll, stageAll } from '@/test/trip-flow'

/**
 * Đối chiếu kiện ba mức (FE-6-03, D-83) và duyệt xác nhận tay (FE-6-04). Chuyến hai thùng của `mock-db-samples`: `PKG-001-01` (điểm 3)
 * xếp trước, `PKG-002-01` (điểm 1) xếp sau và dỡ trước. Kho soạn cả hai thùng bằng quét (`VF-001`, `VF-002`) rồi mới xếp. Người: kho `US-0003`, điều phối `US-0001`, tài xế `US-0004` (seed-users.ts).
 */
const NOW = '2026-09-14T03:00:00.000Z'

const label = (packageInstanceId: string, qrToken: string, packageCode: string): TripLabel =>
  ({ packageInstanceId, packageId: packageInstanceId.slice(0, 7), name: 'Carton A', deliveryStop: 1, qrToken, poolPackageId: `PK-${packageInstanceId}`, packageCode })

test('a typed code matches the QR token first, then the sender code only when it is unique in the trip; a camera scan matches tokens only', () => {
  const labels = [
    label('PKG-001-01', 'LM-7K3F-9XQ2-M4TD', 'KH-778'),
    label('PKG-001-02', 'LM-2B8C-HJ4N-P6RS', 'KH-778'),
    label('PKG-002-01', 'LM-0A1B-2C3D-4E5F', 'KH-901'),
  ]
  expect(resolveVerifyCode(labels, ' lm-7k3f 9xq2-m4td ', 'CODE')).toStrictEqual({ kind: 'matched', label: labels[0] })
  expect(resolveVerifyCode(labels, '2b8chj4np6rs', 'QR')).toStrictEqual({ kind: 'matched', label: labels[1] })
  expect(resolveVerifyCode(labels, ' kh-901 ', 'CODE')).toStrictEqual({ kind: 'matched', label: labels[2] })
  expect(resolveVerifyCode(labels, 'KH-778', 'CODE')).toStrictEqual({ kind: 'ambiguous', count: 2 })
  expect(resolveVerifyCode(labels, 'KH-901', 'QR')).toStrictEqual({ kind: 'unknown' })
  expect(resolveVerifyCode(labels, 'KH-000', 'CODE')).toStrictEqual({ kind: 'unknown' })
})

const STAGED = [
  { id: 'VF-001', context: 'STAGING', packageInstanceId: 'PKG-001-01', method: 'QR', at: NOW, by: 'US-0003' },
  { id: 'VF-002', context: 'STAGING', packageInstanceId: 'PKG-002-01', method: 'QR', at: NOW, by: 'US-0003' },
]

/**
 * Chuyến hai thùng đã duyệt, gán tài xế demo; `stage` là mốc chuyến đã tới: kho đã soạn đủ và đang xếp, hoặc tài xế đã xuất phát và đã
 * đến điểm 1. Kho trả về đang ở phiên của người làm bước đó.
 */
async function twoCartons(stage: 'loading' | 'delivering') {
  const db = createMockDb({ now: () => new Date(NOW) })
  const { id } = await db.createTrip({ ...twoCartonTrip(), driverId: 'US-0004' })
  const revision = await db.addRevision({ tripId: id, request: twoCartonRequest(), result: twoCartonResult() })
  await db.approveRevision(revision.id, [])
  db.restoreSession('US-0003')
  await db.startLoading(id)
  await stageAll(db, id)
  if (stage === 'delivering') {
    await loadAll(db, id)
    await db.completeLoading(id)
    db.restoreSession('US-0004')
    await db.startDelivery(id)
    await db.arriveAtStop(id, 1)
  }
  const tokens = new Map((await db.listTripLabels(id)).map((item) => [item.packageInstanceId, item.qrToken]))
  return { db, id, token: (instanceId: string) => tokens.get(instanceId) ?? '' }
}

const stepsOf = async (db: MockDb, id: string) => (await db.getTrip(id)).loading?.steps.map((step) => [step.packageInstanceId, step.outcome, step.via])

test('every verification records how, who and when: a scan is QR, a typed sender code is CODE', async () => {
  const { db, id, token } = await twoCartons('loading')
  // Kiện thêm ngay trong chuyến mang mã của bên gửi bằng mã instance (FE-3b-07)
  expect((await db.listTripLabels(id)).map((item) => item.packageCode)).toStrictEqual(['PKG-001-01', 'PKG-002-01'])
  await expect(db.confirmLoadingByQr(id, 'PKG-001-01', 'QR')).rejects.toMatchObject({ code: 'PACKAGE_NOT_IN_TRIP' })
  await db.confirmLoadingByQr(id, token('PKG-001-01'))
  const { trip } = await db.confirmLoadingByQr(id, ' pkg-002-01 ', 'CODE')
  expect(trip.verifications).toStrictEqual([
    ...STAGED,
    { id: 'VF-003', context: 'LOADING', packageInstanceId: 'PKG-001-01', method: 'QR', at: NOW, by: 'US-0003' },
    { id: 'VF-004', context: 'LOADING', packageInstanceId: 'PKG-002-01', method: 'CODE', at: NOW, by: 'US-0003' },
  ])
  expect(await stepsOf(db, id)).toStrictEqual([['PKG-001-01', 'loaded', 'qr'], ['PKG-002-01', 'loaded', 'qr']])
  expect((await db.completeLoading(id)).phase).toBe('loaded')
})

test('a sender code shared by two packages of the trip is refused: the QR code must be typed', async () => {
  const db = createMockDb({ now: () => new Date(NOW) })
  const { lengthCm, widthCm, heightCm, weightKg } = SPEC_CARTON_A
  const carton = { lengthCm, widthCm, heightCm, weightKg, handlingClass: 'STANDARD' as const, destination: '215 Quốc lộ 1K, P. Đông Hoà, Dĩ An', packageCode: 'KH-778' }
  const first = await db.createPackage(carton)
  const second = await db.createPackage(carton)
  const { id } = await db.createTrip({ ...twoCartonTrip(), packages: [] })
  const trip = await db.addTripPackages(id, [first.id, second.id], { stopId: 'STOP-02' })
  // Kiện đưa thẳng từ kho kiện giữ mã của chính nó: mỗi kiện một dòng, hai dòng cùng mã của bên gửi
  const instances = (await db.listTripLabels(id)).map((item) => item.packageInstanceId)
  expect((await db.listTripLabels(id)).map((item) => item.packageCode)).toStrictEqual(['KH-778', 'KH-778'])
  const result = { ...twoCartonResult(), placements: twoCartonResult().placements.map((placement, index) => ({ ...placement, packageInstanceId: instances[index] ?? '' })) }
  const revision = await db.addRevision({ tripId: id, request: { ...twoCartonRequest(), packages: trip.packages }, result })
  await db.approveRevision(revision.id, [])
  await db.startLoading(id)
  // Soạn cũng không nhận mã của bên gửi trùng hai kiện
  await expect(db.confirmStagingByQr(id, 'KH-778', 'CODE')).rejects.toMatchObject({ code: 'PACKAGE_CODE_AMBIGUOUS', params: { count: 2 } })
  await stageAll(db, id)

  await expect(db.confirmLoadingByQr(id, 'kh-778', 'CODE')).rejects.toMatchObject({ code: 'PACKAGE_CODE_AMBIGUOUS', params: { tripId: id, code: 'kh-778', count: 2 } })
  expect(await stepsOf(db, id)).toStrictEqual([])
  // Mã QR in dưới hình vẫn phân biệt được hai kiện
  expect((await db.confirmLoadingByQr(id, first.qrToken, 'CODE')).packageInstanceId).toBe(instances[0])
})

test('loading: a manual confirmation keeps the work going but blocks finishing until the dispatcher approves it', async () => {
  const { db, id, token } = await twoCartons('loading')
  await expect(db.confirmLoadingManually(id, { packageInstanceId: 'PKG-002-01', reason: 'LABEL_DAMAGED' })).rejects.toMatchObject({
    code: 'WRONG_PACKAGE_SCANNED', params: { expected: 'PKG-001-01', scanned: 'PKG-002-01' },
  })
  await expect(db.confirmLoadingManually(id, { packageInstanceId: 'PKG-001-01', reason: 'OTHER', note: '  ' })).rejects.toMatchObject({ code: 'REASON_REQUIRED' })
  const { trip, packageInstanceId } = await db.confirmLoadingManually(id, { packageInstanceId: 'PKG-001-01', reason: 'LABEL_DAMAGED', note: ' Nhãn rách một nửa ' })
  expect(packageInstanceId).toBe('PKG-001-01')
  expect(trip.verifications).toStrictEqual([...STAGED, {
    id: 'VF-003', context: 'LOADING', packageInstanceId: 'PKG-001-01', method: 'MANUAL', at: NOW, by: 'US-0003',
    manual: { status: 'MANUAL_PENDING', reason: 'LABEL_DAMAGED', note: 'Nhãn rách một nửa' },
  }])
  expect(await stepsOf(db, id)).toStrictEqual([['PKG-001-01', 'loaded', undefined]])
  // Dòng phụ cạnh tiến độ xếp: "Chờ duyệt xác nhận tay (1)"
  expect(tripManualSubStatus(trip)).toStrictEqual({ kind: 'manualPending', count: 1 })
  expect((await db.listEvents({ targetId: id }))[0]).toMatchObject({
    action: 'manualConfirm.requested', actorId: 'US-0003', params: { packageInstanceId: 'PKG-001-01', verifyContext: 'LOADING', manualReason: 'LABEL_DAMAGED', note: 'Nhãn rách một nửa' },
  })

  await db.confirmLoadingByQr(id, token('PKG-002-01'))
  await expect(db.completeLoading(id)).rejects.toMatchObject({ code: 'MANUAL_CONFIRM_PENDING', params: { tripId: id, count: 1 } })
  expect((await db.getTrip(id)).phase).toBe('loading')

  // Người gửi không tự duyệt được: duyệt là việc của điều phối viên
  await expect(db.approveManualConfirmation(id, 'VF-003')).rejects.toMatchObject({ code: 'ROLE_NOT_ALLOWED', params: { role: 'warehouse' } })
  db.restoreSession('US-0001')
  const approved = await db.approveManualConfirmation(id, 'VF-003')
  expect(approved.verifications?.[2]?.manual).toStrictEqual({ status: 'MANUAL_APPROVED', reason: 'LABEL_DAMAGED', note: 'Nhãn rách một nửa', decidedAt: NOW, decidedBy: 'US-0001' })
  expect(pendingManualConfirms(approved)).toStrictEqual([])
  expect(tripManualSubStatus(approved)).toBeNull()
  expect((await db.listEvents({ targetId: id }))[0]).toMatchObject({ action: 'manualConfirm.approved', actorId: 'US-0001', params: { packageInstanceId: 'PKG-001-01', requestedBy: 'US-0003' } })
  await expect(db.approveManualConfirmation(id, 'VF-003')).rejects.toMatchObject({ code: 'MANUAL_CONFIRM_NOT_PENDING', params: { tripId: id, confirmationId: 'VF-003' } })
  await expect(db.rejectManualConfirmation(id, 'VF-404', 'Không rõ')).rejects.toMatchObject({ code: 'MANUAL_CONFIRM_NOT_PENDING' })

  db.restoreSession('US-0003')
  expect((await db.completeLoading(id)).phase).toBe('loaded')
})

test('loading: a rejected manual confirmation takes the package back to be checked again', async () => {
  const { db, id, token } = await twoCartons('loading')
  await db.confirmLoadingManually(id, { packageInstanceId: 'PKG-001-01', reason: 'QR_UNREADABLE' })
  await db.confirmLoadingByQr(id, token('PKG-002-01'))
  db.restoreSession('US-0001')
  await expect(db.rejectManualConfirmation(id, 'VF-003', '   ')).rejects.toMatchObject({ code: 'REASON_REQUIRED' })
  const rejected = await db.rejectManualConfirmation(id, 'VF-003', ' Ảnh chụp cho thấy sai kiện ')
  expect(rejected.verifications?.[2]?.manual).toStrictEqual({
    status: 'MANUAL_REJECTED', reason: 'QR_UNREADABLE', decidedAt: NOW, decidedBy: 'US-0001', rejectReason: 'Ảnh chụp cho thấy sai kiện',
  })
  // Kết quả xếp của kiện bị gỡ: kho phải kiểm lại đúng kiện đó trước khi xong xếp
  expect(await stepsOf(db, id)).toStrictEqual([['PKG-002-01', 'loaded', 'qr']])
  expect(rejectedConfirms(rejected, 'LOADING', new Set(['PKG-002-01'])).map((entry) => entry.packageInstanceId)).toStrictEqual(['PKG-001-01'])
  expect((await db.listEvents({ targetId: id }))[0]).toMatchObject({
    action: 'manualConfirm.rejected', actorId: 'US-0001', params: { packageInstanceId: 'PKG-001-01', reason: 'Ảnh chụp cho thấy sai kiện', requestedBy: 'US-0003' },
  })

  db.restoreSession('US-0003')
  await expect(db.completeLoading(id)).rejects.toMatchObject({ code: 'LOADING_INCOMPLETE', params: { remaining: 1 } })
  const { trip } = await db.confirmLoadingByQr(id, token('PKG-001-01'))
  expect(trip.verifications?.slice(2).map((entry) => [entry.id, entry.packageInstanceId, entry.method, entry.manual?.status])).toStrictEqual([
    ['VF-003', 'PKG-001-01', 'MANUAL', 'MANUAL_REJECTED'], ['VF-004', 'PKG-002-01', 'QR', undefined], ['VF-005', 'PKG-001-01', 'QR', undefined],
  ])
  expect(rejectedConfirms(trip, 'LOADING', new Set(['PKG-001-01', 'PKG-002-01']))).toStrictEqual([])
  expect((await db.completeLoading(id)).phase).toBe('loaded')
})

test('unloading: a pending manual confirmation blocks completing the stop; rejected, the package is no longer unloaded', async () => {
  const { db, id, token } = await twoCartons('delivering')
  await expect(db.confirmUnloadManually(id, 1, { packageInstanceId: 'PKG-001-01', reason: 'LABEL_DAMAGED' })).rejects.toMatchObject({ code: 'QR_WRONG_STOP', params: { stopNumber: 3 } })
  await expect(db.confirmUnloadManually(id, 2, { packageInstanceId: 'PKG-002-01', reason: 'LABEL_DAMAGED' })).rejects.toMatchObject({ code: 'STOP_NOT_CURRENT' })
  const { trip } = await db.confirmUnloadManually(id, 1, { packageInstanceId: 'PKG-002-01', reason: 'OTHER', note: 'Nhãn dính nước, không đọc được' })
  expect(trip.delivery?.stops[0]).toStrictEqual({ number: 1, unloadedIds: ['PKG-002-01'], arrivedAt: NOW })
  expect(trip.verifications?.slice(4)).toStrictEqual([{
    id: 'VF-005', context: 'UNLOADING', stopNumber: 1, packageInstanceId: 'PKG-002-01', method: 'MANUAL', at: NOW, by: 'US-0004',
    manual: { status: 'MANUAL_PENDING', reason: 'OTHER', note: 'Nhãn dính nước, không đọc được' },
  }])
  expect((await db.listEvents({ targetId: id }))[0]).toMatchObject({ action: 'manualConfirm.requested', params: { verifyContext: 'UNLOADING', stopNumber: 1, manualReason: 'OTHER' } })
  await expect(db.completeStop(id, 1)).rejects.toMatchObject({ code: 'MANUAL_CONFIRM_PENDING', params: { tripId: id, count: 1 } })

  db.restoreSession('US-0001')
  const rejected = await db.rejectManualConfirmation(id, 'VF-005', 'Gọi khách xác nhận lại số kiện')
  expect(rejected.delivery?.stops[0]?.unloadedIds).toStrictEqual([])
  db.restoreSession('US-0004')
  await expect(db.completeStop(id, 1)).rejects.toMatchObject({ code: 'STOP_INCOMPLETE', params: { remaining: 1 } })

  // Gõ mã in dưới hình QR: kiểm như quét, không cần duyệt
  const typed = await db.confirmUnloadByQr(id, 1, token('PKG-002-01').toLowerCase(), 'CODE')
  expect(typed.trip.verifications?.at(-1)).toStrictEqual({ id: 'VF-006', context: 'UNLOADING', stopNumber: 1, packageInstanceId: 'PKG-002-01', method: 'CODE', at: NOW, by: 'US-0004' })
  expect(typed.trip.delivery?.stops[0]).toMatchObject({ unloadedIds: ['PKG-002-01'], qrConfirmedIds: ['PKG-002-01'] })
  expect((await db.completeStop(id, 1)).delivery?.stops[0]?.completedAt).toBe(NOW)
})

test('a package the customer refuses stays on the truck: its unload mark and its pending manual confirmation are dropped', async () => {
  const { db, id } = await twoCartons('delivering')
  await db.confirmUnloadManually(id, 1, { packageInstanceId: 'PKG-002-01', reason: 'QR_UNREADABLE' })
  expect(tripManualSubStatus(await db.getTrip(id))).toStrictEqual({ kind: 'manualPending', count: 1 })
  const trip = await db.reportDeliveryIssue(id, { stopNumber: 1, packageInstanceId: 'PKG-002-01', kind: 'refused', note: 'Khách đổi ý' })
  expect([trip.delivery?.stops[0]?.unloadedIds, pendingManualConfirms(trip)]).toStrictEqual([[], []])
  db.restoreSession('US-0001')
  await expect(db.approveManualConfirmation(id, 'VF-005')).rejects.toMatchObject({ code: 'MANUAL_CONFIRM_NOT_PENDING' })
})

test('the seed has no verification waiting: nothing is pending on any trip', async () => {
  const db = createMockDb()
  expect((await db.listTrips()).flatMap((trip) => pendingManualConfirms(trip))).toStrictEqual([])
})
