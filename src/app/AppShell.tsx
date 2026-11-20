import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuthSafe } from '@/features/auth/AuthProvider'
import { TrialAgreementNotifier } from '@/features/billing/TrialAgreementNotifier'
import { TrialAccountLockedView } from '@/features/support/TrialAccountLockedView'
import { TrialExpiredLockedView } from '@/features/support/TrialExpiredLockedView'
import { isPlatformRole } from '@/types/user'
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
  const auth = useAuthSafe()
  const user = auth?.user
  const location = useLocation()

  // 1. Khi tài khoản bị gắn cờ do không ký thỏa thuận dịch vụ đúng hạn 72 giờ:
  // Khóa toàn bộ các thanh điều hướng và trang nghiệp vụ, chỉ hiển thị giao diện ký/tạo Support Ticket mở khóa
  if (user?.status === 'flagged') {
    return <TrialAccountLockedView />
  }

  // 2. Khi gói cước công ty hết hạn (subscriptionExpired):
  if (user?.subscriptionExpired && !isPlatformRole(user.role)) {
    // A. Nếu là vai trò nhân viên công ty (Manager, Dispatcher, Driver, Warehouse):
    // Khóa toàn bộ các thanh điều hướng và trang nghiệp vụ, hiển thị TrialExpiredLockedView
    if (user.role !== 'companyAdmin') {
      return <TrialExpiredLockedView />
    }

    // B. Nếu là Company Admin: Chỉ cho phép truy cập duy nhất trang "Gói và Credit" (/goi-cuoc)
    // Các trang thanh toán /thanh-toan/** cũng được phép để hoàn tất quy trình mua gói
    const isBillingPath =
      location.pathname === '/goi-cuoc' ||
      location.pathname.startsWith('/thanh-toan')
    if (!isBillingPath) {
      return <Navigate to="/goi-cuoc" replace />
    }
  }

  return (
    <div className="app-shell flex h-dvh flex-col overflow-hidden bg-app">
      <NavRail />
      <TrialAgreementNotifier />
      <div className="relative flex min-h-0 min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  )
}
