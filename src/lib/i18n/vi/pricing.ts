/**
 * Bảng giá công khai `/bang-gia` và phần "Gói cước" của trang giới thiệu (`features/marketing`): thẻ các gói đang bán, khối "Mọi gói đều
 * có" (phần chung của mọi hạng, `TIER_FEATURES`), khối "Credit tính thế nào" (số lấy từ `BILLING_CONSTANTS.optimizationCost` và
 * `PLAN_OBJECTIVES`) và lưu ý. Tên hạng, "Giá trị tạm — chờ chốt", "Không giới hạn" dùng nhãn của `common`. Hạng thuật toán viết bằng lời
 * của khách (Cơ bản / Nâng cao), không tên thuật toán — tên thuật toán chỉ ở màn Thiết lập tối ưu (`optimization.credit`). Không có nút
 * đăng ký hay mua gói: tài khoản công ty do đội LoadMaster mở sau khi khách gửi yêu cầu liên hệ.
 */
export const pricing = {
  title: 'Bảng giá',
  lede: 'Các gói khác nhau ở số credit mỗi tháng và hạng thuật toán. Phần còn lại gói nào cũng có.',
  cta: 'Nhận tư vấn',
  /** Sau giá của gói: "490.000 ₫ / tháng". */
  perMonth: '/ tháng',
  credits: 'Credit mỗi tháng',
  /** Credit mỗi tháng của gói không giới hạn khi đứng một mình (thẻ gói của trang giới thiệu). */
  unlimitedCredits: 'Không giới hạn credit',
  algorithm: 'Hạng thuật toán',
  /** Hạng thuật toán của gói theo lời của khách; Ultimate chưa có gì hơn Pro (AI Optimizer chưa có) nên cũng là Nâng cao. */
  tiers: { EP_DBLF: 'Cơ bản', EP_DBLF_GA: 'Nâng cao', EP_DBLF_GA_AI: 'Nâng cao' },
  /** Tính năng riêng của gói, ngoài phần "Mọi gói đều có"; gói không có gì riêng ghi `commonOnly`. */
  extras: 'Thêm vào phần chung',
  commonOnly: 'Gồm đủ phần chung của mọi gói.',
  features: {
    OPTIMIZATION_3D: 'Tối ưu xếp hàng 3D, ba phương án mỗi lần chạy',
    ROUTE_OPTIMIZATION: 'Tối ưu tuyến giao hàng',
    ADVANCED_ALGORITHM: 'Hạng thuật toán nâng cao',
    UNLIMITED_CREDITS: 'Không giới hạn số lần chạy tối ưu',
  },
  common: {
    title: 'Mọi gói đều có',
  },
  credit: {
    title: 'Credit tính thế nào',
    run: { one: '{count} credit cho một lần chạy tối ưu xếp hàng 3D.', other: '{count} credit cho một lần chạy tối ưu xếp hàng 3D.' },
    plans: 'Mỗi lần chạy ra {count} phương án để so sánh — vẫn tính là một lần.',
    route: 'Tối ưu tuyến giao hàng không tốn credit.',
    /** Một câu cho phần gói cước của trang giới thiệu. */
    summary: {
      one: '{count} credit cho một lần chạy tối ưu xếp hàng 3D, ra {plans} phương án để so sánh.',
      other: '{count} credit cho một lần chạy tối ưu xếp hàng 3D, ra {plans} phương án để so sánh.',
    },
  },
  notes: {
    title: 'Trước khi chọn gói',
    /** `{tier}`: hạng của thuật toán bản demo chạy (`OPTIMIZATION_ALGORITHMS`), cùng chữ với ô "Hạng thuật toán" của thẻ gói. */
    tier: 'Hạng thuật toán là mức tối ưu gói được dùng khi LoadMaster chạy chính thức. Bản demo đang mở tối ưu ở hạng {tier} cho mọi gói, nên thử trên bản demo thì gói nào cũng cho cùng kết quả.',
    /** `{tag}`: chữ của nhãn giá tạm (`common.provisionalPlan`). Chỉ hiện khi có gói mang cờ tạm. */
    provisional: 'Giá và credit của gói gắn nhãn “{tag}” chưa chốt, có thể đổi trước khi dịch vụ chạy chính thức.',
    signUp: 'Muốn dùng một gói? Gửi yêu cầu liên hệ, đội LoadMaster mở tài khoản công ty sau khi trao đổi với bạn.',
  },
  /** Nút của thẻ gói: chữ hiện ra, rồi tên gói chỉ cho trình đọc màn hình — tên truy cập "Liên hệ tư vấn gói Pro". */
  contactPlan: 'Liên hệ tư vấn',
  contactPlanName: 'gói {name}',
  manage: 'Quản lý gói của công ty',
  loading: 'Đang tải bảng giá',
  empty: 'Hiện chưa có gói nào đang bán.',
  error: 'Không tải được bảng giá.',
  retry: 'Thử lại',
} as const
