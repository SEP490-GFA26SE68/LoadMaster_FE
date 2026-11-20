import { useAuthSafe } from '@/features/auth/AuthProvider'
import { usesBackend } from '@/lib/backend-config'
import { cn } from '@/lib/utils'
import { isPlatformRole, type User } from '@/types/user'
import { AssistantAvatar } from './AssistantAvatar'
import { ASSISTANT_PANEL_ID } from './assistant-session'
import { AssistantSurfaceContext } from './assistant-surface'
import { useAssistantLauncher } from './useAssistantLauncher'

/** Đọc thẳng cờ của nhóm, không qua `assistant-api.ts`: khung ứng dụng không kéo bộ câu trả lời soạn sẵn vào chunk của nó. */
const ASSISTANT_ON = usesBackend('assistant')

/**
 * Người này có nút "Trợ lý AI" không — chỉ khi nhóm `assistant` nối máy chủ (kho mẫu không có). Người bị gắn cờ hay công ty không còn gói
 * hiệu lực thì không: máy chủ từ chối trợ lý trong ứng dụng với họ như mọi API nghiệp vụ. Thanh điều hướng cũng hỏi hàm này để chừa chỗ.
 */
export function appAssistantShown(user: User | null | undefined): boolean {
  if (!ASSISTANT_ON || !user) return false
  return user.status !== 'flagged' && !(user.subscriptionExpired && !isPlatformRole(user.role))
}

/**
 * Nút "Trợ lý AI" trên thanh điều hướng của khung ứng dụng (`NavRail`), cạnh tìm nhanh — như trợ lý AI của các ứng dụng nhiều dữ liệu, không
 * nổi đè lên bảng: nút nổi góc dưới phải che nút phân trang, nút thao tác của dòng và khung xử lý bên phải. Màn toàn màn hình (Planner, kho,
 * tài xế) không có thanh điều hướng nên không có nút. Câu hỏi đi tới `POST /api/assistant/messages` kèm màn đang mở; khung chat neo góc
 * trên phải, ngay dưới thanh (`assistant.css`).
 */
export function AppAssistant() {
  const user = useAuthSafe()?.user
  if (!appAssistantShown(user)) return null
  return (
    <AssistantSurfaceContext value="app">
      <AppAssistantButton />
    </AssistantSurfaceContext>
  )
}

/**
 * Nút 36 px như mọi nút của thanh: ảnh Lumo trong vòng gradient trợ lý — đứng yên lúc nghỉ, quay khi rê chuột / focus và khi Lumo đang trả
 * lời. Tên chỉ ở `aria-label` và `title` (thanh không còn chỗ cho chữ ở 1.366 px); khung đang mở thì quầng cyan như nút tài khoản, trạng
 * thái nằm ở `aria-expanded`.
 */
function AppAssistantButton() {
  const { label, open, pending, ref, toggle, panel } = useAssistantLauncher()
  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? ASSISTANT_PANEL_ID : undefined}
        onClick={toggle}
        className={cn(
          'assistant-rail flex size-9 flex-none items-center justify-center rounded-[calc(var(--r-md)+2px)]',
          'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300',
          'aria-expanded:shadow-[0_0_0_2px_var(--cyan-300)]',
        )}
      >
        <span className="assistant-avatar-ring" data-thinking={pending || undefined}>
          <AssistantAvatar pose="wink" size="rail" />
        </span>
      </button>
      {panel}
    </>
  )
}
