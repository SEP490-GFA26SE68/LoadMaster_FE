/** Đơn hàng `/don-hang` (luồng 2 Review 1, LM-104). `status` key trùng `ORDER_STATUSES` của kho. */
export const orders = {
  title: 'Đơn hàng',
  count: { one: '{count} đơn hàng', other: '{count} đơn hàng' },
  pendingCount: { one: '{count} đơn chờ gán vào chuyến', other: '{count} đơn chờ gán vào chuyến' },
  empty: 'Chưa có đơn hàng nào.',
  status: {
    pending: 'Chờ gán chuyến',
    assigned: 'Đã gán chuyến',
    delivered: 'Đã giao',
    cancelled: 'Đã huỷ',
  },
} as const
