import type { CargoPackage, VehicleConfig } from '@/domain/models'
import type { User } from '@/types/user'
import type { AuditEvent } from './audit'
import { addDays, vnTime } from './clock'
import { nextEventId } from './db-context'
import { LONG_BINH_DEPOT, SEED_DEPARTURE_TIME } from './seed-depots'
import { CARGO, CUSTOMERS } from './seed-directory'
import type { TripPackageLink } from './review1-status'
import { PHUONG_NAM_DISPATCHER, seedPhuongNam } from './seed-phuong-nam'
import { seedPlanner, withSeedRoute, type SeedPlanner } from './seed-plan'
import { seedDelivery, seedLoading, type SeedEvent } from './seed-progress'
import { seedPickups } from './seed-pickups'
import { seedTrip } from './seed-trip'
import { seedTripPool } from './seed-trip-pool'
import { MAINTENANCE_SPEC, SEED_ADMIN, SEED_DISPATCHER, TRIP_SPECS, type TripSpec } from './seed-trips'
import { LONG_BINH, PHUONG_NAM, SEED_PASSWORD, seedUsers } from './seed-users'
import { seedVehicles } from './seed-vehicles'
import { auditEventCompany } from './tenancy'
import { tripChangeParams } from './trip-changes'
import { seedSourcing, type SourcingSeed } from './seed-sourcing'
import { DEFAULT_RUN_ALGORITHM, type OptimizationRun } from './source-types'
import type { PickupRequest } from './pickup-model'
import type { Revision, Trip } from './types'

export type SeedData = {
  vehicles: VehicleConfig[]
  /** Xe → công ty (D-64): lưu ngoài `VehicleConfig` (D-04). */
  vehicleCompany: [string, string][]
  maintenance: [string, { note: string; since: string }][]
  users: User[]
  passwords: [string, string][]
  /** Chuyến chính trước — màn nào chưa chọn chuyến thì mở chuyến này (thứ tự tạo của kho). */
  trips: Trip[]
  revisions: Revision[]
  events: AuditEvent[]
  /** Lần chạy tối ưu (LM-104): mỗi chuyến đã tối ưu một lần chạy xong (ba phương án ứng viên), cộng một lần hỏng của chuyến chính. */
  runs: OptimizationRun[]
  /** Chuyến → kiện kho kiện của từng dòng kiện nhập tay (FE-3b-07). */
  tripPackageLinks: [string, TripPackageLink[]][]
  /** Yêu cầu nhận dọc đường (FE-7-01): một yêu cầu chờ duyệt trên chuyến đang vận chuyển của Long Bình. */
  pickups: PickupRequest[]
} & SourcingSeed

const cache = new Map<string, SeedData>()

/**
 * Seed của kho neo theo ngày `today` (D-44). Tất định: cùng ngày neo cho cùng dữ liệu. Dựng một lần mỗi ngày neo (chạy mock
 * optimization cho 14 chuyến của Long Bình và 1 chuyến của Phương Nam) rồi nhân bản cho từng kho.
 *
 * Hai công ty (D-64): mọi dữ liệu có từ trước thuộc Long Bình (`LOG-001`); Phương Nam (`LOG-002`) có bộ nhỏ riêng ở
 * `seed-phuong-nam.ts`, nối **sau** dữ liệu của Long Bình nên thứ tự và mã của Long Bình không đổi.
 */
export function buildSeed(today: string): SeedData {
  let seed = cache.get(today)
  if (!seed) {
    seed = createSeed(today)
    cache.set(today, seed)
  }
  return structuredClone(seed)
}

