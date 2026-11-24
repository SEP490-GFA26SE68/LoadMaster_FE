import type { Role } from '@/types/user'

/**
 * Câu hỏi gợi ý của trợ lý AI trong ứng dụng, theo thứ tự ưu tiên. Khác bốn câu của trang công khai (gói, dùng thử — không có nghĩa với người
 * đã là khách hàng), câu ở đây gửi thẳng cho mô hình và chỉ hiện với vai trò mà máy chủ có công cụ trả lời nó: chuyến (`list_trips`; tài
 * xế: chuyến của mình), việc của kho và tra kiện (nhân viên kho), credit (`get_my_account`, ba vai trò đọc gói), phiếu lương
 * (`get_my_payroll`; tài xế, nhân viên kho), yêu cầu hỗ trợ (`get_my_support_tickets`), gói cước (`get_pricing_plans`); màn đang mở đi
 * kèm mọi câu hỏi. Tài xế và nhân viên kho hỏi từ màn cảm ứng của mình (`TouchAssistant`).
 */
export const APP_STARTERS = ['page', 'trips', 'myTrips', 'warehouseTasks', 'packageLookup', 'credit', 'payroll', 'tickets', 'plans'] as const
export type AppStarterId = (typeof APP_STARTERS)[number]

const COMPANY_ROLES: readonly Role[] = ['companyAdmin', 'companyManager', 'dispatcher', 'warehouse', 'driver']

const STARTER_ROLES: Record<AppStarterId, readonly Role[] | null> = {
  page: null,
  trips: ['companyManager', 'dispatcher'],
  myTrips: ['driver'],
  warehouseTasks: ['warehouse'],
  packageLookup: ['warehouse'],
  credit: ['companyAdmin', 'companyManager', 'dispatcher'],
  payroll: ['driver', 'warehouse'],
  tickets: COMPANY_ROLES,
  plans: null,
}

/** Tối đa bốn câu (lưới 2 × 2 của màn chào) cho vai trò này; `null` ở bảng trên là mọi vai trò. */
export function appStartersFor(role: Role): AppStarterId[] {
  return APP_STARTERS.filter((id) => STARTER_ROLES[id]?.includes(role) ?? true).slice(0, 4)
}
