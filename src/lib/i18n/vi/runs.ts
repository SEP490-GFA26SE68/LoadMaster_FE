/**
 * Lần chạy tối ưu (luồng 3 Review 1, LM-104): mục tiêu, thuật toán, trạng thái và lý do lần chạy không ra kết quả. Mã do kho lưu
 * (`OPTIMIZATION_OBJECTIVES`, `OPTIMIZATION_ALGORITHMS`, `RUN_FAILURE_CODES`), key trùng mã. Dùng ở Thiết lập tối ưu (chọn và bảng
 * "Lần chạy tối ưu") và nhật ký. Tên thuật toán là từ vựng thuật toán — chỉ ở màn so sánh / thiết lập nâng cao.
 */
export const runs = {
  title: 'Lần chạy tối ưu',
  objective: 'Mục tiêu',
  algorithm: 'Thuật toán',
  objectives: {
    MAX_VOLUME: 'Tối đa thể tích',
    AXLE_BALANCE: 'Cân bằng tải trục',
  },
  algorithms: {
    EP_DBLF: 'EP + DBLF',
    GENETIC_ALGORITHM: 'Di truyền (GA)',
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
  /** Bảng "Lần chạy tối ưu" ở Thiết lập tối ưu. */
  columns: {
    at: 'Thời điểm',
    runner: 'Người chạy',
    choice: 'Mục tiêu · thuật toán',
    limits: 'Giới hạn · seed',
    status: 'Kết quả',
    plan: 'Phương án',
    approval: 'Duyệt',
  },
  /** Cột "Duyệt": phương án của lần chạy đã duyệt, hoặc đang là bản chờ duyệt của chuyến. */
  approval: {
    approved: 'Đã duyệt',
    pending: 'Chờ duyệt',
  },
  limitSeconds: '{seconds} s',
  seed: 'seed {seed}',
  /** Lần chạy hỏng không có revision nên kho không có thiết lập hay số của nó. */
  noValue: '—',
  planMetrics: 'Thể tích {volume} · tải {payload}',
  unplaced: { one: '{count} kiện chưa xếp', other: '{count} kiện chưa xếp' },
  allPlaced: 'Xếp đủ {count} kiện',
  openPlan: 'Mở phương án {revision} trong Planner',
} as const
