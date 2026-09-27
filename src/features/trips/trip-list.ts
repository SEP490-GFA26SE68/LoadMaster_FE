import { expandPackages } from '@/domain/cargo'
import type { VehicleConfig } from '@/domain/models'
import { compareText, isWithinDateRange, matchesQuery } from '@/lib/list-filter'
import { latestApproved, tripStatus, tripSubStatus, type Revision, type Trip, type TripPhase } from '@/lib/mock-db'
import type { TripStatus, TripSubStatus } from '@/types/trip'
import type { User } from '@/types/user'

/** Một dòng danh sách chuyến (LM-053, LM-088): mọi giá trị lấy từ kho — chuyến, xe, tài xế và revision. */
export type TripRow = {
  readonly id: string
  readonly name: string
  /** Ngày chạy `YYYY-MM-DD` (D-46). */
  readonly scheduledDate: string
  readonly vehicleId: string
  readonly vehicleName: string
  readonly driverId: string | null
  /** `null` khi chưa gán tài xế (hoặc tài khoản không còn trong kho). */
  readonly driverName: string | null
  /** Tên điểm giao theo thứ tự giao */
  readonly route: string
  /** Số kiện sau khi mở rộng `quantity` */
  readonly packageCount: number
  /** Số điểm giao của chuyến */
  readonly stopCount: number
  /** Tỷ lệ thể tích của revision Planner mở mặc định; `null` khi chưa tối ưu */
  readonly volumePercent: number | null
  readonly status: TripStatus
  /** Dòng phụ dưới chip: tiến độ kho hoặc phương án lỗi thời (LM-104). */
  readonly sub: TripSubStatus | null
  readonly phase: TripPhase
}

/**
 * `revisions` theo thứ tự kho trả (cũ trước). Trạng thái là `tripStatus` của kho (D-45): pha vận hành, riêng pha lập kế hoạch
 * suy từ revision. Lấp đầy lấy từ revision Planner mở mặc định: bản đã duyệt mới nhất, không có thì bản mới nhất.
 */
export function tripRow(
  trip: Trip,
  vehicle: Pick<VehicleConfig, 'name'> | undefined,
  revisions: readonly Revision[],
  driver?: Pick<User, 'fullName'>,
): TripRow {
  const shown = latestApproved(revisions) ?? revisions.at(-1)
  return {
    id: trip.id,
    name: trip.name,
    scheduledDate: trip.scheduledDate,
    vehicleId: trip.vehicleId,
    vehicleName: vehicle?.name ?? '',
    driverId: trip.driverId,
    driverName: driver?.fullName ?? null,
    route: trip.stops.map((stop) => stop.name).join(' → '),
    packageCount: expandPackages(trip.packages).instances.length,
    stopCount: trip.stops.length,
    volumePercent: shown ? shown.result.metrics.volumeUtilizationPercent : null,
    status: tripStatus(trip, revisions),
    sub: tripSubStatus(trip, revisions),
    phase: trip.phase,
  }
}

/** Tham số lọc của danh sách chuyến trên URL (D-52), ngoài `q`, `sap-xep`, `trang`, `so-dong` chung. */
export const TRIP_LIST_FILTERS = ['trang-thai', 'tu', 'den', 'xe', 'tai-xe'] as const

export type TripListFilter = (typeof TRIP_LIST_FILTERS)[number]

/** Giá trị lọc "chuyến chưa gán tài xế" của tham số `tai-xe`. */
export const UNASSIGNED_DRIVER = 'chua-gan'

/**
 * Nhóm trạng thái của tab trên dải trời (V2.3 `ChuyenHang.jpg`, LM-104). Giá trị `trang-thai` trên URL là một trạng thái đơn hoặc slug
 * nhóm:
 * - cần xử lý: đã tối ưu chờ quản lý duyệt, gồm cả phương án lỗi thời cần tối ưu lại (cũng là Đã tối ưu, kèm dòng phụ);
 * - sắp chạy: đã duyệt, xe chưa rời kho — kể cả khi kho đang xếp hoặc đã xếp xong (dòng phụ nói tiến độ kho).
 * Đang vận chuyển, hoàn thành và đã huỷ là trạng thái đơn. Nháp chỉ nằm ở Tất cả.
 */
export const TRIP_STATUS_GROUPS = {
  review: ['da_toi_uu'],
  upcoming: ['da_duyet'],
} as const satisfies Record<string, readonly TripStatus[]>

export type TripStatusGroup = keyof typeof TRIP_STATUS_GROUPS

/** Slug nhóm trên URL, tiếng Việt không dấu như mọi tham số màn danh sách (D-52). */
export const TRIP_STATUS_GROUP_SLUGS = {
  review: 'can-xu-ly',
  upcoming: 'sap-chay',
} as const satisfies Record<TripStatusGroup, string>

/**
 * Giá trị `trang-thai` của bản trước LM-104 (mười trạng thái, nhóm "đang thực hiện") còn nằm trong liên kết đã lưu: đọc sang giá trị
 * mới gần nghĩa nhất để liên kết cũ vẫn lọc được và sáng đúng tab.
 */
