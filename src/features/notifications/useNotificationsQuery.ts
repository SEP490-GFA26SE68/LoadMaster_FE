import { skipToken, useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthProvider'
import { hasNotifications } from './notifications'
import { fetchNotifications, notificationsReachable } from './notifications-api'

/** Làm mới nhẹ khi tab đang mở: một phút một lần (không chạy khi tab ẩn). Mở chuông thì đọc lại ngay. */
const REFRESH_MS = 60_000

/** Thông báo của người đang đăng nhập (LM-098). Vai trò không có loại thông báo nào, hoặc nguồn đã nối backend, thì không đọc kho. */
export function useNotificationsQuery() {
  const { user } = useAuth()
  const viewer = user && hasNotifications(user.role) && notificationsReachable(user.role) ? { id: user.id, role: user.role } : null
  return useQuery({
    queryKey: ['notifications', viewer?.id, viewer?.role],
    queryFn: viewer ? () => fetchNotifications(viewer) : skipToken,
    refetchInterval: REFRESH_MS,
    staleTime: 0,
  })
}
