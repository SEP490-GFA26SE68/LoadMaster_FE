import { useAuthSafe } from '@/features/auth/AuthProvider'
import { usesBackend } from '@/lib/backend-config'
import { isPlatformRole } from '@/types/user'
import { AssistantSurfaceContext } from './assistant-surface'
import { AssistantLauncher } from './AssistantLauncher'

/** Đọc thẳng cờ của nhóm, không qua `assistant-api.ts`: khung ứng dụng không kéo bộ câu trả lời soạn sẵn vào chunk của nó. */
const ASSISTANT_ON = usesBackend('assistant')

/**
 * Nút "Trợ lý AI" góc dưới phải của khung ứng dụng (`AppShell`) — chỉ khi nhóm `assistant` nối máy chủ (kho mẫu không có). Màn toàn màn
 * hình (Planner, kho, tài xế) nằm ngoài `AppShell` nên không có nút. Người bị gắn cờ hay công ty không còn gói hiệu lực không có nút: máy
 * chủ từ chối trợ lý trong ứng dụng với họ như mọi API nghiệp vụ. Câu hỏi đi tới `POST /api/assistant/messages` kèm màn đang mở.
 */
export function AppAssistant() {
  const user = useAuthSafe()?.user
  if (!ASSISTANT_ON || !user) return null
  if (user.status === 'flagged' || (user.subscriptionExpired && !isPlatformRole(user.role))) return null
  return (
    <AssistantSurfaceContext value="app">
      <AssistantLauncher />
    </AssistantSurfaceContext>
  )
}
