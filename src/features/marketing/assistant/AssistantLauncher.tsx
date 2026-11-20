import { ChevronDown } from 'lucide-react'
import { lazy, Suspense, useLayoutEffect, useRef, useState } from 'react'
import { LUMO_NAME } from '@/components/brand/Lumo'
import { useAuthSafe } from '@/features/auth/AuthProvider'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { AssistantAvatar } from './AssistantAvatar'
import { ASSISTANT_PANEL_ID, assistantSession, useAssistantSession } from './assistant-session'
import { useAssistantSurface } from './assistant-surface'
import { useLauncherLift } from './useLauncherLift'
import './assistant.css'

const AssistantPanel = lazy(() => import('./AssistantPanel'))

/**
 * Nút "Hỏi Lumo" góc dưới phải của hai trang công khai — trợ lý thụ động: không tự mở, không tự bật lời mời. Từ 640 px có chữ cạnh ảnh
 * Lumo; hẹp hơn chỉ còn ảnh (chữ vẫn là tên truy cập). 48 px, 56 px trên máy cảm ứng. Khung chat là chunk lười, chỉ tải lần mở đầu tiên,
 * rồi giữ lại để đóng / mở không tải lại; cuộc trò chuyện ở `assistant-session.ts`. Nút nâng lên khi chạm điều khiển quan trọng của trang
 * (`useLauncherLift`). Viền gradient quay (`assistant.css`): đứng yên lúc nghỉ, quay khi rê chuột / focus và khi Lumo đang trả lời.
 * Khung đang mở thì nút thành nút thu gọn: chỉ còn mũi tên xuống, bấm là đóng khung. Tên truy cập vẫn là "Hỏi Lumo" — trạng thái mở
 * nằm ở `aria-expanded`, không đổi tên theo trạng thái (mẫu nút mở rộng của ARIA APG). Trong ứng dụng (`AppAssistant`) tên nút là "Trợ lý
 * AI". Cuộc trò chuyện gắn với người đang xem và bề mặt (`assistantSession.bind`): đổi người là cuộc trò chuyện cũ không theo sang.
 */
export function AssistantLauncher() {
  const t = useT()
  const surface = useAssistantSurface()
  const userId = useAuthSafe()?.user?.id ?? ''
  // Trước khi vẽ: cuộc trò chuyện của người trước không hiện ra dù chỉ một khung hình
  useLayoutEffect(() => assistantSession.bind(`${surface}:${userId}`), [surface, userId])
  const label = surface === 'app' ? t('assistant.launcher.labelApp') : t('assistant.launcher.label', { name: LUMO_NAME })
  const { open, pending } = useAssistantSession()
  const [loaded, setLoaded] = useState(open)
  // Dựng lại khi khung đã mở sẵn (chuyển giữa hai trang công khai): khung không giành focus của trang
  const [mountedOpen] = useState(open)
  const ref = useRef<HTMLButtonElement>(null)
  useLauncherLift(ref)

  function handleToggle() {
    setLoaded(true)
    assistantSession.setOpen(!assistantSession.get().open)
  }

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
        onClick={handleToggle}
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
      {loaded ? (
        <Suspense fallback={null}>
          <AssistantPanel launcherRef={ref} skipInitialFocus={mountedOpen} />
        </Suspense>
      ) : null}
    </>
  )
}
