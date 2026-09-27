/**
 * Trạng thái chuyến của `StatusBadge` (LM-070, LM-104). Key trùng `TripStatus`: năm trạng thái của backend cộng Đã huỷ.
 * `sub` là dòng phụ (`TripSubStatusTag`): tiến độ kho và phương án lỗi thời — không phải trạng thái.
 */
export const status = {
  nhap: 'Nháp',
  da_toi_uu: 'Đã tối ưu',
  da_duyet: 'Đã duyệt',
  dang_van_chuyen: 'Đang vận chuyển',
  hoan_thanh: 'Hoàn thành',
  da_huy: 'Đã huỷ',
  sub: {
    stale: 'Lỗi thời — cần tối ưu lại',
    loading: 'Kho đang xếp {recorded} / {total}',
    loaded: 'Đã xếp xong',
  },
} as const
