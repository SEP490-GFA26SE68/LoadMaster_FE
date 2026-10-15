/**
 * Bảng giá công khai `/bang-gia` (`features/marketing`): thẻ của các gói đang bán. Tên hạng, "Giá trị tạm — chờ chốt", "Không giới hạn"
 * dùng nhãn của `common`. Hạng thuật toán viết bằng lời của khách (Cơ bản / Nâng cao), không tên thuật toán — tên thuật toán chỉ ở màn
 * Thiết lập tối ưu (`optimization.credit`). Không có nút đăng ký hay mua gói: tài khoản công ty do đội LoadMaster mở sau khi khách gửi
 * yêu cầu liên hệ.
 */
export const pricing = {
  title: 'Bảng giá',
  lede: 'Các gói khác nhau ở số credit mỗi tháng và hạng thuật toán. Mọi gói đều có tối ưu xếp hàng 3D và tối ưu tuyến.',
  cta: 'Nhận tư vấn',
  creditNote: '1 credit là một lần chạy tối ưu xếp hàng 3D, cho ra ba phương án để so sánh. Tối ưu tuyến không tốn credit.',
  /** Sau giá của gói: "490.000 ₫ / tháng". */
  perMonth: '/ tháng',
  credits: 'Credit mỗi tháng',
  algorithm: 'Hạng thuật toán',
  /** Hạng thuật toán của gói theo lời của khách; Ultimate chưa có gì hơn Pro (AI Optimizer chưa có) nên cũng là Nâng cao. */
  tiers: { EP_DBLF: 'Cơ bản', EP_DBLF_GA: 'Nâng cao', EP_DBLF_GA_AI: 'Nâng cao' },
  tierNote: 'Bản demo hiện tối ưu ở hạng Cơ bản cho mọi gói.',
  includes: 'Gói gồm',
  features: {
    OPTIMIZATION_3D: 'Tối ưu xếp hàng 3D, ba phương án mỗi lần chạy',
    ROUTE_OPTIMIZATION: 'Tối ưu tuyến giao hàng',
    ADVANCED_ALGORITHM: 'Hạng thuật toán nâng cao',
    UNLIMITED_CREDITS: 'Không giới hạn số lần chạy tối ưu',
  },
  /** Nút của thẻ gói: chữ hiện ra, rồi tên gói chỉ cho trình đọc màn hình — tên truy cập "Liên hệ tư vấn gói Pro". */
  contactPlan: 'Liên hệ tư vấn',
  contactPlanName: 'gói {name}',
  manage: 'Quản lý gói của công ty',
  signUpNote: 'Muốn dùng một gói? Gửi yêu cầu liên hệ, đội LoadMaster mở tài khoản công ty sau khi trao đổi với bạn.',
  loading: 'Đang tải bảng giá',
  empty: 'Hiện chưa có gói nào đang bán.',
  error: 'Không tải được bảng giá.',
  retry: 'Thử lại',
} as const
