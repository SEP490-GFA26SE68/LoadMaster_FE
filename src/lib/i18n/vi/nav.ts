/** Thanh điều hướng và menu tài khoản (`app/NavRail.tsx`); mục nào hiện với vai trò nào khai ở `app/nav-items.ts`. */
export const nav = {
  label: 'Điều hướng chính',
  dashboard: 'Bảng điều khiển',
  trips: 'Chuyến hàng',
  warehouse: 'Kho',
  driver: 'Tài xế',
  fleet: 'Đội xe',
  users: 'Người dùng',
  audit: 'Nhật ký',
  // Kho kiện (FE-3b-03): điều phối viên quản lý, quản lý công ty chỉ đọc. Yêu cầu giao (FE-4b-02): quản lý công ty lập, điều phối viên xem
  packages: 'Kho kiện',
  requirements: 'Yêu cầu giao',
  account: 'Tài khoản {name}',
  signOut: 'Đăng xuất',
  /** Mục của menu tài khoản, mở `/ho-so` (LM-096). */
  profile: 'Hồ sơ cá nhân',
  /** Nhãn cho logo ở đầu thanh điều hướng, đưa về màn chính. */
  home: 'LoadMaster — về màn chính',
} as const