function createSeed(today: string): SeedData {
  const vehicles = seedVehicles()
  const events: SeedEvent[] = []
  const revisions: Revision[] = []
  const runs: OptimizationRun[] = []
  const runId = (order: number) => `RUN-${String(order).padStart(3, '0')}`
  const plan = seedPlanner({
    vehicles, actorId: SEED_DISPATCHER, revisions, runs, events, runId,
    revisionId: (order) => `REV-${String(order).padStart(3, '0')}`,
  })

  // Chuyến chính: ba phương án ứng viên tối ưu 08:30 (REV-001 là bản ít dỡ-xếp lại), REV-002 duyệt 09:00 ngày neo — giữ đúng mã và
  // thời điểm của seed trước đợt 6
  // Tuyến tối ưu 08:15, trước lần chạy tối ưu xếp hàng đầu tiên
  const hero = withSeedRoute(seedTrip(today), vnTime(today, '08:15'), SEED_DISPATCHER)
  events.push({ at: hero.createdAt, actorId: SEED_DISPATCHER, action: 'trip.created', target: { type: 'trip', id: hero.id }, params: { name: hero.name } })
  // Lịch sử lần chạy của chuyến chính (LM-104): lần đầu service không phản hồi; lần sau ra ba phương án ứng viên, REV-001 là bản được duyệt
  const failedAt = vnTime(today, '08:20')
  runs.push({ id: runId(runs.length + 1), tripId: hero.id, algorithm: DEFAULT_RUN_ALGORITHM, status: 'FAILED', at: failedAt, by: SEED_DISPATCHER, failureCode: 'SERVICE_UNAVAILABLE' })
  events.push({ at: failedAt, actorId: SEED_DISPATCHER, action: 'optimization.failed', target: { type: 'trip', id: hero.id }, params: { algorithm: DEFAULT_RUN_ALGORITHM, reasonCode: 'SERVICE_UNAVAILABLE' } })
  plan(hero, 20_260_914, { optimized: vnTime(today, '08:30'), approved: vnTime(today, '09:00') })
  const trips = [hero, ...TRIP_SPECS.map((spec, index) => seedTripFrom(spec, index, today, plan, events))]

  events.push({
    at: vnTime(addDays(today, -MAINTENANCE_SPEC.daysAgo), MAINTENANCE_SPEC.time), actorId: SEED_DISPATCHER, action: 'vehicle.maintenanceOn',
    target: { type: 'vehicle', id: MAINTENANCE_SPEC.vehicleId }, params: { note: MAINTENANCE_SPEC.note },
  })
  const users = seedUsers(today)
  events.push(...accountEvents(today, users))
  const sourcing = seedSourcing(today, events)
  // Phương Nam nối sau cùng: sự kiện trùng giờ vẫn đứng sau của Long Bình, mã QR không trùng mã đã cấp
  const phuongNam = seedPhuongNam(today, new Set(sourcing.packages.map((pkg) => pkg.qrToken)))
  events.push(...phuongNam.events)

  // Kiện của mọi chuyến seed đều nhập tay: mỗi instance là một kiện kho kiện nguồn `TRIP`, trạng thái theo tiến độ chuyến (FE-3b-07).
  // Đứng trước kiện có từ trước trong kho: bảng kho kiện (mới nhất trước) vẫn mở đầu bằng PK-0088
  const sourced = [...sourcing.packages, ...phuongNam.packages]
  const tripPool = seedTripPool({
    trips: [...trips, ...phuongNam.trips],
    existing: sourced,
    plannerOf: (trip) => (trip.companyId === PHUONG_NAM ? PHUONG_NAM_DISPATCHER : SEED_DISPATCHER),
    idOf: (companyId, order) => (companyId === PHUONG_NAM ? `PK-PN-T${String(order).padStart(4, '0')}` : `PK-T${String(order).padStart(5, '0')}`),
  })

  // Công ty của sự kiện theo cùng luật với `ctx.log` (`auditEventCompany`): sự kiện về một tài khoản thuộc công ty của tài khoản đó,
  // sự kiện khác thuộc công ty của người làm — tài khoản nền tảng không thuộc công ty nào
  const userById = new Map(users.map((user) => [user.id, user]))
  const actorCompany = (actorId: string | null) => (actorId === null ? null : (userById.get(actorId)?.companyId ?? null))
  return {
    vehicles: [...vehicles, ...phuongNam.vehicles],
    vehicleCompany: [
      ...vehicles.map((vehicle): [string, string] => [vehicle.id, LONG_BINH]),
      ...phuongNam.vehicles.map((vehicle): [string, string] => [vehicle.id, PHUONG_NAM]),
    ],
    maintenance: [[MAINTENANCE_SPEC.vehicleId, { note: MAINTENANCE_SPEC.note, since: vnTime(addDays(today, -MAINTENANCE_SPEC.daysAgo), MAINTENANCE_SPEC.time) }]],
    users,
    passwords: users.map((user) => [user.id, SEED_PASSWORD]),
    trips: [...trips, ...phuongNam.trips],
    revisions: [...revisions, ...phuongNam.revisions],
    runs: [...runs, ...phuongNam.runs],
    companies: sourcing.companies,
    packageTypes: [...sourcing.packageTypes, ...phuongNam.packageTypes],
    packages: [...tripPool.packages, ...sourced],
    tripPackageLinks: tripPool.tripPackageLinks,
    pickups: seedPickups(today),
    requirements: [...sourcing.requirements, ...phuongNam.requirements],
    vehicleTypes: [...sourcing.vehicleTypes, ...phuongNam.vehicleTypes],
    vehicleTypeOf: [...sourcing.vehicleTypeOf, ...phuongNam.vehicleTypeOf],
    events: events
      .toSorted((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
      .map((event, index) => ({
        ...event, id: nextEventId(index), params: event.params ?? {},
        companyId: auditEventCompany(userById, event.target, actorCompany(event.actorId)),
      })),
  }
}

/** Chuyến seed theo kết cục của spec: tối ưu, duyệt, rồi tiến độ kho/giao hoặc huỷ; sự kiện ghi vào `events`. */
function seedTripFrom(spec: TripSpec, index: number, today: string, plan: SeedPlanner, events: SeedEvent[]): Trip {
  const day = addDays(today, spec.day)
  const at = (offset: number, time: string) => vnTime(addDays(day, offset), time)
  const minute = String(10 + index * 3).padStart(2, '0')
  const packages: CargoPackage[] = spec.lines.map(([key, quantity, deliveryStop], line) => ({
    ...CARGO[key], id: `PKG-${String(line + 1).padStart(3, '0')}`, quantity, deliveryStop,
  }))
  let trip: Trip = {
    id: spec.id, companyId: LONG_BINH, name: spec.name, vehicleId: spec.vehicleId, scheduledDate: day, departureAt: vnTime(day, SEED_DEPARTURE_TIME),
    depot: LONG_BINH_DEPOT, driverId: spec.driverId, phase: 'planning',
    createdAt: spec.outcome === 'draft' ? vnTime(today, `09:${minute}`) : at(-2, `14:${minute}`), inputVersion: 1,
    stops: spec.stops.map((key, stop) => ({ id: `STOP-${String(stop + 1).padStart(2, '0')}`, ...CUSTOMERS[key] })),
    packages,
  }
  const target = { type: 'trip' as const, id: spec.id }
  events.push({ at: trip.createdAt, actorId: SEED_DISPATCHER, action: 'trip.created', target, params: { name: spec.name } })
  if (spec.outcome === 'draft') return trip

  // Chuyến ngày mai được lập kế hoạch sáng nay; chuyến khác chiều hôm trước
  const planDay = spec.day > 0 ? today : addDays(day, -1)
  // Tối ưu tuyến 15 phút trước khi tối ưu xếp hàng: chuyến đã có phương án là Đã lập kế hoạch (FE-4b-09)
  trip = withSeedRoute(trip, vnTime(planDay, spec.day > 0 ? '10:15' : '15:15'), SEED_DISPATCHER)
  const approved = plan(trip, 20_260_900 + index, {
    optimized: vnTime(planDay, spec.day > 0 ? '10:30' : '15:30'),
    approved: spec.outcome === 'optimized' ? undefined : vnTime(planDay, spec.day > 0 ? '11:00' : '16:00'),
  })
  if (!approved) return trip

  if (spec.outcome === 'stale' && spec.staleEdit) {
    const { line, quantity } = spec.staleEdit
    const edited: Trip = { ...trip, inputVersion: 2, packages: packages.map((pkg, i) => (i === line ? { ...pkg, quantity } : pkg)) }
    // Như `updateTrip`: nhật ký giữ trước → sau của dòng kiện đã sửa (V2.3, quyết định 2)
    const params = { fields: 'packages', ...tripChangeParams(trip, edited, ['packages']) }
    events.push({ at: vnTime(planDay, '11:40'), actorId: SEED_DISPATCHER, action: 'trip.updated', target, params })
    return edited
  }
  if (spec.outcome === 'cancelled') {
    const cancelledAt = at(-1, '18:05')
    events.push({ at: cancelledAt, actorId: SEED_DISPATCHER, action: 'trip.cancelled', target, params: { reason: spec.cancelReason ?? '' } })
    return { ...trip, phase: 'cancelled', cancellation: { at: cancelledAt, by: SEED_DISPATCHER, reason: spec.cancelReason ?? '', fromPhase: 'planning' } }
  }

  trip = { ...trip, ...seedLoading(spec, today, approved, events) }
  if (spec.outcome === 'loading') return { ...trip, phase: 'loading' }
  if (spec.outcome === 'loaded') return { ...trip, phase: 'loaded' }
  return { ...trip, ...seedDelivery(spec, trip, approved, events), phase: spec.outcome === 'delivering' ? 'delivering' : 'completed' }
}

/**
 * Sự kiện tài khoản của seed: quản trị hệ thống tạo 3 tài khoản và khoá một nhân viên kho của Long Bình — lịch sử có từ trước khi công ty
 * có quản trị công ty riêng (FE-0-03); sự kiện thuộc Long Bình vì là việc trên tài khoản của Long Bình. Vài lần đăng nhập sáng ngày neo.
 */
function accountEvents(today: string, users: readonly User[]): SeedEvent[] {
  const user = (id: string) => ({ type: 'user' as const, id })
  const on = (daysAgo: number, time: string) => vnTime(addDays(today, -daysAgo), time)
  const created = (id: string, daysAgo: number, time: string): SeedEvent => {
    const account = users.find((item) => item.id === id)
    if (!account) throw new Error(`Seed thiếu người dùng ${id}`)
    return { at: on(daysAgo, time), actorId: SEED_ADMIN, action: 'user.created', target: user(id), params: { fullName: account.fullName, role: account.role } }
  }
  return [
    created('US-0010', 26, '10:05'),
    created('US-0011', 19, '14:40'),
    { at: on(17, '11:30'), actorId: SEED_ADMIN, action: 'user.locked', target: user('US-0008') },
    created('US-0012', 12, '09:00'),
    // Kho đăng nhập trước khi bắt đầu soạn hàng của các chuyến hôm nay (soạn xong mới xếp từ 04:45)
    { at: on(0, '04:10'), actorId: 'US-0003', action: 'auth.signedIn', target: user('US-0003') },
    { at: on(0, '04:12'), actorId: 'US-0011', action: 'auth.signedIn', target: user('US-0011') },
    { at: on(0, '06:25'), actorId: 'US-0006', action: 'auth.signedIn', target: user('US-0006') },
    { at: on(0, '07:50'), actorId: 'US-0001', action: 'auth.signedIn', target: user('US-0001') },
    { at: on(0, '08:10'), actorId: 'US-0002', action: 'auth.signedIn', target: user('US-0002') },
  ]
}
