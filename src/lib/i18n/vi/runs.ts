/**
 * Lần chạy tối ưu (luồng 3 Review 1, LM-104): mục tiêu, thuật toán, trạng thái và lý do lần chạy không ra kết quả. Mã do kho lưu
 * (`OPTIMIZATION_OBJECTIVES`, `OPTIMIZATION_ALGORITHMS`, `RUN_FAILURE_CODES`), key trùng mã. Dùng ở Thiết lập tối ưu, lịch sử lần chạy
 * của chuyến và nhật ký.
 */
export const runs = {
  title: 'Lần chạy tối ưu',
  objective: 'Mục tiêu',
  algorithm: 'Thuật toán',
  objectives: {
    MAX_VOLUME: 'Tận dụng tối đa thể tích',
    AXLE_BALANCE: 'Cân bằng tải trục',
  },
  algorithms: {
    EP_DBLF: 'EP-DBLF (điểm cực, sâu – dưới – trái)',
    GENETIC_ALGORITHM: 'Giải thuật di truyền',
  },
  status: {
    COMPLETED: 'Có kết quả',
    FAILED: 'Không ra kết quả',
  },
  failures: {
    REQUEST_REJECTED: 'Dữ liệu gửi đi bị từ chối',
    SERVICE_UNAVAILABLE: 'Dịch vụ tối ưu không phản hồi',
  },
  count: { one: '{count} lần chạy', other: '{count} lần chạy' },
  empty: 'Chuyến chưa chạy tối ưu lần nào.',
} as const
