/**
 * Hộp thoại "Đổi gói cước khách hàng" của hỗ trợ khách hàng (`support/CustomerPlanDialog`): chọn công ty và áp gói ngay.
 * Gắn vào nhánh `support.customerPlan`.
 */
export const customerPlan = {
  title: 'Đổi gói cước khách hàng',
  description: 'Cập nhật hoặc nâng cấp gói cước ngay lập tức cho công ty khách hàng theo yêu cầu hỗ trợ.',
  company: 'Công ty khách hàng',
  current: 'Gói hiện tại:',
  none: 'Chưa có',
  plan: 'Gói cước áp dụng',
  planOption: '{name} — {price}/tháng ({credits})',
  unlimited: 'Không giới hạn',
  credits: '{amount} credit',
  close: 'Đóng',
  submit: 'Cập nhật gói ngay',
  updated: 'Đã cập nhật gói {plan} cho {company}!',
  companyFallback: 'công ty',
  /** Khung công ty của `/ho-tro`. */
  quickTitle: 'Đổi gói nhanh',
  ticketClosed: 'Yêu cầu hỗ trợ đã đóng — mở lại yêu cầu trước khi đổi gói.',
} as const
