import type { CargoPackage, OptimizationRequest, VehicleConfig } from '@/domain/models'
import { runMockOptimization } from '@/services/optimization'
import type { User } from '@/types/user'
import type { AuditEvent } from './audit'
import { addDays, vnTime } from './clock'
import { nextEventId } from './db-context'
import { approvedResult } from './revisions'
import { CARGO, CUSTOMERS } from './seed-directory'
import { seedDelivery, seedLoading, type SeedEvent } from './seed-progress'
import { seedTrip } from './seed-trip'
import { MAINTENANCE_SPEC, SEED_ADMIN, SEED_DISPATCHER, TRIP_SPECS, type TripSpec } from './seed-trips'
import { SEED_PASSWORD, seedUsers } from './seed-users'
import { seedVehicles } from './seed-vehicles'
import { tripChangeParams } from './trip-changes'
import { seedSourcing, type SourcingSeed } from './seed-sourcing'
import { DEFAULT_RUN_SETTINGS, type OptimizationRun } from './source-types'
import type { Revision, Trip } from './types'

export type SeedData = {
  vehicles: VehicleConfig[]
  maintenance: [string, { note: string; since: string }][]
  users: User[]
  passwords: [string, string][]
  /** Chuyến chính trước — màn nào chưa chọn chuyến thì mở chuyến này (thứ tự tạo của kho). */
  trips: Trip[]
  revisions: Revision[]
  events: AuditEvent[]
  /** Lần chạy tối ưu (LM-104): mỗi revision tối ưu một lần chạy xong, cộng một lần hỏng của chuyến chính. */
  runs: OptimizationRun[]
} & SourcingSeed

const cache = new Map<string, SeedData>()

