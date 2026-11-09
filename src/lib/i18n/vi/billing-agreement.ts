/**
 * Thoả thuận dịch vụ thử nghiệm của công ty dùng thử (`/goi-cuoc`, chỉ khi nối backend): banner nhắc ký (`TrialAgreementBanner`), hộp
 * ký (`SignAgreementDialog`), hộp xem thoả thuận (`ViewAgreementDialog`) — hộp xem cũng mở từ màn của nền tảng. Gắn vào `billing.agreement`.
 */
export const agreement = {
  code: 'Mã {code}',
  company: 'Doanh nghiệp: {name}',
  banner: {
    expiredTitle: 'Thoả thuận đã quá hạn ký — tài khoản đã bị gắn cờ và tạm khoá chức năng',
    expiredBody: 'Đã quá 72 giờ để ký thoả thuận dịch vụ thử nghiệm. Tài khoản bị tạm khóa chức năng và sẽ bị xóa cứng sau 30 ngày. Vui lòng ký thỏa thuận ngay để mở khóa hoặc liên hệ hỗ trợ.',
    signNow: 'Ký thoả thuận',
    signToUnlock: 'Ký thỏa thuận để mở khóa',
    pendingTitle: 'Cần ký thoả thuận dịch vụ thử nghiệm',
    hoursLeft: 'Còn {hours} giờ',
    pendingBody: 'Thoả thuận phải được ký trong 3 ngày kể từ khi tài khoản được kích hoạt. Quá hạn, tài khoản công ty tự khoá dù thời gian dùng thử vẫn còn.',
  },
  sign: {
    deadline: 'Thoả thuận mở tối đa 3 ngày (72 giờ) kể từ khi cấp tài khoản. Chưa ký trước {date} thì tài khoản công ty tự khoá.',
    deadlineUnknown: 'Thoả thuận mở tối đa 3 ngày (72 giờ) kể từ khi cấp tài khoản. Quá hạn mà chưa ký thì tài khoản công ty tự khoá.',
    contentTitle: 'Nội dung thoả thuận',
    signerTitle: 'Người đại diện ký',
    signerName: 'Họ và tên người ký',
    signerPhone: 'Số điện thoại',
    confirm:
      'Tôi đã đọc, hiểu và đồng ý với các điều khoản sử dụng dịch vụ thử nghiệm của LoadMaster, và xác nhận có thẩm quyền đại diện doanh nghiệp ký thoả thuận này.',
    errors: {
      signerNameRequired: 'Nhập họ và tên người ký',
      signerPhoneRequired: 'Nhập số điện thoại người ký',
      confirmRequired: 'Cần đồng ý với các điều khoản trước khi ký',
    },
    cancel: 'Huỷ',
    submit: 'Ký thoả thuận',
  },
  view: {
    badgeSigned: 'Đã ký',
    badgeExpired: 'Quá hạn',
    badgePending: 'Chờ ký',
    legalTitle: 'Thông tin ký',
    statusLabel: 'Trạng thái',
    statusSigned: 'Đã ký điện tử',
    statusExpired: 'Quá hạn ký',
    statusPending: 'Đang chờ ký',
    deadlineLabel: 'Hạn ký',
    hoursLeft: 'còn {hours} giờ',
    signerLabel: 'Người ký',
    signedAtLabel: 'Thời điểm ký',
    signerPhoneLabel: 'Số điện thoại người ký',
    ipLabel: 'Địa chỉ IP khi ký',
    contentTitle: 'Văn bản thoả thuận',
    close: 'Đóng',
  },
} as const
