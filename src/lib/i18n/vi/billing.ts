/**
 * Gói cước và credit của công ty `/goi-cuoc` (FE-8-03, D-89, D-94): quản trị công ty xem gói, số dư, lịch sử credit và thanh toán, đăng
 * ký, huỷ gói và nạp credit. Hạng gói, "Giá trị tạm", "Không giới hạn" ở `common`; trang thanh toán giả lập ở `payment`.
 */
export const billing = {
  title: 'Gói cước và credit',
  loading: 'Đang tải gói cước',
  errorTitle: 'Không tải được gói cước',
  retry: 'Thử lại',
  topUp: 'Nạp credit',
  pay: 'Trả',
  payFor: 'Trả giao dịch {code}',
  /** Banner của thanh toán đăng ký / gia hạn đang chờ trả. */
  pending: {
    RENEWAL: 'Thanh toán gia hạn gói {plan} ({amount}) đang chờ. Gói hết hạn ngày {date} nếu chưa trả.',
    SUBSCRIBE: 'Thanh toán đăng ký gói {plan} ({amount}) chưa hoàn tất.',
  },
  plan: {
    title: 'Gói hiện tại',
    status: { ACTIVE: 'Đang hoạt động', CANCELLED: 'Đã huỷ — còn hiệu lực', EXPIRED: 'Đã hết hạn' },
    started: 'Bắt đầu',
    expires: 'Hết hạn',
    autoRenew: 'Tự gia hạn',
    autoRenewOn: 'Bật',
    autoRenewOff: 'Tắt',
    price: 'Giá mỗi tháng',
    credits: 'Credit mỗi tháng',
    cancel: 'Huỷ gói',
    expiredNote: 'Gói đã hết hạn nên chưa chạy tối ưu được. Số dư credit được giữ lại, chọn gói mới để dùng tiếp.',
    cancelledNote: 'Gói đã huỷ, dùng được tới hết {date} rồi hết hạn, không tự gia hạn.',
  },
  noPlan: {
    title: 'Công ty chưa có gói cước',
    description: 'Chọn một gói để chạy tối ưu 3D. Credit đã nạp được giữ lại khi gói hết hạn.',
  },
  choose: {
    title: 'Chọn gói',
    subscribe: 'Đăng ký',
    subscribeTo: 'Đăng ký gói {name}',
    none: 'Hiện chưa có gói nào đang bán.',
  },
  credit: {
    title: 'Credit',
    balance: 'Số dư',
    note: 'Mỗi lần chạy tối ưu 3D dùng 1 credit; gói không giới hạn dùng 0.',
    unlimitedNote: 'Gói không giới hạn nên số dư không bị trừ khi chạy tối ưu.',
  },
  cancelDialog: {
    title: 'Huỷ gói {plan}?',
    description: 'Gói vẫn dùng được tới hết {date}, sau đó hết hạn và không tự gia hạn. Số dư credit được giữ lại.',
    cancel: 'Giữ gói',
    confirm: 'Huỷ gói',
  },
  cancelled: 'Đã huỷ gói {plan}. Gói dùng được tới hết {date}.',
  topUpDialog: {
    title: 'Nạp credit',
    description: '{price} mỗi credit. Bạn sang trang thanh toán để hoàn tất; credit chỉ được cộng khi thanh toán thành công.',
    pack: '{credits} credit',
    packAmount: '{amount}',
    cancel: 'Huỷ',
    confirm: 'Tiếp tục thanh toán',
  },
  history: {
    title: 'Lịch sử',
    tabs: { credit: 'Credit', payments: 'Thanh toán' },
  },
  ledger: {
    columns: { time: 'Thời gian', type: 'Loại', amount: 'Số credit', reference: 'Tham chiếu', note: 'Ghi chú' },
    types: { MONTHLY_GRANT: 'Cấp theo tháng', PURCHASE: 'Mua', USAGE: 'Dùng', REFUND: 'Hoàn' },
    usage: { RESERVED: 'Đang giữ', DEDUCTED: 'Đã trừ', REFUNDED: 'Đã hoàn' },
    empty: 'Chưa có giao dịch credit nào.',
  },
  payments: {
    columns: { time: 'Thời gian', code: 'Mã giao dịch', purpose: 'Nội dung', amount: 'Số tiền', status: 'Trạng thái', actions: 'Thao tác' },
    purposes: { SUBSCRIBE: 'Đăng ký gói', RENEWAL: 'Gia hạn gói', TOPUP: 'Nạp credit' },
    statuses: { PENDING: 'Chờ thanh toán', SUCCESS: 'Thành công', FAILED: 'Thất bại' },
    empty: 'Chưa có thanh toán nào.',
  },
} as const
