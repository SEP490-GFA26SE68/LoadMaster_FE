/** Thanh điều hướng và menu tài khoản (`app/NavRail.tsx`). */
export const nav = {
  label: 'Điều hướng chính',
  dashboard: 'Bảng điều khiển',
  trips: 'Chuyến hàng',
  warehouse: 'Kho',
  driver: 'Tài xế',
  fleet: 'Đội xe',
  users: 'Người dùng',
  audit: 'Nhật ký',
  // Review 1 (LM-104): nhà sản xuất, logistics, điều phối (đơn hàng), quản lý (chờ duyệt)
  packageTypes: 'Loại kiện',
  packages: 'Kiện hàng',
  shipments: 'Lô hàng',
  receiving: 'Nhận hàng',
  orders: 'Đơn hàng',
  review: 'Chờ duyệt',
  account: 'Tài khoản {name}',
  signOut: 'Đăng xuất',
  /** Mục của menu tài khoản, mở `/ho-so` (LM-096). */
  profile: 'Hồ sơ cá nhân',
  /** Nhãn cho logo ở đầu thanh điều hướng, đưa về màn chính. */
  home: 'LoadMaster — về màn chính',
  backHome: 'Về màn chính',
} as const
