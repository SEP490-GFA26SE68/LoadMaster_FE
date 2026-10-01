import type { Role } from '@/types/user'

/**
 * Màn chính của từng vai trò: nơi đăng nhập xong mở ra khi người dùng chưa định vào trang cụ thể, cũng là đích của nút "Về màn chính"
 * (403, 404), logo và nút thoát — nên phải là màn vai trò đó mở được.
 */
export const ROLE_HOME: Readonly<Record<Role, string>> = {
  // Tạm (quyết định G1): PRD v2 mục 5.1 đặt `/nen-tang/cong-ty`, `/nen-tang/goi`, `/ho-tro`, nhưng ba màn nền tảng tới Sprint 8 mới có.
  // Quản trị hệ thống mở màn Người dùng; Quản lý nền tảng và Hỗ trợ khách hàng chưa có màn nào ngoài hồ sơ của mình.
  systemAdmin: '/nguoi-dung',
  systemManager: '/ho-so',
  systemSupporter: '/ho-so',
  companyAdmin: '/nguoi-dung',
  manager: '/',
  dispatcher: '/chuyen',
  warehouse: '/kho',
  driver: '/tai-xe',
  // LM-104: nhà sản xuất mở danh sách kiện đã đăng ký, công ty logistics mở màn nhận hàng (cả hai trong khung ứng dụng)
  manufacturer: '/kien-hang',
  logistics: '/nhan-hang',
}

/**
 * Trang mở sau khi đăng nhập. `from` là trang định vào trước khi bị chuyển tới màn đăng nhập (kèm query).
 * Gốc `/` và chính màn đăng nhập không phải lựa chọn của người dùng — mở ứng dụng luôn đi qua đó — nên đổi thành
 * màn của vai trò, giữ nguyên query (ví dụ `?lang=en`). Liên kết sâu khác được giữ.
 */
export function landingPath(role: Role, from?: string): string {
  if (!from) return ROLE_HOME[role]
  const queryStart = from.search(/[?#]/)
  const path = queryStart === -1 ? from : from.slice(0, queryStart)
  if (path !== '/' && path !== '/dang-nhap') return from
  return ROLE_HOME[role] + (queryStart === -1 ? '' : from.slice(queryStart))
}
