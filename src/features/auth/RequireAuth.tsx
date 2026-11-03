import { useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './AuthProvider'
import { PUBLIC_HOME } from './landing'

/**
 * Chặn route khi chưa đăng nhập và ghi nhớ trang định vào, để sau khi đăng nhập quay lại đúng chỗ.
 *
 * Chỉ ghi nhớ khi người **chưa đăng nhập** mở một trang (liên kết sâu, tab mới). Khi người đang đăng nhập bấm
 * Đăng xuất, trang họ đang đứng không phải lựa chọn của người đăng nhập kế tiếp: không ghi nhớ, để lần đăng nhập sau
 * mở màn của vai trò (`landingPath`). Quyền theo vai trò kiểm ở từng nhóm route bằng `RequirePermission` (D-41).
 *
 * Khách chưa đăng nhập mở đúng gốc `/` thì sang trang giới thiệu công khai (giữ query và neo, ví dụ `?lang=en`): gốc không phải trang
 * họ chọn nên không có gì để ghi nhớ. Người vừa đăng xuất vẫn về màn đăng nhập.
 */
export function RequireAuth() {
  const { user, initialized } = useAuth()
  const location = useLocation()

  // Đã có người đăng nhập lúc layout này đang mở: layout giữ nguyên khi đăng xuất (user từ có sang null).
  const [seenUser, setSeenUser] = useState(user !== null)
  if (user !== null && !seenUser) setSeenUser(true)

  // Chờ Keycloak kiểm tra phiên đăng nhập
  if (!initialized) {
    return null
  }

  // Chưa đăng nhập thì chuyển về trang đăng nhập hoặc trang giới thiệu nếu vào root
  if (!user) {
    if (seenUser) {
      return <Navigate to="/dang-nhap" replace state={null} />
    }
    if (location.pathname === '/') {
      return <Navigate to={PUBLIC_HOME + location.search + location.hash} replace />
    }
    return (
      <Navigate
        to="/dang-nhap"
        replace
        state={{
          from: location.pathname + location.search + location.hash,
        }}
      />
    )
  }

  return <Outlet />
}
