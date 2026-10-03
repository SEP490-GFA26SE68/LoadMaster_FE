import {
  latestApproved,
  missingIds,
  plannedStops,
  rejectedConfirms,
  tripManualSubStatus,
  tripStatus,
  tripSubStatus,
  type Revision,
  type Trip,
} from '@/lib/mock-db'
import type { TripStatus, TripSubStatus } from '@/types/trip'
import type { User } from '@/types/user'

/** Một chuyến và các revision của nó theo thứ tự kho trả (cũ trước). */
export type TripRevisions = { readonly trip: Trip; readonly revisions: readonly Revision[] }

export type MyTripRow = {
  readonly id: string
  readonly name: string
  /** Ngày chạy `YYYY-MM-DD`. */
  readonly scheduledDate: string
  /** Tên xe (có biển số); xe không còn trong kho thì là mã xe. */
  readonly vehicleName: string
  readonly status: TripStatus
  /** Dòng phụ dưới chip (FE-0-05): kho đang xếp hoặc đã xếp xong. */
  readonly sub: TripSubStatus | null
  /** Dòng phụ thứ hai: còn xác nhận tay chờ điều phối viên duyệt (FE-6-04). */
  readonly manualSub: TripSubStatus | null
  readonly stopCount: number
  /** Kiện của phương án trừ kiện kho báo thiếu — số kiện trên xe (hoặc sẽ lên xe). */
  readonly packageCount: number
  /** Đang vận chuyển: điểm chưa hoàn tất đầu tiên. */
  readonly currentStop: number | undefined
  /** Đã giao: thời điểm giao xong (ISO 8601). */
  readonly completedAt: string | undefined
  readonly issueCount: number
  /** Đang vận chuyển: xác nhận tay bị điều phối viên từ chối mà kiện chưa được kiểm lại (FE-6-04). */
  readonly recheck: number
}

/**
 * Nhóm của "Chuyến của tôi" (FE-6-01, PRD v2 mục 8.5), theo trạng thái của backend và dòng phụ; thứ tự ở đây là thứ tự trên màn:
 * - `inTransit`: Đang vận chuyển — giao tiếp;
 * - `loaded`: Đang xếp hàng, dòng phụ "Xếp xong — chờ xuất phát" — mở chuyến để xuất phát;
 * - `preparing`: Đang xếp hàng, kho đang soạn / xếp — chỉ xem;
 * - `recent`: Đã giao, `RECENT_LIMIT` chuyến gần nhất.
 */
export const MY_TRIP_GROUPS = ['inTransit', 'loaded', 'preparing', 'recent'] as const
export type MyTripGroup = (typeof MY_TRIP_GROUPS)[number]

export type MyTrips = Readonly<Record<MyTripGroup, readonly MyTripRow[]>>

/** Số chuyến đã giao gần đây hiện ở danh sách. */
export const RECENT_LIMIT = 5

/**
 * Người xem chỉ thấy chuyến gán cho chính mình (D-46). Luật đóng theo mặc định (FE-0-02): không vai trò nào được thấy hết — chỉ tài xế
 * có `driver.operate` mở được màn này, và chuyến chưa gán tài xế không hiện với ai ở đây.
 */
export function isVisibleTo(trip: Pick<Trip, 'driverId'>, viewer: Pick<User, 'id'>): boolean {
  return trip.driverId === viewer.id
}

/** Phương án tài xế làm theo: bản kho đã xếp (chốt lúc bắt đầu xếp); kho chưa bắt đầu thì bản duyệt mới nhất. */
export function driverPlan<R extends Pick<Revision, 'id' | 'approvedAt'>>(trip: Pick<Trip, 'loading'>, revisions: readonly R[]): R | undefined {
  const loadedWith = trip.loading?.revisionId
  return loadedWith === undefined ? latestApproved(revisions) : revisions.find((revision) => revision.id === loadedWith)
}

/**
 * Nhóm của một chuyến, hoặc `null` khi chuyến không hiện ở "Chuyến của tôi": chuyến Nháp, Đã lập kế hoạch (kho chưa bắt đầu — tài xế
 * chưa có gì để làm) và Đã huỷ.
 */
export function myTripGroup(row: Pick<MyTripRow, 'status' | 'sub'>): MyTripGroup | null {
  if (row.status === 'IN_TRANSIT') return 'inTransit'
  if (row.status === 'DELIVERED') return 'recent'
  if (row.status !== 'LOADING') return null
  return row.sub?.kind === 'loaded' ? 'loaded' : 'preparing'
}

function row(trip: Trip, plan: Revision, revisions: readonly Revision[], vehicleNames: ReadonlyMap<string, string>): MyTripRow {
  const total = plannedStops(plan).size
  const unloaded = new Set(trip.delivery?.stops.flatMap((stop) => stop.unloadedIds))
  return {
    id: trip.id,
    name: trip.name,
    scheduledDate: trip.scheduledDate,
    vehicleName: vehicleNames.get(trip.vehicleId) ?? trip.vehicleId,
    status: tripStatus(trip),
    sub: tripSubStatus(trip, revisions),
    manualSub: tripManualSubStatus(trip),
    stopCount: trip.stops.length,
    packageCount: total - missingIds(trip).size,
    currentStop: trip.delivery?.stops.find((stop) => stop.completedAt === undefined)?.number,
    completedAt: trip.delivery?.completedAt,
    issueCount: trip.delivery?.issues.length ?? 0,
    recheck: trip.phase === 'delivering' ? rejectedConfirms(trip, 'UNLOADING', unloaded).length : 0,
  }
}

/** Ngày chạy sớm trước, rồi mã chuyến. */
function byDate(a: MyTripRow, b: MyTripRow): number {
  return a.scheduledDate.localeCompare(b.scheduledDate) || a.id.localeCompare(b.id)
}

/**
 * "Chuyến của tôi" (LM-087; nhóm theo trạng thái từ FE-6-01): chuyến người xem được thấy, chia theo `MY_TRIP_GROUPS`. Chuyến đã giao
 * mới nhất trước, tối đa `RECENT_LIMIT`.
 */
export function myTrips(entries: readonly TripRevisions[], vehicleNames: ReadonlyMap<string, string>, viewer: Pick<User, 'id'>): MyTrips {
  const groups: Record<MyTripGroup, MyTripRow[]> = { inTransit: [], loaded: [], preparing: [], recent: [] }
  for (const { trip, revisions } of entries) {
    if (!isVisibleTo(trip, viewer)) continue
    const plan = driverPlan(trip, revisions)
    if (!plan) continue
    const item = row(trip, plan, revisions, vehicleNames)
    const group = myTripGroup(item)
    if (group) groups[group].push(item)
  }
  return {
    inTransit: groups.inTransit.toSorted(byDate),
    loaded: groups.loaded.toSorted(byDate),
    preparing: groups.preparing.toSorted(byDate),
    recent: groups.recent.toSorted((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')).slice(0, RECENT_LIMIT),
  }
}
