/**
 * Lần chạy tối ưu (luồng 3 Review 1, LM-104; ba phương án ứng viên mỗi lần chạy, FE-5b-05): mục tiêu của từng phương án, thuật toán đã
 * chạy, trạng thái và lý do lần chạy không ra kết quả. Mã do kho lưu (`OPTIMIZATION_OBJECTIVES`, `OPTIMIZATION_ALGORITHMS`,
 * `RUN_FAILURE_CODES`), key trùng mã. Dùng ở Thiết lập tối ưu (ô chọn thuật toán, hộp thoại đang chạy, bảng "Lần chạy tối ưu"), So sánh
 * phương án và nhật ký. Tên thuật toán là từ vựng thuật toán — chỉ ở các màn đó; mock chạy dưới tên "EP + DBLF" nên tên đó luôn kèm chữ
 * "(mock)". Hai thuật toán kia bản demo chưa chạy được, nên không kèm.
 */
export const runs = {
  title: 'Lần chạy tối ưu',
  algorithm: 'Thuật toán',
  objectives: {
    MAX_VOLUME: 'Tối đa thể tích',
    AXLE_BALANCE: 'Cân bằng tải trục',
    MIN_REHANDLING: 'Ít dỡ-xếp lại',
  },
  algorithms: {
    EP_DBLF: 'EP + DBLF (mock)',
    EP_DBLF_GA: 'EP + DBLF + GA/SA',
    EP_DBLF_GA_AI: 'EP + DBLF + GA/SA + AI Optimizer',
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
    choice: 'Thiết lập',
    status: 'Kết quả',
    plan: 'Phương án A · B · C',
    approval: 'Duyệt',
  },
  /** Cột "Duyệt": phương án của lần chạy đã duyệt, hoặc đang là bản chờ duyệt của chuyến. */
  approval: {
    approved: 'Đã duyệt',
    pending: 'Chờ duyệt',
  },
  /** Dưới chip "Đã duyệt": phương án nào của lần chạy đã được duyệt. */
  approvedPlans: 'Phương án {labels}',
  limitSeconds: '{seconds} s',
  /** Lần chạy giữ kiện đã ghim (FE-BL-02). */
  pinned: { one: 'Giữ {count} kiện đã ghim', other: 'Giữ {count} kiện đã ghim' },
  seed: 'seed {seed}',
  /** Lần chạy hỏng không có revision nên kho không có thiết lập hay số của nó. */
  noValue: '—',
  /** Một dòng của ô "Phương án": nhãn + mã là liên kết mở Planner, rồi xếp đủ hay còn bao nhiêu kiện chưa xếp. */
  planAllPlaced: 'xếp đủ',
  planUnplaced: { one: '{count} chưa xếp', other: '{count} chưa xếp' },
  openPlan: 'Mở phương án {revision} trong Planner',
  compare: 'So sánh',
  openCompare: 'So sánh các phương án của lần chạy {run}',
} as const
