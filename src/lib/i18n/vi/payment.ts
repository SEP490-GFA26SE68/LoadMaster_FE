/**
 * Trang thanh toán giả lập `/thanh-toan/gia-lap` (FE-8-04, D-89): thay cổng thanh toán thật khi chưa có backend. Trung tính — không
 * mang tên, logo hay màu của cổng nào. Khi có backend, app chuyển sang URL thanh toán backend trả và không dùng trang này.
 */
export const payment = {
  title: 'Thanh toán giả lập',
  loading: 'Đang tải giao dịch',
  notice: 'Đây là trang thanh toán giả lập của bản demo: không có cổng thanh toán thật và không có tiền nào bị trừ.',
  amount: 'Số tiền',
  description: 'Nội dung',
  code: 'Mã giao dịch',
  status: 'Trạng thái',
  purposes: {
    SUBSCRIBE: 'Đăng ký gói {plan}',
    RENEWAL: 'Gia hạn gói {plan}',
    TOPUP: 'Nạp {credits} credit',
  },
  hint: 'Thành công: gói được kích hoạt hoặc credit được cộng, đúng một lần. Thất bại hoặc Huỷ: số dư không đổi.',
  success: 'Thành công',
  failure: 'Thất bại',
  cancel: 'Huỷ',
  settled: {
    title: 'Giao dịch đã được xử lý',
    description: 'Giao dịch {code} đã có kết quả: {status}. Mỗi giao dịch chỉ xử lý một lần.',
  },
  notFound: {
    title: 'Không tìm thấy giao dịch',
    description: 'Mã giao dịch không có, hoặc không thuộc công ty của bạn.',
  },
  error: 'Không tải được giao dịch.',
  retry: 'Thử lại',
  toBilling: 'Về gói cước',
  toasts: {
    SUBSCRIBE: 'Đã đăng ký gói {plan}',
    RENEWAL: 'Đã gia hạn gói {plan}',
    TOPUP: 'Đã nạp {credits} credit',
    FAILED: 'Thanh toán không thành công, số dư không đổi',
    CANCELLED: 'Đã huỷ thanh toán, số dư không đổi',
  },
} as const
