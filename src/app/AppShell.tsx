import { Outlet } from 'react-router'
import { NavRail } from './NavRail'

/**
 * Khung desktop: thanh điều hướng ngang trên dải trời, nội dung màn bên dưới trên nền phẳng `--app` (V2.3).
 *
 * Màn nằm trong một **hàng** flex `min-h-0`, không nằm thẳng trong cột: mọi màn viết cho bối cảnh hàng (thời rail dọc) —
 * gốc `flex-1 flex-col`, vùng cuộn `min-h-0 flex-1 overflow-auto`. Đặt thẳng vào cột thì gốc màn cao theo nội dung
 * (`min-height: auto`), `overflow-hidden` của khung cắt mất phần dưới và lăn chuột không cuộn được gì.
 *
 * Hàng đó `relative`: phần tử `absolute` không có tổ tiên định vị (bảng `sr-only` của biểu đồ, ô ẩn của Radix) lấy cả trang làm
 * khối chứa, thoát khỏi vùng cuộn và kéo tài liệu dài ra — trang cuộn, đẩy thanh điều hướng khỏi màn hình.
 */
export function AppShell() {
  return (
    <div className="app-shell flex h-dvh flex-col overflow-hidden bg-app">
      <NavRail />
      <div className="relative flex min-h-0 min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  )
}
