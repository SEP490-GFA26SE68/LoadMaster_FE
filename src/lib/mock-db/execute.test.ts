import { expect, test } from 'vitest'
import { createMockDb, normalizeQrToken, tripReport, type MockDb } from '@/lib/mock-db'

/** Luồng 5 Review 1 (LM-104): quét QR khi xếp và dỡ, số seal, báo cáo chuyến, và loại xe. */

async function nextLoadingInstance(db: MockDb, tripId: string) {
  const trip = await db.getTrip(tripId)
  const plan = await db.getRevision(trip.loading?.revisionId ?? '')
  const recorded = new Set(trip.loading?.steps.map((step) => step.packageInstanceId))
  return plan.result.placements.toSorted((a, b) => a.loadingOrder - b.loadingOrder).filter((p) => !recorded.has(p.packageInstanceId)).map((p) => p.packageInstanceId)
}

const tokenOf = async (db: MockDb, tripId: string, instanceId: string) =>
  (await db.listTripLabels(tripId)).find((label) => label.packageInstanceId === instanceId)?.qrToken ?? ''

test('qr tokens: normalized form; every label of a trip is the token of a pool package', async () => {
  expect(normalizeQrToken(' lm-7k3f 9xq2-m4td ')).toBe('LM-7K3F-9XQ2-M4TD')
  expect(normalizeQrToken('7k3f9xq2m4td')).toBe('LM-7K3F-9XQ2-M4TD')
  // Kiện nhập tay trong chuyến không còn mã băm theo chuyến + kiện (FE-3b-07): mã trên nhãn tra ngược ra đúng kiện kho kiện
  const db = createMockDb()
  const [label] = await db.listTripLabels('TRIP-011')
  expect(label?.packageInstanceId).toBe('PKG-001-01')
  expect(await db.findPackageByQr(label?.qrToken ?? '')).toMatchObject({ id: label?.poolPackageId, source: 'TRIP', tripId: 'TRIP-011', packageCode: 'PKG-001-01' })
})

test('the warehouse confirms the current step by scanning its label; another package of the trip is refused', async () => {
  const db = createMockDb()
  const [current, following] = await nextLoadingInstance(db, 'TRIP-011')
  await expect(db.confirmLoadingByQr('TRIP-011', await tokenOf(db, 'TRIP-011', following ?? ''))).rejects.toMatchObject({
    code: 'WRONG_PACKAGE_SCANNED', params: { expected: current, scanned: following },
  })
  await expect(db.confirmLoadingByQr('TRIP-011', await tokenOf(db, 'TRIP-010', 'PKG-001-01'))).rejects.toMatchObject({ code: 'PACKAGE_NOT_IN_TRIP' })
  const { trip, packageInstanceId } = await db.confirmLoadingByQr('TRIP-011', (await tokenOf(db, 'TRIP-011', current ?? '')).toLowerCase())
  expect(packageInstanceId).toBe(current)
  expect(trip.loading?.steps.at(-1)).toMatchObject({ packageInstanceId: current, outcome: 'loaded', via: 'qr' })
  expect(await nextLoadingInstance(db, 'TRIP-011')).toContain(following)
  await expect(db.confirmLoadingByQr('TRIP-010', 'LM-0000-0000-0000')).rejects.toMatchObject({ code: 'TRIP_PHASE_INVALID' })
})

test('the seal number is recorded once loading is finished, before the truck leaves', async () => {
  const db = createMockDb()
  await expect(db.recordSeal('TRIP-011', 'SEAL-1')).rejects.toMatchObject({ code: 'TRIP_PHASE_INVALID' })
  await expect(db.recordSeal('TRIP-010', '   ')).rejects.toMatchObject({ code: 'SEAL_INVALID', params: { max: 32 } })
  const trip = await db.recordSeal('TRIP-010', ' LB-2609-00417 ')
  expect(trip.loading?.seal).toMatchObject({ number: 'LB-2609-00417' })
  expect((await db.listEvents())[0]).toMatchObject({ action: 'loading.sealed', params: { sealNumber: 'LB-2609-00417' } })
})

