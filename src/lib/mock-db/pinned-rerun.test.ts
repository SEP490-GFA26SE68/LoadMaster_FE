import { describe, expect, test } from 'vitest'
import { pinnedIssues } from '@/domain/constraints'
import { SPEC_CARTON_A, SPEC_CARTON_A_PLACEMENT } from '@/domain/fixtures/spec-samples'
import type { OptimizationRequest } from '@/domain/models'
import { createMockDb, type MockDb } from '@/lib/mock-db'
import { keptLoaded } from '@/lib/mock-db/db-replan'
import { runMockCandidates } from '@/services/optimization'
import { twoCartonRequest, twoCartonResult, twoCartonTrip } from '@/test/mock-db-samples'
import { placed } from '@/test/placements'
import { loadAll, stageAll } from '@/test/trip-flow'

/**
 * Ghim lưu cùng phương án và chạy lại giữ kiện ghim (FE-BL-02). Người: điều phối `US-0001`, kho `US-0003` (seed-users.ts).
 */
const SETTINGS = { method: 'MOCK', timeLimitSeconds: 10, randomSeed: 1, enforceLifo: true, prioritizeLowCenterOfGravity: true } as const

async function openTrip012() {
  const db = createMockDb({ now: () => new Date('2026-09-14T03:00:00.000Z') })
  db.restoreSession('US-0001')
  const trip = await db.getTrip('TRIP-012')
  const vehicle = await db.getVehicle(trip.vehicleId)
  const source = (await db.listRevisions(trip.id)).at(-1)
  if (source === undefined) throw new Error('TRIP-012 không có revision')
  return { db, trip, vehicle, source }
}

const pinnedOf = (placements: readonly { packageInstanceId: string; pinned?: boolean }[]) => placements.filter(({ pinned }) => pinned === true).map(({ packageInstanceId }) => packageInstanceId)

