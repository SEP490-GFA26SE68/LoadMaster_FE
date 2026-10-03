/**
 * Trạng thái chuyến của `StatusBadge` (LM-070, FE-0-05). Key trùng `TripStatus`: sáu trạng thái của backend.
 * `sub` là dòng phụ (`TripSubStatusTag`): dưới Đã lập kế hoạch là phương án chờ duyệt, đã duyệt, lỗi thời; dưới Đang xếp hàng là
 * tiến độ kho — không phải trạng thái. `lateStops` đứng cạnh dòng phụ của phương án khi tuyến đã tối ưu có điểm tới nơi sau hạn (FE-4b-09).
 */
export const status = {
  DRAFT: 'Nháp',
  PLANNED: 'Đã lập kế hoạch',
  LOADING: 'Đang xếp hàng',
  IN_TRANSIT: 'Đang vận chuyển',
  DELIVERED: 'Đã giao',
  CANCELLED: 'Đã huỷ',
  sub: {
    awaitingApproval: 'Chờ duyệt',
    approved: 'Đã duyệt',
    stale: 'Lỗi thời — cần tối ưu lại',
    /** Đang xếp hàng (FE-6-02): kho đang soạn hàng vào khu chờ; còn kiện kho báo thiếu chờ điều phối viên quyết. */
    staging: 'Đang soạn {recorded} / {total}',
    shortage: 'Thiếu kiện — chờ điều phối',
    loading: 'Đang xếp {recorded} / {total}',
    loaded: 'Xếp xong — chờ xuất phát',
    lateStops: 'Có điểm trễ hạn dự kiến',
    /** Đang xếp hàng / Đang vận chuyển: còn xác nhận tay chờ điều phối viên duyệt (FE-6-04). */
    manualPending: 'Chờ duyệt xác nhận tay ({count})',
  },
} as const
