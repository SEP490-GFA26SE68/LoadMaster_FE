/**
 * Thông tin công khai của LoadMaster cho trang giới thiệu, chân trang, thẻ meta và trang chính sách bảo mật — một chỗ duy nhất.
 * Chỉ ghi điều đã có trong mã nguồn: tên miền `loadmaster.vn` và hộp thư của vai trò hỗ trợ khách hàng (tài khoản `hotro@loadmaster.vn`).
 * Chưa có số điện thoại, địa chỉ, mã số thuế: để trống thì không màn nào vẽ dòng đó. Có thông tin thật thì sửa ở đây.
 * File thuần (không React, không `import.meta`): `vite.config.ts` cũng đọc nó khi dựng thẻ meta, `robots.txt`, `sitemap.xml`.
 */
export const SITE_INFO = {
  name: 'LoadMaster',
  /** Gốc của các đường dẫn tuyệt đối (canonical, og:url, sitemap), không có `/` cuối. */
  url: 'https://loadmaster.vn',
  supportEmail: 'hotro@loadmaster.vn',
  phone: null as string | null,
  address: null as string | null,
  taxCode: null as string | null,
} as const
