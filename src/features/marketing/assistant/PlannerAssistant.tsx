import { Button } from '@/components/ui/Button'
import { useAuthSafe } from '@/features/auth/AuthProvider'
import { cn } from '@/lib/utils'
import { appAssistantShown } from './AppAssistant'
import { AssistantAvatar } from './AssistantAvatar'
import { ASSISTANT_PANEL_ID } from './assistant-session'
import { AssistantSurfaceContext } from './assistant-surface'
import { useAssistantLauncher } from './useAssistantLauncher'

/**
 * Nút "Trợ lý AI" của Planner bản máy chủ, ở hàng góc dưới phải khung 3D (`SceneHud`, cạnh "Chi tiết / Hiển thị") — Planner là màn toàn
 * màn hình, không có thanh điều hướng. Cùng cuộc trò chuyện với nút của thanh điều hướng; câu hỏi gửi kèm phương án đang xem
 * (`viewer-bridge.ts`), câu trả lời có thể chọn kiện, đổi góc nhìn, bước, chế độ màu hay mở danh sách kiện. Từ 768 px (hẹp hơn khung
 * 3D không còn chỗ), dưới 1.280 px chỉ ảnh Lumo; khung chat đứng ngay trên nút (`data-dock='planner'`, `assistant.css`).
 */
export function PlannerAssistant() {
  const user = useAuthSafe()?.user
  if (!appAssistantShown(user)) return null
  return (
    <AssistantSurfaceContext value="app">
      <PlannerAssistantButton />
    </AssistantSurfaceContext>
  )
}

function PlannerAssistantButton() {
  const { label, open, pending, ref, toggle, panel } = useAssistantLauncher('planner')
  return (
    <>
      <Button
        ref={ref}
        variant="glass"
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? ASSISTANT_PANEL_ID : undefined}
        onClick={toggle}
        className={cn(
          'assistant-rail pointer-events-auto hidden size-14 shrink-0 p-0 glass-dark md:flex xl:h-10 xl:w-auto xl:pr-3.5 xl:pl-1',
          'aria-expanded:shadow-[0_0_0_2px_var(--cyan-300)]',
        )}
      >
        <span className="assistant-avatar-ring" data-thinking={pending || undefined}>
          <AssistantAvatar pose="wink" size="xs" />
        </span>
        <span className="hidden xl:inline">{label}</span>
      </Button>
      {panel}
    </>
  )
}
