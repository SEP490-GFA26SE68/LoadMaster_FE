/**
 * Màn khoá của tài khoản dùng thử quá hạn ký thoả thuận (`support/TrialAccountLockedView`, chỉ khi nối backend): lý do khoá, gửi yêu cầu
 * hỗ trợ mở khoá, theo dõi yêu cầu đang chờ và ký thoả thuận ngay. Gắn vào `support.trialLocked`.
 */
export const trialLocked = {
  badge: 'Tài khoản bị khóa',
  signOut: 'Đăng xuất',
  title: 'Tài khoản tạm thời bị khóa do chưa hoàn tất ký thỏa thuận dịch vụ trong 72 giờ',
  body: 'Theo quy định của LoadMaster, đơn vị dùng thử cần ký xác nhận thỏa thuận điện tử trong vòng 72 giờ kể từ khi kích hoạt tài khoản. Các màn nghiệp vụ đã tạm dừng.',
  pendingTitle: 'Yêu cầu mở khóa của bạn đang được tiếp nhận',
  pendingNote: 'Nhân viên hỗ trợ sẽ kiểm tra đơn và mở lại tài khoản của bạn trong thời gian sớm nhất.',
  formTitle: 'Gửi yêu cầu hỗ trợ mở khóa tài khoản',
  reasonLabel: 'Lý do đề nghị mở lại tài khoản',
  reasonPlaceholder: 'Ví dụ: Chúng tôi bận công tác nên chưa kịp ký thỏa thuận trong 72 giờ, đề nghị đội hỗ trợ mở khóa để chúng tôi ký lại.',
  reasonRequired: 'Nhập lý do đề nghị mở lại tài khoản',
  submit: 'Gửi yêu cầu mở khóa',
  sent: 'Đã gửi yêu cầu mở khóa tài khoản.',
  /** Tiêu đề của yêu cầu hỗ trợ gửi đi; `name` là họ tên hoặc email người gửi. */
  ticketTitle: 'Yêu cầu mở khóa tài khoản dùng thử - {name}',
  signTitle: 'Ký thỏa thuận trực tuyến',
  signHint: 'Ký thỏa thuận ngay bây giờ để mở khóa tài khoản.',
  signNow: 'Ký thỏa thuận ngay',
  signed: 'Đã ký thỏa thuận. Tài khoản của bạn đã được mở lại.',
  signAuto: 'Ký xong là tài khoản mở lại ngay, không cần chờ duyệt.',
  signAutoTag: 'Mở lại ngay',
  agreementCompany: 'Doanh nghiệp:',
  agreementCode: 'Mã thỏa thuận:',
  signUnlock: 'Ký thỏa thuận để mở khóa ngay',
  helpToggle: 'Cần trợ giúp kỹ thuật hoặc gặp sự cố khi ký?',
  helpLabel: 'Nội dung cần hỗ trợ',
  helpPlaceholder: 'Mô tả lỗi hoặc sự cố bạn gặp khi bấm ký…',
  helpSubmit: 'Gửi yêu cầu hỗ trợ',
} as const

/**
 * Màn khoá khi gói cước của công ty hết hạn hoặc công ty chưa có gói (`support/TrialExpiredLockedView`, chỉ khi nối backend): nhân viên
 * công ty không dùng được màn nào, chỉ đăng xuất. Gắn vào `support.subscriptionLocked`.
 */
export const subscriptionLocked = {
  badge: 'Gói cước hết hạn',
  signOut: 'Đăng xuất',
  title: 'Gói cước của doanh nghiệp đã hết hạn',
  body: 'Doanh nghiệp của bạn chưa có gói cước đang hiệu lực trên LoadMaster. Mọi tính năng vận hành (chuyến hàng, điều phối, kho và tối ưu xếp hàng) đang tạm dừng.',
  nextTitle: 'Cần tiếp tục sử dụng hệ thống?',
  nextBody: 'Liên hệ Quản trị công ty của doanh nghiệp để gia hạn hoặc đăng ký gói cước.',
  signOutLong: 'Đăng xuất khỏi hệ thống',
  /** Đọc lại hồ sơ sau khi quản trị công ty đã gia hạn hoặc đăng ký gói. */
  recheck: 'Kiểm tra lại',
  stillLocked: 'Doanh nghiệp vẫn chưa có gói cước đang hiệu lực.',
} as const
