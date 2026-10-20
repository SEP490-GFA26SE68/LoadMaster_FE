/**
 * Chuông thông báo ở nav rail (LM-098, D-55): sự kiện nhật ký liên quan vai trò. Nhãn từng thông báo là nhãn hành động của nhật ký
 * (`audit.actions.*`), không lặp ở đây.
 */
export const notifications = {
  label: 'Thông báo',
  /** Nhãn đọc của nút chuông khi có thông báo chưa đọc; bắt đầu bằng nhãn nhìn thấy. */
  labelUnread: { one: 'Thông báo, {count} chưa đọc', other: 'Thông báo, {count} chưa đọc' },
  title: 'Thông báo',
  /**
   * Tên vùng toast của sonner (`Toaster containerAriaLabel`, `app/providers.tsx`): vùng `aria-live` nơi toast hiện ra, khác hộp
   * thông báo của chuông. Sonner nối phím tắt vào sau ("… alt+T").
   */
  toastRegion: 'Thông báo tức thời',
  /** Nút đóng của từng toast (`toastOptions.closeButtonAriaLabel`). */
  toastClose: 'Đóng thông báo',
  /** Chip cạnh tiêu đề danh sách (V2.3): số chưa đọc — nút chuông chỉ còn chấm, số nằm ở đây và trong nhãn đọc. */
  unreadCount: { one: '{count} chưa đọc', other: '{count} chưa đọc' },
  markAllRead: 'Đánh dấu đã đọc',
  unread: 'Chưa đọc',
  loading: 'Đang tải thông báo…',
  error: 'Không tải được thông báo.',
  retry: 'Thử lại',
  empty: 'Không có thông báo nào trong {days} ngày qua.',
  /** Chân danh sách: nói rõ phạm vi, để người đọc không tưởng mất thông báo cũ hay việc chính mình làm. */
  scope: 'Sự kiện {days} ngày gần nhất, không gồm việc bạn làm.',
  /** Giờ kèm ngày khi thông báo không phải của hôm nay. */
  dateTime: '{time} · {date}',
  /**
   * Toast khi mức hạn của một điểm giao xấu đi theo vị trí xe (FE-6-09) — chỉ người nhận thông báo này ở chuông (điều phối viên) thấy.
   * Key trùng mức hạn của kho.
   */
  etaRisk: {
    AT_RISK: 'Chuyến {tripId}: điểm {stop} sát hạn giao',
    MISSED: 'Chuyến {tripId}: điểm {stop} dự kiến trễ hạn giao',
    detail: 'Dự kiến đến {eta} · hạn giao {deadline}',
    /** Giờ kèm ngày của một mốc trong câu `detail`. */
    moment: '{time} {date}',
  },
  /** Toast khi một sự cố cấp chuyến được chuyển lên quản lý công ty (FE-6-11) — người nhận thông báo đó ở chuông thấy. */
  exceptionEscalated: 'Chuyến {tripId}: sự cố {type} đã chuyển quản lý',
  /**
   * Chuông của tài xế: câu thay nhãn hành động của nhật ký cho sự kiện về chuyến của chính họ (`DriverNotice`). Chuyến hiện ở "Chuyến của
   * tôi" từ lúc kho bắt đầu soạn hàng, nên đó là lúc tài xế có chuyến mới; chuyến đang xếp quay về Đã lập kế hoạch là chuyến tạm dừng, kho
   * bắt đầu lại là soạn lại.
   */
  driver: {
    loadingStarted: 'Chuyến mới: kho đang soạn hàng',
    loadingRestarted: 'Kho đang soạn lại hàng cho chuyến',
    loadingCompleted: 'Xếp xong — chờ bạn xuất phát',
    replanDamaged: 'Chuyến tạm dừng: kho báo kiện hỏng, chờ điều phối lập lại phương án',
    replanShortage: 'Chuyến tạm dừng: thiếu kiện, chờ điều phối lập lại phương án',
    cancelled: 'Chuyến đã huỷ',
    assigned: 'Chuyến mới: bạn được giao chuyến này',
    unassigned: 'Bạn không còn chạy chuyến này',
    pickupApproved: 'Điều phối đã duyệt nhận hàng dọc đường — tuyến có thêm điểm nhận',
    pickupRejected: 'Yêu cầu nhận hàng dọc đường bị từ chối',
    stopsReordered: 'Điều phối đã đổi thứ tự điểm giao — xem lại tuyến',
  },
} as const
