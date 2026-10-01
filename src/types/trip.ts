/**
 * Trạng thái chuyến hiển thị và dùng để lọc/nhóm (FE-0-05, D-81): sáu trạng thái của backend, theo thứ tự vòng đời. Phương án chờ
 * duyệt / đã duyệt / lỗi thời và tiến độ kho là dòng phụ (`TripSubStatus`), không phải trạng thái.
 */
export const TRIP_STATUSES = ['DRAFT', 'PLANNED', 'LOADING', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'] as const

export type TripStatus = (typeof TRIP_STATUSES)[number]

/**
 * Dòng phụ dưới chip trạng thái (FE-0-05, PRD v2 mục 7.1). Dưới `PLANNED`: phương án đang hiển thị chờ duyệt, đã duyệt, hoặc lỗi thời
 * (cần tối ưu lại). Dưới `LOADING`: kho đang xếp (đã ghi / tổng kiện của phương án kho xếp theo), hoặc đã xếp xong chờ xe xuất phát.
 * Dòng phụ của luồng chưa làm (tối ưu tuyến, soạn hàng, giám sát) thêm ở issue của luồng đó.
 */
export type TripSubStatus =
  | { readonly kind: 'awaitingApproval' }
  | { readonly kind: 'approved' }
  | { readonly kind: 'stale' }
  | { readonly kind: 'loading'; readonly recorded: number; readonly total: number }
  | { readonly kind: 'loaded' }