test('the driver confirms unloading at the current stop by scanning; a package of another stop is refused', async () => {
  const db = createMockDb()
  const trip = await db.getTrip('TRIP-009')
  const plan = await db.getRevision(trip.loading?.revisionId ?? '')
  const byStop = (stop: number) => plan.result.placements.map((p) => p.packageInstanceId).filter((id) => trip.packages.find((pkg) => id.startsWith(`${pkg.id}-`))?.deliveryStop === stop)
  const [atStop2] = byStop(2)
  const [atStop3] = byStop(3)
  await expect(db.confirmUnloadByQr('TRIP-009', 2, await tokenOf(db, 'TRIP-009', atStop3 ?? ''))).rejects.toMatchObject({ code: 'QR_WRONG_STOP', params: { stopNumber: 3 } })
  await expect(db.confirmUnloadByQr('TRIP-009', 3, await tokenOf(db, 'TRIP-009', atStop3 ?? ''))).rejects.toMatchObject({ code: 'STOP_NOT_CURRENT' })
  const result = await db.confirmUnloadByQr('TRIP-009', 2, await tokenOf(db, 'TRIP-009', atStop2 ?? ''))
  const stop = result.trip.delivery?.stops.find((item) => item.number === 2)
  expect(stop?.unloadedIds).toContain(atStop2)
  expect(stop?.qrConfirmedIds).toStrictEqual([atStop2])
})

test('trip report of a completed trip counts what the warehouse and the driver recorded', async () => {
  const db = createMockDb()
  const trip = await db.getTrip('TRIP-003')
  const report = tripReport(trip, await db.getRevision(trip.loading?.revisionId ?? ''))
  expect(report.completed).toBe(true)
  expect(report.packages).toMatchObject({ planned: 145, loaded: 144, missing: 1, delivered: 144, withIssue: 0 })
  expect(report.stops.map((stop) => stop.planned)).toStrictEqual([60, 45, 39])
  expect(report.stops.every((stop) => stop.completedAt !== null)).toBe(true)
  expect(report.durations.loadingMs).toBeGreaterThan(0)
  expect(report.durations.totalMs).toBe(Date.parse(report.times.deliveryCompletedAt ?? '') - Date.parse(report.times.loadingStartedAt ?? ''))
  expect(report.seal).toBeNull()
  const draft = tripReport(await db.getTrip('TRIP-014'), undefined)
  expect(draft).toMatchObject({ completed: false, packages: { planned: 0, delivered: 0 }, durations: { loadingMs: null, deliveryMs: null, totalMs: null } })
})

test('vehicle types: CRUD, validation, cannot delete a type set on a vehicle, vehicles may have no type', async () => {
  const db = createMockDb()
  // Kho không có phiên trả danh mục của cả hai công ty: 7 loại xe của Long Bình và 1 của Phương Nam (FE-0-02)
  expect((await db.listVehicleTypes()).map((type) => type.id)).toStrictEqual(['VT-001', 'VT-002', 'VT-003', 'VT-004', 'VT-005', 'VT-006', 'VT-007', 'VT-PN-01'])
  expect((await db.listVehicleTypeAssignments()).find((item) => item.vehicleId === 'VEHICLE-008')).toBeUndefined()
  const created = await db.createVehicleType({ name: ' Xe tải 2,5 tấn thùng 4,3 m ', cargoLengthCm: 430, cargoWidthCm: 180, cargoHeightCm: 180, payloadKg: 2500 })
  expect(created).toMatchObject({ id: 'VT-008', name: 'Xe tải 2,5 tấn thùng 4,3 m' })
  await expect(db.updateVehicleType('VT-008', { ...created, payloadKg: 0 })).rejects.toMatchObject({ code: 'VEHICLE_TYPE_INVALID', params: { field: 'payloadKg' } })
  expect(await db.setVehicleType('VEHICLE-008', 'VT-008')).toStrictEqual({ vehicleId: 'VEHICLE-008', vehicleTypeId: 'VT-008' })
  await expect(db.deleteVehicleType('VT-008')).rejects.toMatchObject({ code: 'VEHICLE_TYPE_IN_USE', params: { vehicleIds: ['VEHICLE-008'] } })
  expect(await db.setVehicleType('VEHICLE-008', null)).toBeNull()
  await db.deleteVehicleType('VT-008')
  await expect(db.getVehicleType('VT-008')).rejects.toMatchObject({ code: 'NOT_FOUND' })
})
