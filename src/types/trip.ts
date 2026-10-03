/**
 * Trạng thái chuyến hiển thị và dùng để lọc/nhóm (FE-0-05, D-81): sáu trạng thái của backend, theo thứ tự vòng đời. Phương án chờ
 * duyệt / đã duyệt / lỗi thời và tiến độ kho là dòng phụ (`TripSubStatus`), không phải trạng thái.
 */
export const TRIP_STATUSES = ['DRAFT', 'PLANNED', 'LOADING', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'] as const

export type TripStatus = (typeof TRIP_STATUSES)[number]

/**
 * Dòng phụ dưới chip trạng thái (FE-0-05, PRD v2 mục 7.1). Dưới `PLANNED`: phương án đang hiển thị chờ duyệt, đã duyệt, hoặc lỗi thời
 * (cần tối ưu lại). Dưới `LOADING` (FE-6-02, FE-6-05): kho đang soạn (đã soạn / tổng kiện của phương án kho làm theo), còn kiện báo
 * thiếu chờ điều phối viên quyết, đang xếp (đã ghi / tổng), hoặc đã xếp xong chờ xe xuất phát. Dòng phụ của luồng giám sát thêm ở issue
 * của luồng đó.
 */
export type TripSubStatus =
  | { readonly kind: 'awaitingApproval' }
  | { readonly kind: 'approved' }
  | { readonly kind: 'stale' }
  | { readonly kind: 'staging'; readonly recorded: number; readonly total: number }
  /** Kho báo thiếu `count` kiện lúc soạn, chờ điều phối viên quyết (D-82). */
  | { readonly kind: 'shortage'; readonly count: number }
  | { readonly kind: 'loading'; readonly recorded: number; readonly total: number }
  | { readonly kind: 'loaded' }
  /** Tuyến đã tối ưu có `count` điểm tới nơi sau hạn (FE-4b-09) — đứng cạnh dòng phụ của phương án (`tripRouteSubStatus`). */
  | { readonly kind: 'lateStops'; readonly count: number }
  /**
   * Chuyến đang xếp hoặc đang giao còn `count` xác nhận tay chờ điều phối viên duyệt (FE-6-04, D-83) — đứng cạnh dòng phụ tiến độ
   * (`tripManualSubStatus`).
   */
  | { readonly kind: 'manualPending'; readonly count: number }
