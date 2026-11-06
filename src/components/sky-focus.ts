/**
 * Vòng focus của điều khiển đặt trên dải trời ở các trang ngoài khung ứng dụng (giới thiệu, bảng giá, đăng nhập): `--cyan-300`, vì
 * `--primary` không đủ tương phản trên nền tối (AGENTS mục 1). Ghép vào `className` của `Button` — `cn` thay vòng `--primary` của nút —
 * nên biến thể của nút không đổi và các màn trong khung ứng dụng giữ nguyên.
 */
export const SKY_FOCUS = 'focus-visible:outline-cyan-300'