describe('pins live in the plan', () => {
  test('a pin set at approval is saved on the approved revision, survives reopening and re-approval, and is replaced by the next pin list', async () => {
    const { db, source } = await openTrip012()
    const [a, b, c] = source.result.placements.map(({ packageInstanceId }) => packageInstanceId) as [string, string, string]
    expect(pinnedOf(source.result.placements)).toStrictEqual([])

    const approved = await db.approveRevision(source.id, [], { pinned: [a, b] })
    expect(pinnedOf(approved.result.placements)).toStrictEqual([a, b])
    expect(pinnedOf((await db.getRevision(approved.id)).result.placements)).toStrictEqual([a, b])
    // Ghim không phải chỉnh tay và không đổi vị trí kiện nào
    expect(approved.manuallyEdited).toBe(false)
    expect(approved.result.placements.map(({ xCm, yCm, zCm }) => [xCm, yCm, zCm])).toStrictEqual(source.result.placements.map(({ xCm, yCm, zCm }) => [xCm, yCm, zCm]))
    // Duyệt lại không nói gì về ghim: giữ; nói danh sách mới: thay hẳn
    expect(pinnedOf((await db.approveRevision(approved.id, [])).result.placements)).toStrictEqual([a, b])
    expect(pinnedOf((await db.approveRevision(approved.id, [], { pinned: [c] })).result.placements)).toStrictEqual([c])
    await expect(db.approveRevision(approved.id, [], { pinned: ['PKG-404-01'] })).rejects.toMatchObject({ code: 'PATCH_UNKNOWN_INSTANCE' })
  })

  test('running again with pins saves one run of three revisions that record the pins, costs one credit, and keeps the pinned packages in place', async () => {
    const { db, trip, vehicle, source } = await openTrip012()
    const approved = await db.approveRevision(source.id, [], { pinned: source.result.placements.slice(0, 2).map(({ packageInstanceId }) => packageInstanceId) })
    const pinnedPlacements = approved.result.placements.filter(({ pinned }) => pinned === true)
    const request: OptimizationRequest = { vehicle, packages: trip.packages, settings: SETTINGS, pinnedPlacements }
    expect(pinnedIssues(request)).toStrictEqual([])
    const job = runMockCandidates(request, { clock: () => 0 })
    const runsBefore = (await db.listOptimizationRuns(trip.id)).length
    const balance = (await db.getCreditBalance()).balance

    const saved = await db.saveOptimizationRun({ tripId: trip.id, request, jobId: job.jobId, plans: job.plans })
    expect((await db.getCreditBalance()).balance).toBe(balance - 1)
    expect((await db.listOptimizationRuns(trip.id)).length).toBe(runsBefore + 1)
    expect(saved.run).toMatchObject({ status: 'COMPLETED', pinnedCount: 2 })
    expect(saved.revisions).toHaveLength(3)
    for (const revision of saved.revisions) {
      expect(revision.request.pinnedPlacements).toHaveLength(2)
      for (const pin of pinnedPlacements) {
        expect(revision.result.placements.find(({ packageInstanceId }) => packageInstanceId === pin.packageInstanceId))
          .toMatchObject({ xCm: pin.xCm, yCm: pin.yCm, zCm: pin.zCm, orientation: pin.orientation, pinned: true })
      }
    }
    // Nhật ký vẫn là một sự kiện cho cả lần chạy
    expect((await db.listEvents({ targetId: trip.id }))[0]).toMatchObject({ action: 'optimization.saved', params: { runId: saved.run.id } })
  })

  test('a pinned set that cannot stand on its own is refused by the store: nothing is saved and no credit is spent', async () => {
    const { db, trip, vehicle, source } = await openTrip012()
    const [first] = source.result.placements
    const request: OptimizationRequest = { vehicle, packages: trip.packages, settings: SETTINGS, pinnedPlacements: [{ ...(first as NonNullable<typeof first>), xCm: 9_999 }] }
    const job = runMockCandidates(source.request, { clock: () => 0 })
    const revisions = (await db.listRevisions(trip.id)).length
    const balance = (await db.getCreditBalance()).balance
    await expect(db.saveOptimizationRun({ tripId: trip.id, request, jobId: job.jobId, plans: job.plans }))
      .rejects.toMatchObject({ code: 'PINNED_SET_INVALID', params: { tripId: trip.id, codes: expect.arrayContaining(['EXCEEDS_BOUNDARY']) } })
    expect([(await db.listRevisions(trip.id)).length, (await db.getCreditBalance()).balance]).toStrictEqual([revisions, balance])
  })
})

/**
 * Chuyến `TRIP-015` chở ba thùng Carton A (`PKG-001-01`, `PKG-002-01`, `PKG-003-01`, theo thứ tự xếp). Thùng thứ ba tựa lên thùng thứ hai.
 */
const CARTON = { lengthCm: 120, widthCm: 60, heightCm: 45, weightKg: 30, handlingClass: 'STANDARD' as const, destination: '203 Lê Văn Sỹ, P. 13, Q.3' }

async function threeCartonsLoading() {
  const db = createMockDb({ now: () => new Date('2026-09-14T03:00:00.000Z') })
  db.restoreSession('US-0001')
  const packages = await Promise.all(['KH-101', 'KH-102', 'KH-103'].map((packageCode) => db.createPackage({ ...CARTON, packageCode })))
  const requirement = await db.createDeliveryRequirement({
    destinationName: 'Nhà hàng Hương Việt', address: '203 Lê Văn Sỹ, P. 13, Q.3', lat: 10.7869, lng: 106.6803, deadline: '2026-09-16T10:00:00.000Z',
    priority: 'NORMAL', packageIds: packages.map(({ id }) => id),
  })
  const { id } = await db.createTrip({ ...twoCartonTrip(), packages: [], stops: [] })
  await db.assignDeliveryRequirement(requirement.id, id)
  await db.optimizeTripRoute(id)
  const trip = await db.getTrip(id)
  const ids = (await db.listTripLabels(id)).map((label) => label.packageInstanceId)
  const at = (packageInstanceId: string, xCm: number, zCm: number, loadingOrder: number) => ({ ...SPEC_CARTON_A_PLACEMENT, packageInstanceId, xCm, yCm: 0, zCm, loadingOrder, unloadingOrder: ids.length - loadingOrder + 1 })
  const placements = [at(ids[0] as string, 120, 0, 1), at(ids[1] as string, 240, 0, 2), at(ids[2] as string, 240, 45, 3)]
  const request = { ...twoCartonRequest(), packages: trip.packages }
  const revision = await db.addRevision({ tripId: id, request, result: { ...twoCartonResult(), placements, metrics: { ...twoCartonResult().metrics, placedCount: 3 } } })
  await db.approveRevision(revision.id, [])
  db.restoreSession('US-0003')
  await db.startLoading(id)
  await stageAll(db, id)
  return { db, tripId: id, ids, placements }
}

