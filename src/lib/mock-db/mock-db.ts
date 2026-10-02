import { SEED_ANCHOR_DATE } from './clock'
import { auditMethods } from './db-audit'
import { createDbContext, type DbState } from './db-context'
import { operationMethods } from './db-operations'
import { packageTypeMethods } from './db-package-types'
import { packageMethods } from './db-packages'
import { requirementMethods } from './db-requirements'
import { revisionMethods } from './db-revisions'
import { runMethods } from './db-runs'
import { scanMethods } from './db-scans'
import { tripPoolMethods } from './db-trip-pool'
import { routeMethods } from './db-trip-route'
import { segregationMethods } from './db-trip-segregation'
import { tripMethods } from './db-trips'
import { userMethods } from './db-users'
import { vehicleTypeMethods } from './db-vehicle-types'
import { vehicleMethods } from './db-vehicles'
import { seededRandom } from './qr-token'
import { buildSeed } from './seed'
import { shiftSeedTimes } from './seed-shift'
import type { MockDb, MockDbOptions } from './types'

/** Hạt giống mã QR của kiện mới khi nơi gọi không truyền `random`: test tất định. */
const QR_SEED = 20_260_927

/**
 * Tạo một kho mới đã nạp seed neo theo `today` (D-44). Mỗi kho giữ dữ liệu và phiên riêng. Kho mới chưa có phiên: không lọc theo công
 * ty cho tới khi `authenticate` / `restoreSession` đặt phiên (`tenancy.ts`).
 */
export function createMockDb({ latencyMs = 0, today = SEED_ANCHOR_DATE, now = () => new Date(), random }: MockDbOptions = {}): MockDb {
  // Mở app trước giờ của các việc "hôm nay" trong seed thì lùi mốc giờ seed, không để lịch sử có sự kiện ở tương lai
  const seed = shiftSeedTimes(buildSeed(today), now())
  const state: DbState = {
    vehicles: new Map(seed.vehicles.map((vehicle) => [vehicle.id, vehicle])),
    vehicleCompany: new Map(seed.vehicleCompany),
    maintenance: new Map(seed.maintenance),
    trips: new Map(seed.trips.map((trip) => [trip.id, trip])),
    revisions: new Map(seed.revisions.map((revision) => [revision.id, revision])),
    users: new Map(seed.users.map((user) => [user.id, user])),
    passwords: new Map(seed.passwords),
    events: seed.events,
    session: { userId: null },
    companies: new Map(seed.companies.map((company) => [company.id, company])),
    packageTypes: new Map(seed.packageTypes.map((type) => [type.id, type])),
    packages: new Map(seed.packages.map((pkg) => [pkg.id, pkg])),
    tripPackageLinks: new Map(seed.tripPackageLinks),
    requirements: new Map(seed.requirements.map((requirement) => [requirement.id, requirement])),
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
    ...packageMethods(ctx),
    ...requirementMethods(ctx),
    ...tripPoolMethods(ctx),
    ...segregationMethods(ctx),
    ...routeMethods(ctx),
    ...vehicleTypeMethods(ctx),
    ...scanMethods(ctx),
  }
}
