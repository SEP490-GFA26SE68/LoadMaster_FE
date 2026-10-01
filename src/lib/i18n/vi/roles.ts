/**
 * Tên hiển thị của vai trò, key trùng `Role`: ba vai trò nền tảng, năm vai trò của công ty logistics (PRD v2 mục 5.1), và hai vai trò
 * của Review 1 còn tạm tới FE-0-06.
 */
export const roles = {
  systemAdmin: 'Quản trị hệ thống',
  systemManager: 'Quản lý nền tảng',
  systemSupporter: 'Hỗ trợ khách hàng',
  companyAdmin: 'Quản trị công ty',
  manager: 'Quản lý công ty',
  dispatcher: 'Điều phối viên',
  warehouse: 'Nhân viên kho',
  driver: 'Tài xế',
  manufacturer: 'Nhà sản xuất',
  logistics: 'Công ty logistics',
} as const
