import type { ReactNode } from 'react'
import { Navigate, useParams } from 'react-router'
import { TRIPS_CAPABILITIES } from './trips-capabilities'

/**
 * Màn của chuyến chỉ có ở kho mẫu (form chuyến, Thiết lập tối ưu, So sánh, Planner, báo cáo chuyến). Nhóm `trips` đọc backend thì mã
 * chuyến trên URL là của máy chủ, không có trong kho mẫu: mở thẳng đường dẫn đó (liên kết cũ, gõ tay) thì về Chi tiết chuyến của máy
 * chủ — hoặc danh sách khi không có mã — thay vì vẽ màn trống hay ghi vào kho mẫu.
 */
export function StoreTripRoute({ children }: { children: ReactNode }) {
  const { tripId } = useParams()
  if (!TRIPS_CAPABILITIES.backend) return children
  return <Navigate replace to={tripId ? `/chuyen/${encodeURIComponent(tripId)}` : '/chuyen'} />
}
