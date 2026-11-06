import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthProvider'
import { hasNotifications } from './notifications'
import {
  fetchNotifications,
  fetchServerNotifications,
  markServerNotificationsRead,
  notificationsReachable,
  serverNotifications,
} from './notifications-api'

/** Làm mới nhẹ khi tab đang mở: một phút một lần (không chạy khi tab ẩn). Mở chuông thì đọc lại ngay. */
const REFRESH_MS = 60_000

/** Người xem có chuông với nguồn đang dùng; `null` thì không đọc gì. */
function useBellViewer(server: boolean) {
  const { user } = useAuth()
  const active = user && hasNotifications(user.role) && notificationsReachable(user.role) && serverNotifications() === server
  return active ? { id: user.id, role: user.role } : null
}

/** Thông báo của người đang đăng nhập từ kho mẫu (LM-098). Vai trò không có loại thông báo nào, hoặc nguồn đã nối backend, thì không đọc kho. */
export function useNotificationsQuery() {
  const viewer = useBellViewer(false)
  return useQuery({
    queryKey: ['notifications', viewer?.id, viewer?.role],
    queryFn: viewer ? () => fetchNotifications(viewer) : skipToken,
    refetchInterval: REFRESH_MS,
    staleTime: 0,
  })
}

/** Thông báo của máy chủ (nhóm `notifications` nối backend): máy chủ lọc theo người xem và giữ đã đọc. */
export function useServerNotificationsQuery() {
  const viewer = useBellViewer(true)
  return useQuery({
    queryKey: ['notifications', 'server', viewer?.id, viewer?.role],
    queryFn: viewer ? fetchServerNotifications : skipToken,
    refetchInterval: REFRESH_MS,
    staleTime: 0,
  })
}

/** Đánh dấu đã đọc ở máy chủ; danh sách máy chủ trả lại thay bản đang hiện. */
export function useMarkServerNotificationsRead() {
  const viewer = useBellViewer(true)
  const client = useQueryClient()
  return useMutation({
    mutationFn: markServerNotificationsRead,
    onSuccess: (feed) => client.setQueryData(['notifications', 'server', viewer?.id, viewer?.role], feed),
  })
}
