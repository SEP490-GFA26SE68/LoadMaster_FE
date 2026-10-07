import { beforeAll, describe, expect, test } from 'vitest'
import { createMockDb, PICKUP_STATUSES, type MockDb, type PickupPackage, type PickupRequestInput, type PickupStatus } from '@/lib/mock-db'

/**
 * Yêu cầu nhận hàng dọc đường (FE-7-01, D-88): chỉ tạo khi chuyến Đang vận chuyển, bảng chuyển trạng thái, seed. Cách ly theo công ty
 * của bốn hàm công khai kiểm ở `tenancy.test.ts`.
 */

const NOW = new Date('2026-09-14T05:00:00.000Z')
/** TRIP-009 của Long Bình đang vận chuyển; điều phối viên `US-0001`. */
const TRIP = 'TRIP-009'
const DISPATCHER = 'US-0001'

/** Kiện dễ vỡ trên chuyến chở hàng thường: trượt đúng luật 8 (khác loại hàng của chuyến) — yêu cầu mặc định của file là yêu cầu còn `PENDING`. */
const BOX: PickupPackage = { packageCode: 'HG-0501', lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 12, handlingClass: 'FRAGILE' }
const INPUT: PickupRequestInput = {
  pickup: { name: 'Xưởng may Hoàng Gia', address: 'Đường số 4, KCN VSIP 1, Thuận An, Bình Dương', lat: 10.928, lng: 106.712 },
  delivery: { name: 'Bếp ăn KCN Sóng Thần', address: '12 Đường số 6, KCN Sóng Thần 1, Dĩ An', lat: 10.893, lng: 106.75 },
  deadline: '2026-09-14T10:30:00.000Z',
  packages: [BOX],
}

/** Chuỗi trạng thái đi từ `PENDING` tới từng trạng thái. */
const PATH_TO: Record<PickupStatus, PickupStatus[]> = {
  PENDING: [],
  VALIDATED: ['VALIDATED'],
  REJECTED: ['REJECTED'],
  APPROVED: ['VALIDATED', 'APPROVED'],
  LOADED: ['VALIDATED', 'APPROVED', 'LOADED'],
  DELIVERED: ['VALIDATED', 'APPROVED', 'LOADED', 'DELIVERED'],
}

/** Sơ đồ BE 3.3 chép tay: `PENDING` → `VALIDATED` / `REJECTED` → `APPROVED` (`PENDING` còn luật không đạt duyệt kèm lý do vượt) → `LOADED` → `DELIVERED`. */
const ALLOWED: Record<PickupStatus, PickupStatus[]> = {
  PENDING: ['VALIDATED', 'REJECTED', 'APPROVED'],
  VALIDATED: ['APPROVED', 'REJECTED'],
  REJECTED: [],
  APPROVED: ['LOADED'],
  LOADED: ['DELIVERED'],
  DELIVERED: [],
}

function newDb(): MockDb {
  const db = createMockDb({ now: () => NOW })
  db.restoreSession(DISPATCHER)
  return db
}

test('the seed has one request waiting for approval, on the one trip of Long Binh that is in transit', async () => {
  const db = newDb()
  expect((await db.getTrip(TRIP)).phase).toBe('delivering')
  expect(await db.listPickupRequests(TRIP)).toMatchObject([
    { id: 'PKR-001', companyId: 'LOG-001', tripId: TRIP, status: 'PENDING', validationResults: [], pickup: { lat: 10.928, lng: 106.712 } },
  ])
  const others = await Promise.all((await db.listTrips()).filter((trip) => trip.id !== TRIP).map((trip) => db.listPickupRequests(trip.id)))
  expect(others.flat()).toStrictEqual([])
})

