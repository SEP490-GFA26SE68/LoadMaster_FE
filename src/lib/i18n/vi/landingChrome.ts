/**
 * Đầu trang và phần khung chung của trang công khai (giới thiệu, bảng giá, chính sách bảo mật): `PublicHeader`, `PublicNavMenu`,
 * mục điều hướng `PUBLIC_LINKS`. Tên ngôn ngữ của nút quả địa cầu ở nhánh `language`.
 */
export const landingChrome = {
  title: 'Khung trang công khai',
  /** Tên truy cập của logo ở đầu trang. */
  home: 'LoadMaster — trang giới thiệu',
  /** Vùng điều hướng của đầu trang (từ 1.024 px là một hàng). */
  nav: 'Mục của trang giới thiệu',
  /** Nút menu gom các mục dưới 1.024 px. */
  menu: 'Menu trang',
  features: 'Tính năng',
  how: 'Cách hoạt động',
  pricing: 'Bảng giá',
  /** Mục "Liên hệ" của hàng điều hướng và nút "Liên hệ" gọn dưới 1.024 px — cùng một chữ, cùng đích. */
  contact: 'Liên hệ',
  signIn: 'Đăng nhập',
  openApp: 'Vào ứng dụng',
} as const
