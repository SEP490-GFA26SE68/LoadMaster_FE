
export const warehouseCustomers = {
  title: 'Khách hàng gửi hàng',
  description: 'Theo dõi tiến độ tiếp nhận kiện theo từng yêu cầu giao.',
  requirementCount: '{count} yêu cầu giao',
  requirement: 'Yêu cầu giao #{id}',
  destination: 'Điểm giao: {address}',
  packageCount: '{received} / {expected} kiện',
  receivedCount: 'Đã nhận {count} kiện',
  remaining: 'Còn {count} kiện dự kiến',
  complete: 'Đã nhận đủ số kiện dự kiến',
  exceeded: 'Vượt dự kiến {count} kiện',
  noExpected: 'Không có số kiện dự kiến',
  unknownCustomer: 'Chưa có tên khách hàng',
  loading: 'Đang tải dữ liệu khách hàng...',
  loadError: 'Không tải được dữ liệu',
  empty: 'Chưa có khách hàng nào có yêu cầu giao.',
  status: {
    PENDING: 'Chờ tiếp nhận',
    ASSIGNED: 'Đã gán chuyến',
    IN_TRIP: 'Đang vận chuyển',
  },
} as const