const LEGACY_STATUS_FILTERS: Readonly<Record<string, string>> = {
  'dang-thuc-hien': 'dang_van_chuyen',
  dang_giao: 'dang_van_chuyen',
  dang_xep_hang: TRIP_STATUS_GROUP_SLUGS.upcoming,
  da_xep_xong: TRIP_STATUS_GROUP_SLUGS.upcoming,
  can_xem_lai: TRIP_STATUS_GROUP_SLUGS.review,
  dang_toi_uu: TRIP_STATUS_GROUP_SLUGS.review,
}

/** Giá trị `trang-thai` trên URL, giá trị cũ đã đọc sang giá trị mới. */
export function normalizeStatusFilter(value: string): string {
  return LEGACY_STATUS_FILTERS[value] ?? value
}

/**
 * Tab của danh sách theo thứ tự trên dải trời; `value` là giá trị `trang-thai` trên URL (rỗng là không lọc). Đang vận chuyển,
 * hoàn thành và đã huỷ là trạng thái đơn, giữ mã trạng thái như khi lọc một trạng thái bằng URL.
 */
export const TRIP_LIST_TABS = [
  { key: 'all', value: '' },
  { key: 'review', value: TRIP_STATUS_GROUP_SLUGS.review },
  { key: 'upcoming', value: TRIP_STATUS_GROUP_SLUGS.upcoming },
  { key: 'transit', value: 'dang_van_chuyen' },
  { key: 'completed', value: 'hoan_thanh' },
  { key: 'cancelled', value: 'da_huy' },
] as const satisfies readonly { key: string; value: string }[]

export type TripListTab = (typeof TRIP_LIST_TABS)[number]['key']

function matchesStatus(status: TripStatus, value: string): boolean {
  const filter = normalizeStatusFilter(value)
  if (filter === '') return true
  const group = (Object.keys(TRIP_STATUS_GROUP_SLUGS) as TripStatusGroup[]).find((key) => TRIP_STATUS_GROUP_SLUGS[key] === filter)
  return group ? (TRIP_STATUS_GROUPS[group] as readonly TripStatus[]).includes(status) : status === filter
}

/** Số trên từng tab, đếm trên các dòng truyền vào (màn truyền danh sách đã tìm/lọc mọi thứ trừ trạng thái). */
export function tripTabCounts(rows: readonly TripRow[]): Record<TripListTab, number> {
  const entries = TRIP_LIST_TABS.map(({ key, value }) => [key, rows.filter((row) => matchesStatus(row.status, value)).length])
  return Object.fromEntries(entries) as Record<TripListTab, number>
}

/** Số chuyến của từng ngày chạy — số ở dòng nhóm, đếm trên cả danh sách đã lọc chứ không riêng trang đang xem. */
export function tripsPerDate(rows: readonly TripRow[]): ReadonlyMap<string, number> {
  const counts = new Map<string, number>()
  for (const row of rows) counts.set(row.scheduledDate, (counts.get(row.scheduledDate) ?? 0) + 1)
  return counts
}

/** "Hyundai HD210 · 60C-446.32" → tên và biển số (kho ghép hai phần bằng " · "); tên không có biển số thì `plate` rỗng. */
export function splitVehicleName(name: string): { model: string; plate: string } {
  const cut = name.lastIndexOf(' · ')
  return cut === -1 ? { model: name, plate: '' } : { model: name.slice(0, cut), plate: name.slice(cut + 3) }
}

/**
 * Lọc dòng theo từ khoá và bộ lọc của URL: tìm bỏ dấu trên mã, tên, tuyến, xe, tài xế; trạng thái hoặc nhóm trạng thái, khoảng
 * ngày chạy (tính hai đầu), xe và tài xế (`UNASSIGNED_DRIVER` là chưa gán). Giá trị rỗng là không lọc.
 */
export function filterTripRows(
  rows: readonly TripRow[],
  query: string,
  filters: Readonly<Record<TripListFilter, string>>,
): TripRow[] {
  const { 'trang-thai': status, tu: from, den: to, xe: vehicleId, 'tai-xe': driverId } = filters
  return rows.filter((row) =>
    matchesQuery([row.id, row.name, row.route, row.vehicleName, row.driverName], query)
    && matchesStatus(row.status, status)
    && isWithinDateRange(row.scheduledDate, from, to)
    && (vehicleId === '' || row.vehicleId === vehicleId)
    && (driverId === '' || (driverId === UNASSIGNED_DRIVER ? row.driverId === null : row.driverId === driverId)))
}

export type FilterOption = { readonly value: string; readonly label: string }

/** Xe và tài xế có trong danh sách, sắp theo tên tiếng Việt — lựa chọn của bộ lọc không bao giờ dẫn tới bảng rỗng vô cớ. */
export function tripFilterOptions(rows: readonly TripRow[]): { vehicles: FilterOption[]; drivers: FilterOption[] } {
  const vehicles = new Map<string, string>()
  const drivers = new Map<string, string>()
  for (const row of rows) {
    vehicles.set(row.vehicleId, row.vehicleName || row.vehicleId)
    if (row.driverId !== null) drivers.set(row.driverId, row.driverName ?? row.driverId)
  }
  const sorted = (entries: Map<string, string>) =>
    [...entries].map(([value, label]) => ({ value, label })).sort((a, b) => compareText(a.label, b.label))
  return { vehicles: sorted(vehicles), drivers: sorted(drivers) }
}
