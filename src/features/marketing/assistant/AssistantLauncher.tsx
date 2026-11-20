import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AssistantAvatar } from './AssistantAvatar'
import { ASSISTANT_PANEL_ID } from './assistant-session'
import { useAssistantLauncher } from './useAssistantLauncher'
import { useLauncherLift } from './useLauncherLift'

/**
 * Nút "Hỏi Lumo" góc dưới phải của hai trang công khai — trợ lý thụ động: không tự mở, không tự bật lời mời. Từ 640 px có chữ cạnh ảnh
 * Lumo; hẹp hơn chỉ còn ảnh (chữ vẫn là tên truy cập). 48 px, 56 px trên máy cảm ứng. Khung chat, cuộc trò chuyện và việc gắn cuộc trò
 * chuyện với người xem ở `useAssistantLauncher`. Nút nâng lên khi chạm điều khiển quan trọng của trang (`useLauncherLift`). Viền gradient
 * quay (`assistant.css`): đứng yên lúc nghỉ, quay khi rê chuột / focus và khi Lumo đang trả lời. Khung đang mở thì nút thành nút thu gọn:
 * chỉ còn mũi tên xuống, bấm là đóng khung. Tên truy cập vẫn là "Hỏi Lumo" — trạng thái mở nằm ở `aria-expanded`, không đổi tên theo
 * trạng thái (mẫu nút mở rộng của ARIA APG). Trong ứng dụng nút mở là `AppAssistant` trên thanh điều hướng, không phải nút nổi này.
 */
export function AssistantLauncher() {
  const { label, open, pending, ref, toggle, panel } = useAssistantLauncher()
  useLauncherLift(ref)

  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? ASSISTANT_PANEL_ID : undefined}
        // Viền gradient quay trong lúc Lumo đang trả lời (assistant.css); chỉ là hình — khung chat đã đọc "đang trả lời"
        data-thinking={pending || undefined}
        onClick={toggle}
        className={cn(
          'assistant-launcher inline-flex h-12 min-w-12 items-center justify-center gap-2.5 rounded-lg border border-border bg-bg p-1.5 shadow-e2',
          'text-body font-semibold text-ink-strong hover:bg-surface',
          !open && 'sm:pr-4',
          'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          'pointer-coarse:h-14 pointer-coarse:min-w-14 pointer-coarse:text-body-lg',
        )}
      >
        {open ? (
          <>
            <ChevronDown aria-hidden className="assistant-launcher-swap size-6" strokeWidth={1.5} />
            <span className="sr-only">{label}</span>
          </>
        ) : (
          <>
            <AssistantAvatar pose="wink" className="assistant-launcher-swap pointer-coarse:size-11" />
            <span className="sr-only sm:not-sr-only">{label}</span>
          </>
        )}
      </button>
      {panel}
    </>
  )
}
