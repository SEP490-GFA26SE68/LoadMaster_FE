import { expandPackages } from '@/domain/cargo'
import type { VehicleConfig } from '@/domain/models'
import { compareText, isWithinDateRange, matchesQuery } from '@/lib/list-filter'
import { latestApproved, tripManualSubStatus, tripRouteSubStatus, tripStatus, tripSubStatus, type Revision, type Trip, type TripPhase } from '@/lib/mock-db'
import { TRIP_STATUSES, type TripStatus, type TripSubStatus } from '@/types/trip'
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
  /** Dòng phụ dưới chip (FE-0-05): phương án chờ duyệt / đã duyệt / lỗi thời, hoặc tiến độ kho. */
  readonly sub: TripSubStatus | null
  /**
   * Dòng phụ thứ hai, đứng cạnh `sub`: tuyến đã tối ưu có điểm trễ hạn dự kiến (FE-4b-09), hoặc chuyến đang xếp / đang giao còn xác
   * nhận tay chờ duyệt (FE-6-04) — hai việc ở hai pha khác nhau của chuyến.
   */
  readonly extraSub: TripSubStatus | null
  readonly phase: TripPhase
}

/**
 * `revisions` theo thứ tự kho trả (cũ trước). Trạng thái và dòng phụ là `tripStatus`, `tripSubStatus` của kho (D-81): trạng thái suy từ
 * pha vận hành và tuyến đã tối ưu (FE-4b-09), dòng phụ từ revision. Lấp đầy lấy từ revision Planner mở mặc định: bản đã duyệt mới nhất, không có thì bản mới nhất.
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
    status: tripStatus(trip),
    sub: tripSubStatus(trip, revisions),
    extraSub: tripRouteSubStatus(trip) ?? tripManualSubStatus(trip),
    phase: trip.phase,
  }
}

/** Tham số lọc của danh sách chuyến trên URL (D-52), ngoài `q`, `sap-xep`, `trang`, `so-dong` chung. */
export const TRIP_LIST_FILTERS = ['trang-thai', 'tu', 'den', 'xe', 'tai-xe'] as const

export type TripListFilter = (typeof TRIP_LIST_FILTERS)[number]

/** Giá trị lọc "chuyến chưa gán tài xế" của tham số `tai-xe`. */
export const UNASSIGNED_DRIVER = 'chua-gan'

/** Giá trị `trang-thai` trên URL của từng trạng thái (FE-0-05): slug tiếng Việt không dấu như mọi tham số màn danh sách (D-52). */
export const TRIP_STATUS_SLUGS = {
  DRAFT: 'nhap',
  PLANNED: 'da-lap-ke-hoach',
  LOADING: 'dang-xep-hang',
  IN_TRANSIT: 'dang-van-chuyen',
  DELIVERED: 'da-giao',
  CANCELLED: 'da-huy',
} as const satisfies Record<TripStatus, string>

/**
 * Giá trị `trang-thai` của các bản trước còn nằm trong liên kết đã lưu: đọc sang slug mới gần nghĩa nhất để liên kết cũ vẫn lọc
 * được và sáng đúng tab.
 * - LM-104 (sáu trạng thái cũ, hai nhóm tab): đã tối ưu, đã duyệt và hai nhóm "cần xử lý", "sắp chạy" nay đều là Đã lập kế hoạch
 *   (phân biệt bằng dòng phụ); hoàn thành là Đã giao.
 * - Trước LM-104 (mười trạng thái, nhóm "đang thực hiện"): đang xếp hàng và đã xếp xong là Đang xếp hàng.
 */
const LEGACY_STATUS_FILTERS: Readonly<Record<string, string>> = {
  da_toi_uu: TRIP_STATUS_SLUGS.PLANNED,
  da_duyet: TRIP_STATUS_SLUGS.PLANNED,
  dang_van_chuyen: TRIP_STATUS_SLUGS.IN_TRANSIT,
  hoan_thanh: TRIP_STATUS_SLUGS.DELIVERED,
  da_huy: TRIP_STATUS_SLUGS.CANCELLED,
  'can-xu-ly': TRIP_STATUS_SLUGS.PLANNED,
  'sap-chay': TRIP_STATUS_SLUGS.PLANNED,
  'dang-thuc-hien': TRIP_STATUS_SLUGS.IN_TRANSIT,
  dang_giao: TRIP_STATUS_SLUGS.IN_TRANSIT,
  dang_xep_hang: TRIP_STATUS_SLUGS.LOADING,
  da_xep_xong: TRIP_STATUS_SLUGS.LOADING,
  can_xem_lai: TRIP_STATUS_SLUGS.PLANNED,
  dang_toi_uu: TRIP_STATUS_SLUGS.PLANNED,
}

/** Giá trị `trang-thai` trên URL, giá trị cũ đã đọc sang slug mới. */
export function normalizeStatusFilter(value: string): string {
  return LEGACY_STATUS_FILTERS[value] ?? value
}

/**
 * Tab của danh sách theo thứ tự trên dải trời: Tất cả rồi sáu trạng thái theo vòng đời. `key` của tab trạng thái là chính trạng
 * thái (nhãn lấy ở nhánh `status`), `value` là giá trị `trang-thai` trên URL (rỗng là không lọc).
 */
export const TRIP_LIST_TABS = [
  { key: 'all', value: '' },
  ...TRIP_STATUSES.map((status) => ({ key: status, value: TRIP_STATUS_SLUGS[status] })),
] as const satisfies readonly { key: 'all' | TripStatus; value: string }[]

export type TripListTab = (typeof TRIP_LIST_TABS)[number]['key']

function matchesStatus(status: TripStatus, value: string): boolean {
  const filter = normalizeStatusFilter(value)
  return filter === '' || TRIP_STATUS_SLUGS[status] === filter
}

/** Số trên từng tab, đếm trên các dòng truyền vào (màn truyền danh sách đã tìm/lọc mọi thứ trừ trạng thái). */
export function tripTabCounts(rows: readonly TripRow[]): Record<TripListTab, number> {
  const entries = TRIP_LIST_TABS.map(({ key, value }) => [key, rows.filter((row) => matchesStatus(row.status, value)).length])
  return Object.fromEntries(entries) as Record<TripListTab, number>
}

/**
 * Chuyến cần người dùng xử lý: Đã lập kế hoạch mà phương án còn chờ duyệt, hoặc đã lỗi thời (cần tối ưu lại). Là số "cần bạn xử
 * lý" dưới tiêu đề và số hổ phách trên tab Đã lập kế hoạch.
 */
export function needsAction(row: Pick<TripRow, 'sub'>): boolean {
  return row.sub?.kind === 'awaitingApproval' || row.sub?.kind === 'stale'
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
 * Lọc dòng theo từ khoá và bộ lọc của URL: tìm bỏ dấu trên mã, tên, tuyến, xe, tài xế; trạng thái (slug của `TRIP_STATUS_SLUGS`,
 * giá trị cũ đọc qua `normalizeStatusFilter`), khoảng ngày chạy (tính hai đầu), xe và tài xế (`UNASSIGNED_DRIVER` là chưa gán). Giá
 * trị rỗng là không lọc.
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