async function damagedAfterLoading(db: MockDb, tripId: string, ids: readonly string[]) {
  await loadAll(db, tripId, ids[1])
  return db.reportDamagedPackage(tripId, ids[1] as string)
}

describe('a damaged package with other packages resting on it sends the trip back to planned', () => {
  test('the packages the warehouse had already loaded are carried at their loaded places and can be pinned for the next run', async () => {
    const { db, tripId, ids, placements } = await threeCartonsLoading()
    const trip = await damagedAfterLoading(db, tripId, ids)
    expect(trip.phase).toBe('planning')
    expect(trip.replan).toMatchObject({ reason: 'DAMAGED', unload: true, keep: [{ ...placements[0], pinned: true }] })
    expect(trip.replan?.blocked).toBeUndefined()

    // Điều phối viên giữ chúng: bộ ghim đứng vững và lần chạy lại xếp thùng còn lại quanh nó
    const request: OptimizationRequest = { vehicle: await db.getVehicle(trip.vehicleId), packages: trip.packages, settings: SETTINGS, pinnedPlacements: trip.replan?.keep }
    expect(pinnedIssues(request)).toStrictEqual([])
    db.restoreSession('US-0001')
    const job = runMockCandidates(request, { clock: () => 0 })
    const { revisions } = await db.saveOptimizationRun({ tripId, request, jobId: job.jobId, plans: job.plans })
    for (const { result } of revisions) {
      expect(result.placements.find(({ packageInstanceId }) => packageInstanceId === ids[0])).toMatchObject({ xCm: 120, yCm: 0, zCm: 0, pinned: true })
      expect(result.metrics.placedCount).toBe(2)
    }
  })

  test('the carried places follow the renumbering of the damaged package line, and a loaded package that rested on the damaged one cannot be kept', () => {
    const line = { ...SPEC_CARTON_A, id: 'PKG-001', quantity: 100 }
    const box = (n: number, xCm: number, zCm = 0) => placed(`PKG-001-${String(n).padStart(3, '0')}`, [xCm, 0, zCm], [100, 100, 100])
    const placements = [box(1, 0), box(2, 100), box(3, 200), box(4, 300), box(5, 200, 100)]
    const loaded = new Set(['PKG-001-001', 'PKG-001-002', 'PKG-001-004'])
    // Kiện thứ 3 hỏng: dòng còn 99 kiện, mã đánh số lại từ ba chữ số xuống hai; các kiện giống hệt nhau nên kiện đã xếp thứ i nhận mã thứ i
    expect(keptLoaded(placements, loaded, line, 'PKG-001-003', 99).keep?.map(({ packageInstanceId, xCm, pinned }) => [packageInstanceId, xCm, pinned]))
      .toStrictEqual([['PKG-001-01', 0, true], ['PKG-001-02', 100, true], ['PKG-001-03', 300, true]])
    // Kiện thứ 5 nằm trên kiện hỏng và đã lên xe: chỗ đỡ của nó không còn
    expect(keptLoaded(placements, new Set([...loaded, 'PKG-001-005']), line, 'PKG-001-003', 99)).toStrictEqual({ blocked: ['PKG-001-005'] })
    expect(keptLoaded(placements, new Set(), line, 'PKG-001-003', 99)).toStrictEqual({})
  })
})
