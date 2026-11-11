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
} as const