/**
 * Seed của kho neo theo ngày `today` (D-44). Tất định: cùng ngày neo cho cùng dữ liệu. Dựng một lần mỗi ngày neo (chạy mock
 * optimization cho 14 chuyến) rồi nhân bản cho từng kho.
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
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]))
  const events: SeedEvent[] = []
  const revisions: Revision[] = []
  const runs: OptimizationRun[] = []
  const nextRevisionId = () => `REV-${String(revisions.length + 1).padStart(3, '0')}`
  const nextRunId = () => `RUN-${String(runs.length + 1).padStart(3, '0')}`

  /** Một lần tối ưu (và Duyệt) của chuyến: seed ngẫu nhiên cố định, `runtimeMs` = 0 vì không đo lần chạy lúc nạp kho. */
  function plan(trip: Trip, randomSeed: number, times: { optimized: string; approved?: string }): Revision | undefined {
    const vehicle = vehicleById.get(trip.vehicleId)
    if (vehicle === undefined) throw new Error(`Seed thiếu xe ${trip.vehicleId} của chuyến ${trip.id}`)
    const request: OptimizationRequest = {
      vehicle,
      packages: trip.packages,
      settings: { method: 'MOCK', timeLimitSeconds: 30, randomSeed, enforceLifo: true, prioritizeLowCenterOfGravity: false },
    }
    const result = runMockOptimization(request, { clock: () => 0 })
    const optimized: Revision = {
      id: nextRevisionId(), jobId: result.jobId, tripId: trip.id, request, result, inputVersion: trip.inputVersion,
      createdAt: times.optimized, manuallyEdited: false, ordersRecomputed: false, run: { ...DEFAULT_RUN_SETTINGS },
    }
    revisions.push(optimized)
    runs.push({
      id: nextRunId(), tripId: trip.id, ...DEFAULT_RUN_SETTINGS, status: 'COMPLETED', at: times.optimized, by: SEED_DISPATCHER,
      revisionId: optimized.id, jobId: optimized.jobId, placedCount: result.metrics.placedCount, unplacedCount: result.metrics.unplacedCount,
      volumeUtilizationPercent: result.metrics.volumeUtilizationPercent,
    })
    const target = { type: 'trip' as const, id: trip.id }
    events.push({ at: times.optimized, actorId: SEED_DISPATCHER, action: 'optimization.saved', target, params: { revisionId: optimized.id, placed: result.metrics.placedCount, unplaced: result.metrics.unplacedCount } })
    if (times.approved === undefined) return undefined
    const approved: Revision = {
      ...optimized, id: nextRevisionId(), result: approvedResult(request, result, []), createdAt: times.approved,
      draftPatches: [], approvedAt: times.approved, sourceRevisionId: optimized.id, ordersRecomputed: true,
    }
    revisions.push(approved)
    events.push({ at: times.approved, actorId: SEED_DISPATCHER, action: 'revision.approved', target, params: { revisionId: approved.id, sourceRevisionId: optimized.id, edits: 0 } })
    return approved
  }

  // Chuyến chính: REV-001 tối ưu 08:30, REV-002 duyệt 09:00 ngày neo — giữ đúng mã và thời điểm của seed trước đợt 6
  const hero = seedTrip(today)
  events.push({ at: hero.createdAt, actorId: SEED_DISPATCHER, action: 'trip.created', target: { type: 'trip', id: hero.id }, params: { name: hero.name } })
  // Lịch sử lần chạy của chuyến chính (LM-104): lần đầu chọn cân bằng tải trục + GA, service không phản hồi; lần sau ra REV-001
  const failedAt = vnTime(today, '08:20')
  runs.push({ id: nextRunId(), tripId: hero.id, objective: 'AXLE_BALANCE', algorithm: 'GENETIC_ALGORITHM', status: 'FAILED', at: failedAt, by: SEED_DISPATCHER, failureCode: 'SERVICE_UNAVAILABLE' })
  events.push({ at: failedAt, actorId: SEED_DISPATCHER, action: 'optimization.failed', target: { type: 'trip', id: hero.id }, params: { objective: 'AXLE_BALANCE', algorithm: 'GENETIC_ALGORITHM', reasonCode: 'SERVICE_UNAVAILABLE' } })
  plan(hero, 20_260_914, { optimized: vnTime(today, '08:30'), approved: vnTime(today, '09:00') })
  const trips = [hero, ...TRIP_SPECS.map((spec, index) => seedTripFrom(spec, index, today, plan, events))]

  events.push({
    at: vnTime(addDays(today, -MAINTENANCE_SPEC.daysAgo), MAINTENANCE_SPEC.time), actorId: SEED_DISPATCHER, action: 'vehicle.maintenanceOn',
    target: { type: 'vehicle', id: MAINTENANCE_SPEC.vehicleId }, params: { note: MAINTENANCE_SPEC.note },
  })
  const users = seedUsers(today)
  events.push(...accountEvents(today, users))
  const sourcing = seedSourcing(today, events)

  return {
    vehicles,
    maintenance: [[MAINTENANCE_SPEC.vehicleId, { note: MAINTENANCE_SPEC.note, since: vnTime(addDays(today, -MAINTENANCE_SPEC.daysAgo), MAINTENANCE_SPEC.time) }]],
    users,
    passwords: users.map((user) => [user.id, SEED_PASSWORD]),
    trips,
    revisions,
    runs,
    ...sourcing,
    events: events
      .toSorted((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
      .map((event, index) => ({ ...event, id: nextEventId(index), params: event.params ?? {} })),
  }
}

type Plan = (trip: Trip, randomSeed: number, times: { optimized: string; approved?: string }) => Revision | undefined

/** Chuyến seed theo kết cục của spec: tối ưu, duyệt, rồi tiến độ kho/giao hoặc huỷ; sự kiện ghi vào `events`. */
function seedTripFrom(spec: TripSpec, index: number, today: string, plan: Plan, events: SeedEvent[]): Trip {
  const day = addDays(today, spec.day)
  const at = (offset: number, time: string) => vnTime(addDays(day, offset), time)
  const minute = String(10 + index * 3).padStart(2, '0')
  const packages: CargoPackage[] = spec.lines.map(([key, quantity, deliveryStop], line) => ({
    ...CARGO[key], id: `PKG-${String(line + 1).padStart(3, '0')}`, quantity, deliveryStop,
  }))
  let trip: Trip = {
    id: spec.id, name: spec.name, vehicleId: spec.vehicleId, scheduledDate: day, driverId: spec.driverId, phase: 'planning',
    createdAt: spec.outcome === 'draft' ? vnTime(today, `09:${minute}`) : at(-2, `14:${minute}`), inputVersion: 1,
    stops: spec.stops.map((key, stop) => ({ id: `STOP-${String(stop + 1).padStart(2, '0')}`, ...CUSTOMERS[key] })),
    packages,
  }
  const target = { type: 'trip' as const, id: spec.id }
  events.push({ at: trip.createdAt, actorId: SEED_DISPATCHER, action: 'trip.created', target, params: { name: spec.name } })
  if (spec.outcome === 'draft') return trip

  // Chuyến ngày mai được lập kế hoạch sáng nay; chuyến khác chiều hôm trước
  const planDay = spec.day > 0 ? today : addDays(day, -1)
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

  trip = { ...trip, loading: seedLoading(spec, today, approved, events) }
  if (spec.outcome === 'loading') return { ...trip, phase: 'loading' }
  if (spec.outcome === 'loaded') return { ...trip, phase: 'loaded' }
  const delivery = seedDelivery(spec, trip, approved, events)
  return { ...trip, delivery, phase: spec.outcome === 'delivering' ? 'delivering' : 'completed' }
}

/** Sự kiện tài khoản của seed: quản trị tạo 3 tài khoản, khoá một nhân viên kho; vài lần đăng nhập sáng ngày neo. */
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
    { at: on(0, '04:40'), actorId: 'US-0003', action: 'auth.signedIn', target: user('US-0003') },
    { at: on(0, '04:42'), actorId: 'US-0011', action: 'auth.signedIn', target: user('US-0011') },
    { at: on(0, '06:25'), actorId: 'US-0006', action: 'auth.signedIn', target: user('US-0006') },
    { at: on(0, '07:50'), actorId: 'US-0001', action: 'auth.signedIn', target: user('US-0001') },
    { at: on(0, '08:10'), actorId: 'US-0002', action: 'auth.signedIn', target: user('US-0002') },
  ]
}