describe('createPickupRequest', () => {
  test('creates a request with the next code, rounds sizes at the boundary, records the author and runs the ten rules at once', async () => {
    const db = newDb()
    const created = await db.createPickupRequest(TRIP, { ...INPUT, packages: [{ ...BOX, lengthCm: 60.04, weightKg: 12.004 }] })
    expect(created).toMatchObject({
      id: 'PKR-002', companyId: 'LOG-001', tripId: TRIP, createdBy: DISPATCHER,
      deadline: '2026-09-14T10:30:00.000Z', packages: [{ lengthCm: 60, weightKg: 12 }],
    })
    expect(created.validationResults.map((result) => result.rule)).toStrictEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect((await db.listPickupRequests(TRIP)).map((item) => item.id)).toStrictEqual(['PKR-001', 'PKR-002'])
    expect(await db.getPickupRequest(TRIP, 'PKR-002')).toStrictEqual(created)
    expect((await db.listEvents())[0]).toMatchObject({ action: 'pickup.requested', actorId: DISPATCHER, target: { type: 'trip', id: TRIP }, params: { pickupId: 'PKR-002', count: 1, failedRules: 1 } })
  })

  // Chuyến chở hàng thường: kiện dễ vỡ trượt luật 8; kiện thường 12 kg đạt cả mười — hàng còn lại đã dồn về đầu thùng từ trước nên
  // luật 6 không tính cho yêu cầu
  test.each([
    { handlingClass: 'FRAGILE', status: 'PENDING', failed: [8] },
    { handlingClass: 'STANDARD', status: 'VALIDATED', failed: [] },
  ] as const)('a $handlingClass box makes the request $status: rules not passed $failed', async ({ handlingClass, status, failed }) => {
    const created = await newDb().createPickupRequest(TRIP, { ...INPUT, packages: [{ ...BOX, handlingClass }] })
    expect(created.status).toBe(status)
    expect(created.validationResults.filter((result) => !result.passed).map((result) => result.rule)).toStrictEqual(failed)
  })

  test('validatePickupRequest checks the seed request that was never checked, and only a PENDING or VALIDATED one', async () => {
    const db = newDb()
    const checked = await db.validatePickupRequest(TRIP, 'PKR-001')
    expect(checked.validationResults).toHaveLength(10)
    expect(checked.status).toBe(checked.validationResults.every((result) => result.passed) ? 'VALIDATED' : 'PENDING')
    await db.updatePickupStatus(TRIP, 'PKR-001', 'REJECTED')
    await expect(db.validatePickupRequest(TRIP, 'PKR-001')).rejects.toMatchObject({ code: 'INVALID_PICKUP_STATUS_TRANSITION', params: { from: 'REJECTED' } })
  })

  test.each([
    { who: 'the dispatcher', user: 'US-0001', allowed: true, can: 'can' },
    { who: 'the driver of the trip', user: 'US-0006', allowed: true, can: 'can' },
    { who: 'another driver', user: 'US-0004', allowed: false, can: 'cannot' },
    { who: 'the manager', user: 'US-0002', allowed: false, can: 'cannot' },
    { who: 'the warehouse worker', user: 'US-0003', allowed: false, can: 'cannot' },
  ])('$who $can create and check a request', async ({ user, allowed }) => {
    const db = createMockDb({ now: () => NOW })
    db.restoreSession(user)
    const create = db.createPickupRequest(TRIP, INPUT)
    const validate = db.validatePickupRequest(TRIP, 'PKR-001')
    if (allowed) await expect(Promise.all([create, validate])).resolves.toHaveLength(2)
    else await expect(Promise.all([create.catch((error: unknown) => error), validate.catch((error: unknown) => error)])).resolves.toMatchObject([{ code: 'ROLE_NOT_ALLOWED' }, { code: 'ROLE_NOT_ALLOWED' }])
  })

  test.each([
    { trip: 'TRIP-014', from: 'DRAFT' },
    { trip: 'TRIP-010', from: 'LOADING' },
    { trip: 'TRIP-001', from: 'DELIVERED' },
  ])('is refused on a trip that is $from', async ({ trip, from }) => {
    await expect(newDb().createPickupRequest(trip, INPUT)).rejects.toMatchObject({
      code: 'INVALID_TRIP_STATUS_TRANSITION', params: { tripId: trip, from, to: 'IN_TRANSIT' },
    })
  })

  test.each([
    { what: 'a blank pickup name', input: { ...INPUT, pickup: { ...INPUT.pickup, name: ' ' } }, code: 'PICKUP_INVALID', field: 'pickup.name' },
    { what: 'a delivery latitude out of range', input: { ...INPUT, delivery: { ...INPUT.delivery, lat: 91 } }, code: 'PICKUP_INVALID', field: 'delivery.coordinates' },
    { what: 'a zero weight', input: { ...INPUT, packages: [{ ...BOX, weightKg: 0 }] }, code: 'PICKUP_INVALID', field: 'packages.weightKg' },
    { what: 'no package', input: { ...INPUT, packages: [] }, code: 'PACKAGES_REQUIRED', field: undefined },
  ])('is refused with $what', async ({ input, code, field }) => {
    await expect(newDb().createPickupRequest(TRIP, input)).rejects.toMatchObject({ code, ...(field === undefined ? {} : { params: { field } }) })
  })
})

describe('updatePickupStatus follows the transition table', () => {
  let db: MockDb
  beforeAll(() => {
    db = newDb()
  })

  async function reach(status: PickupStatus): Promise<string> {
    const { id } = await db.createPickupRequest(TRIP, INPUT)
    for (const step of PATH_TO[status]) await db.updatePickupStatus(TRIP, id, step)
    return id
  }

  test('every move between two statuses is allowed or refused exactly as the BE diagram says', async () => {
    for (const from of PICKUP_STATUSES) {
      for (const to of PICKUP_STATUSES) {
        const id = await reach(from)
        const result = db.updatePickupStatus(TRIP, id, to)
        if (ALLOWED[from].includes(to)) await expect(result, `${from} -> ${to}`).resolves.toMatchObject({ id, status: to })
        else await expect(result, `${from} -> ${to}`).rejects.toMatchObject({ code: 'INVALID_PICKUP_STATUS_TRANSITION', params: { pickupId: id, from, to } })
      }
    }
  })

  test('approving a PENDING request keeps the results and the override reason, and records who approved it and when', async () => {
    const failed = [{ rule: 3 as const, passed: false, code: 'PICKUP_PAYLOAD_EXCEEDED' as const, params: { overKg: 40 }, estimated: false }]
    const id = await reach('PENDING')
    const approved = await db.updatePickupStatus(TRIP, id, 'APPROVED', { validationResults: failed, overrideReason: '  Khách quen, xe còn chỗ  ' })
    expect(approved).toMatchObject({
      status: 'APPROVED', validationResults: failed, overrideReason: 'Khách quen, xe còn chỗ', approvedBy: DISPATCHER, approvedAt: NOW.toISOString(),
    })
  })
})
