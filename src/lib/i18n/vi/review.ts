/**
 * Hàng đợi chờ duyệt `/duyet` và quyết định của quản lý (luồng 4 Review 1, LM-104). `decisions` key trùng `REVIEW_DECISION_KINDS` của
 * kho; nhật ký cũng tra ở đây.
 */
export const review = {
  title: 'Chờ duyệt',
  count: { one: '{count} phương án chờ duyệt', other: '{count} phương án chờ duyệt' },
  empty: 'Không có phương án nào chờ duyệt.',
  decisions: {
    rejected: 'Từ chối',
    reoptimize_requested: 'Yêu cầu tối ưu lại',
    change_vehicle_suggested: 'Đề xuất đổi xe',
    split_trip_suggested: 'Đề xuất tách chuyến',
  },
} as const
