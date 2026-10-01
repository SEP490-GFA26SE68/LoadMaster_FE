import { latestApproved, missingIds, plannedStops, tripStatus, tripSubStatus, type Revision, type Trip } from '@/lib/mock-db'
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
  /** Dòng phụ dưới chip (FE-0-05): phương án đã duyệt, kho đang xếp hoặc đã xếp xong. */
  readonly sub: TripSubStatus | null
  readonly stopCount: number
  /** Kiện của phương án trừ kiện kho báo thiếu — số kiện trên xe (hoặc sẽ lên xe). */
  readonly packageCount: number
  /** Đang vận chuyển: điểm chưa hoàn tất đầu tiên. */
  readonly currentStop: number | undefined
  /** Đã giao: thời điểm giao xong (ISO 8601). */
  readonly completedAt: string | undefined
  readonly issueCount: number
}

export type MyTrips = {
  /** Đang vận chuyển, hoặc kho đã xếp xong — tài xế mở được. */
  readonly ready: readonly MyTripRow[]
  /** Phương án đã duyệt, kho chưa xếp xong — hiện để tài xế biết, chưa mở được. */
  readonly preparing: readonly MyTripRow[]
  /** Đã giao gần đây, mới nhất trước. */
  readonly recent: readonly MyTripRow[]
}

/** Số chuyến hoàn thành gần đây hiện ở danh sách. */
export const RECENT_LIMIT = 5

/** Tài xế chỉ thấy chuyến gán cho mình; quản trị viên (vai trò khác có quyền mở màn tài xế) thấy mọi chuyến (D-46). */
export function isVisibleTo(trip: Pick<Trip, 'driverId'>, viewer: Pick<User, 'id' | 'role'>): boolean {
  return viewer.role !== 'driver' || trip.driverId === viewer.id
}

/** Phương án tài xế làm theo: bản kho đã xếp (chốt lúc bắt đầu xếp); kho chưa bắt đầu thì bản duyệt mới nhất. */
export function driverPlan<R extends Pick<Revision, 'id' | 'approvedAt'>>(trip: Pick<Trip, 'loading'>, revisions: readonly R[]): R | undefined {
  const loadedWith = trip.loading?.revisionId
  return loadedWith === undefined ? latestApproved(revisions) : revisions.find((revision) => revision.id === loadedWith)
}

/** Chuyến tài xế mở được: đang vận chuyển, hoặc kho đã xếp xong. */
export function isReadyToDrive(row: Pick<MyTripRow, 'status' | 'sub'>): boolean {
  return row.status === 'IN_TRANSIT' || row.sub?.kind === 'loaded'
}

/** Chuyến kho đang chuẩn bị: phương án đã duyệt (còn hiệu lực) chờ kho xếp, hoặc kho đang xếp — tài xế thấy nhưng chưa mở được. */
export function isPreparing(row: Pick<MyTripRow, 'sub'>): boolean {
  return row.sub?.kind === 'approved' || row.sub?.kind === 'loading'
}

/** Thứ tự trong nhóm (đang làm trước): đang vận chuyển, đã xếp xong, kho đang xếp, chờ kho xếp. */
function stage(row: Pick<MyTripRow, 'status' | 'sub'>): number {
  if (row.status === 'IN_TRANSIT') return 0
  if (row.sub?.kind === 'loaded') return 1
  return row.sub?.kind === 'loading' ? 2 : 3
}

function row(trip: Trip, plan: Revision, revisions: readonly Revision[], vehicleNames: ReadonlyMap<string, string>): MyTripRow {
  const total = plannedStops(plan).size
  return {
    id: trip.id,
    name: trip.name,
    scheduledDate: trip.scheduledDate,
    vehicleName: vehicleNames.get(trip.vehicleId) ?? trip.vehicleId,
    status: tripStatus(trip, revisions),
    sub: tripSubStatus(trip, revisions),
    stopCount: trip.stops.length,
    packageCount: total - missingIds(trip).size,
    currentStop: trip.delivery?.stops.find((stop) => stop.completedAt === undefined)?.number,
    completedAt: trip.delivery?.completedAt,
    issueCount: trip.delivery?.issues.length ?? 0,
  }
}

/** Theo giai đoạn (đang làm trước), rồi ngày chạy sớm trước, rồi mã chuyến. */
function byStageThenDate(a: MyTripRow, b: MyTripRow): number {
  return stage(a) - stage(b) || a.scheduledDate.localeCompare(b.scheduledDate) || a.id.localeCompare(b.id)
}

/**
 * "Chuyến của tôi" (LM-087): chuyến người xem được thấy, chia ba nhóm. Chuyến có phương án chờ duyệt hoặc lỗi thời và chuyến đã
 * huỷ không hiện — tài xế không làm gì được với chúng.
 */
export function myTrips(entries: readonly TripRevisions[], vehicleNames: ReadonlyMap<string, string>, viewer: Pick<User, 'id' | 'role'>): MyTrips {
  const ready: MyTripRow[] = []
  const preparing: MyTripRow[] = []
  const recent: MyTripRow[] = []
  for (const { trip, revisions } of entries) {
    if (!isVisibleTo(trip, viewer)) continue
    const plan = driverPlan(trip, revisions)
    if (!plan) continue
    const item = row(trip, plan, revisions, vehicleNames)
    if (isReadyToDrive(item)) ready.push(item)
    else if (isPreparing(item)) preparing.push(item)
    else if (item.status === 'DELIVERED') recent.push(item)
  }
  return {
    ready: ready.toSorted(byStageThenDate),
    preparing: preparing.toSorted(byStageThenDate),
    recent: recent.toSorted((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')).slice(0, RECENT_LIMIT),
  }
}
