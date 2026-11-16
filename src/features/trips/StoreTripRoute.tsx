import type { ReactNode } from 'react'
import { Navigate, useLocation, useParams } from 'react-router'
import { TRIPS_CAPABILITIES } from './trips-capabilities'

/**
 * Màn của chuyến có bản cho máy chủ khi nhóm `trips` nối backend: form tạo chuyến (`/chuyen/moi`, `BackendTripFormPage`), form sửa
 * chuyến (`/chuyen/:id/sua`, `BackendTripEditPage`), Thiết lập tối ưu (`/chuyen/:id/toi-uu`), So sánh phương án (`/so-sanh`) và Planner
 * (`/phuong-an`), Báo cáo chuyến (`/bao-cao`). Các màn đó tự chọn bản theo nguồn dữ liệu.
 */
const BACKEND_SCREENS = [/^\/chuyen\/moi\/?$/, /^\/chuyen\/[^/]+\/(sua|toi-uu|so-sanh|phuong-an|bao-cao)\/?$/]

/**
 * Màn của chuyến chỉ có ở kho mẫu. Nhóm `trips` đọc backend thì mã chuyến trên URL
 * là của máy chủ, không có trong kho mẫu: mở thẳng đường dẫn đó (liên kết cũ, gõ tay) thì về Chi tiết chuyến của máy chủ — hoặc danh
 * sách khi không có mã — thay vì vẽ màn trống hay ghi vào kho mẫu. Màn có bản cho máy chủ (`BACKEND_SCREENS`) đi tiếp.
 */
export function StoreTripRoute({ children }: { children: ReactNode }) {
  const { tripId } = useParams()
  const { pathname } = useLocation()
  if (!TRIPS_CAPABILITIES.backend || BACKEND_SCREENS.some((screen) => screen.test(pathname))) return children
  return <Navigate replace to={tripId ? `/chuyen/${encodeURIComponent(tripId)}` : '/chuyen'} />
}
