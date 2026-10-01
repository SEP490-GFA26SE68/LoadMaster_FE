import { SEED_ANCHOR_DATE } from './clock'
import { auditMethods } from './db-audit'
import { createDbContext, type DbState } from './db-context'
import { operationMethods } from './db-operations'
import { orderMethods } from './db-orders'
import { packageTypeMethods } from './db-package-types'
import { registeredMethods } from './db-registered'
import { revisionMethods } from './db-revisions'
import { runMethods } from './db-runs'
import { scanMethods } from './db-scans'
import { shipmentMethods } from './db-shipments'
import { tripMethods } from './db-trips'
import { userMethods } from './db-users'
import { vehicleTypeMethods } from './db-vehicle-types'
import { vehicleMethods } from './db-vehicles'
import { seededRandom } from './qr-token'
import { buildSeed } from './seed'
import { shiftSeedTimes } from './seed-shift'
import type { MockDb, MockDbOptions } from './types'

/** Hạt giống mã QR của kiện đăng ký mới khi nơi gọi không truyền `random`: test tất định. */
const QR_SEED = 20_260_927

/** Tạo một kho mới đã nạp seed neo theo `today` (D-44). Mỗi kho giữ dữ liệu và phiên riêng. */
export function createMockDb({ latencyMs = 0, today = SEED_ANCHOR_DATE, now = () => new Date(), random }: MockDbOptions = {}): MockDb {
  // Mở app trước giờ của các việc "hôm nay" trong seed thì lùi mốc giờ seed, không để lịch sử có sự kiện ở tương lai
  const seed = shiftSeedTimes(buildSeed(today), now())
  const state: DbState = {
    vehicles: new Map(seed.vehicles.map((vehicle) => [vehicle.id, vehicle])),
    maintenance: new Map(seed.maintenance),
    trips: new Map(seed.trips.map((trip) => [trip.id, trip])),
    revisions: new Map(seed.revisions.map((revision) => [revision.id, revision])),
    users: new Map(seed.users.map((user) => [user.id, user])),
    passwords: new Map(seed.passwords),
    events: seed.events,
    session: { userId: null },
    companies: new Map(seed.companies.map((company) => [company.id, company])),
    packageTypes: new Map(seed.packageTypes.map((type) => [type.id, type])),
    registeredPackages: new Map(seed.registeredPackages.map((pkg) => [pkg.id, pkg])),
    shipments: new Map(seed.shipments.map((shipment) => [shipment.id, shipment])),
    orders: new Map(seed.orders.map((order) => [order.id, order])),
    runs: new Map(seed.runs.map((run) => [run.id, run])),
    vehicleTypes: new Map(seed.vehicleTypes.map((type) => [type.id, type])),
    vehicleTypeOf: new Map(seed.vehicleTypeOf),
  }
  const ctx = createDbContext(state, latencyMs, now, random ?? seededRandom(QR_SEED))
  return {
    ...vehicleMethods(ctx),
    ...tripMethods(ctx),
    ...revisionMethods(ctx),
    ...runMethods(ctx),
    ...operationMethods(ctx),
    ...userMethods(ctx),
    ...auditMethods(ctx),
    ...packageTypeMethods(ctx),
    ...registeredMethods(ctx),
    ...shipmentMethods(ctx),
    ...orderMethods(ctx),
    ...vehicleTypeMethods(ctx),
    ...scanMethods(ctx),
  }
}
