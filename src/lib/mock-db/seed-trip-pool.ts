import { createDbContext, type DbState } from './db-context'
import { departTripPackages, dropDamagedInstance, releaseTripPackages, settleLoadedPackages, settleStopPackages, stageInstances } from './db-package-progress'
import { syncTripPool } from './db-trip-packages'
import type { Package } from './package-model'
import { seededRandom } from './qr-token'
import type { TripPackageLink } from './review1-status'
import type { Trip } from './types'

/**
 * Kiện kho kiện của các chuyến seed (FE-3b-07): kiện của chuyến seed đều nhập tay, nên mỗi instance là một kiện nguồn `TRIP`. Không
 * dựng tay trạng thái: chạy lại đúng các mốc của chuyến bằng chính hàm của kho (`syncTripPool` lúc lập chuyến, rồi huỷ / soạn hàng /
 * bỏ kiện hỏng / xếp xong / xuất phát / hoàn tất từng điểm) với đồng hồ và người làm của từng mốc — trạng thái, cờ và lịch sử kiện khớp tiến độ chuyến.
 *
 * Mã kiện do `idOf` cấp, **không** theo dạng `PK-NNNN`: `nextId` không tính, mã kế tiếp của kho vẫn là `PK-0089`. Mã QR lấy từ bộ số
 * có hạt giống riêng, không trùng mã của `existing` — mã QR của kiện seed có từ trước không đổi.
 */

/** Hạt giống mã QR của kiện chuyến seed. */
const QR_SEED = 20_260_916

export type TripPoolSeed = { packages: Package[]; tripPackageLinks: [string, TripPackageLink[]][] }

export function seedTripPool(options: {
  trips: readonly Trip[]
  /** Kiện seed đã có (mã QR đã cấp). */
  existing: readonly Package[]
  /** Người lập chuyến `trip` (điều phối viên của công ty). */
  plannerOf: (trip: Trip) => string
  /** Mã kiện thứ `order` (đếm từ 1) của công ty `companyId`. */
  idOf: (companyId: string, order: number) => string
}): TripPoolSeed {
  const { trips, existing, plannerOf, idOf } = options
  const clock = { at: '' }
  const state: DbState = {
    vehicles: new Map(), vehicleCompany: new Map(), maintenance: new Map(), trips: new Map(), revisions: new Map(), users: new Map(),
    passwords: new Map(), events: [], session: { userId: null }, companies: new Map(), packageTypes: new Map(),
    packages: new Map(existing.map((pkg) => [pkg.id, pkg])), tripPackageLinks: new Map(), requirements: new Map(), runs: new Map(),
    vehicleTypes: new Map(), vehicleTypeOf: new Map(), tracking: new Map(), exceptions: new Map(), pickups: new Map(),
    plans: new Map(), subscriptions: new Map(), creditAccounts: new Map(), creditTransactions: new Map(), payments: new Map(),
    supportTickets: new Map(),
  }
  const ctx = createDbContext(state, 0, () => new Date(clock.at), seededRandom(QR_SEED))
  const counts = new Map<string, number>()
  /** Đặt đồng hồ và người làm của mốc sắp chạy. */
  const at = (time: string, actorId: string | null) => {
    clock.at = time
    state.session.userId = actorId
  }

  for (const trip of trips) {
    at(trip.createdAt, plannerOf(trip))
    syncTripPool(ctx, trip, {
      newId: () => {
        const order = (counts.get(trip.companyId) ?? 0) + 1
        counts.set(trip.companyId, order)
        return idOf(trip.companyId, order)
      },
    })
    const { cancellation, loading, delivery } = trip
    if (cancellation) {
      at(cancellation.at, cancellation.by)
      releaseTripPackages(ctx, trip)
    }
    if (loading) {
      at(loading.startedAt, loading.startedBy)
      stageInstances(ctx, trip, new Set(loading.stagedIds))
      for (const step of loading.steps) {
        if (step.outcome !== 'damaged') continue
        at(step.at, loading.startedBy)
        dropDamagedInstance(ctx, trip, step.packageInstanceId)
      }
      if (loading.completedAt !== undefined) {
        at(loading.completedAt, loading.startedBy)
        settleLoadedPackages(ctx, trip)
      }
    }
    if (delivery) {
      at(delivery.startedAt, delivery.startedBy)
      departTripPackages(ctx, trip)
      for (const stop of delivery.stops) {
        if (stop.completedAt === undefined) continue
        at(stop.completedAt, delivery.startedBy)
        settleStopPackages(ctx, trip, stop.number)
      }
    }
  }

  const known = new Set(existing.map((pkg) => pkg.id))
  return {
    packages: [...state.packages.values()].filter((pkg) => !known.has(pkg.id)),
    tripPackageLinks: [...state.tripPackageLinks],
  }
}
