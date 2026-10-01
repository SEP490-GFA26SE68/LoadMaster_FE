/**
 * Trạng thái chuyến của `StatusBadge` (LM-070, FE-0-05). Key trùng `TripStatus`: sáu trạng thái của backend.
 * `sub` là dòng phụ (`TripSubStatusTag`): dưới Đã lập kế hoạch là phương án chờ duyệt, đã duyệt, lỗi thời; dưới Đang xếp hàng là
 * tiến độ kho — không phải trạng thái.
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
    loading: 'Đang xếp {recorded} / {total}',
    loaded: 'Xếp xong — chờ xuất phát',
  },
} as const
