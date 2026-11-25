import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useRef, useSyncExternalStore, type RefObject } from 'react'
import { LUMO_NAME } from '@/components/brand/Lumo'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { ASSISTANT_USES_AI } from './assistant-api'
import { ASSISTANT_PANEL_ID, assistantSession, useAssistantSession } from './assistant-session'
import { useAssistantSurface } from './assistant-surface'
import { AssistantComposer, focusAssistantInput } from './AssistantComposer'
import { AssistantLog } from './AssistantLog'
import { AssistantPanelHeader } from './AssistantPanelHeader'
import { useAssistantChat, useAssistantContext } from './useAssistantChat'
import type { AssistantDock } from './useAssistantLauncher'
import { usePanelPlacement } from './usePanelPlacement'

const PHONE_QUERY = '(max-width: 767.98px)'
const hasMatchMedia = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
function subscribePhone(onChange: () => void) {
  if (!hasMatchMedia()) return () => {}
  const media = window.matchMedia(PHONE_QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}
const isPhone = () => hasMatchMedia() && window.matchMedia(PHONE_QUERY).matches

/**
 * Khung chat của trợ lý (chunk lười, tải ở lần mở đầu tiên). Từ 768 px: thẻ trắng không modal cạnh nút mở — vẫn đọc và dùng được trang,
 * Tab ra ngoài được, bấm ra ngoài không đóng. Dưới 768 px: tờ phủ cả màn, modal (`aria-modal`, phần trang phía sau bị ẩn khỏi trình đọc
 * màn hình, bẫy focus). Mở thì focus vào ô gõ; Esc (khi focus ở khung hoặc nút mở) hay nút đóng thì focus về nút mở — trừ khi đóng để
 * điều hướng (liên kết của câu trả lời, chuyển sang form liên hệ): trang đích tự đặt focus. `skipInitialFocus`: khung dựng lại khi đã mở
 * sẵn (chuyển giữa hai trang công khai) thì không giành focus của trang. Mô tả của hộp thoại là dòng nhỏ dưới ô gõ: Lumo trả lời từ tài
 * liệu, không phải nhân viên tư vấn (nối máy chủ: Lumo là trợ lý AI và có thể nhầm). Từ 768 px nút phóng to ở đầu khung mở khung rộng 720 px, cao gần hết màn để đọc câu trả lời dài; nhãn
 * của nút đổi theo trạng thái ("Phóng to" / "Thu nhỏ"). Từ 768 px khung kéo đi được bằng đầu khung, hay dời bằng phím ở tay nắm
 * (`usePanelPlacement`); chỗ đã chọn nằm trong phiên trò chuyện.
 */
export default function AssistantPanel({ launcherRef, skipInitialFocus = false, dock }: {
  launcherRef: RefObject<HTMLButtonElement | null>
  skipInitialFocus?: boolean
  /**
   * `planner`: khung neo góc dưới phải, trên hàng nút của khung 3D (Planner không có thanh điều hướng). `touch`: màn cảm ứng kho, tài xế —
   * từ 768 px neo góc phải ngay dưới thanh dải trời; chữ 16 px, nút 56 px (lớp `assistant-touch`, biến thể `in-[.assistant-touch]:`).
   */
  dock?: AssistantDock
}) {
  const t = useT()
  const { open, entries, pending, expanded, placement } = useAssistantSession()
  const phone = useSyncExternalStore(subscribePhone, isPhone, () => false)
  const context = useAssistantContext()
  const surface = useAssistantSurface()
  const disclaimer = !ASSISTANT_USES_AI ? 'assistant.panel.disclaimer' : surface === 'app' ? 'assistant.panel.disclaimerAiApp' : 'assistant.panel.disclaimerAi'
  const contentRef = useRef<HTMLDivElement>(null)
  const skipFocus = useRef(skipInitialFocus)
  const returnFocus = useRef(true)

  function leave() {
    returnFocus.current = false
    assistantSession.setOpen(false)
  }
  const chat = useAssistantChat(leave)
  const { panelRef, gripRef, announcement, resetPlacement, headerHandlers, handleGripKeyDown } = usePanelPlacement({ contentRef, phone, placement, expanded, surface, dock })

  function handleRestart() {
    assistantSession.restart()
    focusAssistantInput()
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={assistantSession.setOpen} modal={phone}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-200 bg-scrim" />
        <DialogPrimitive.Content
          ref={panelRef}
          id={ASSISTANT_PANEL_ID}
          data-expanded={expanded || undefined}
          // Chỗ mặc định theo bề mặt và nơi neo (assistant.css); người dùng dời khung thì vị trí nằm ở style (usePanelPlacement)
          data-surface={surface}
          data-dock={dock}
          aria-modal={phone ? true : undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            if (skipFocus.current) skipFocus.current = false
            else focusAssistantInput()
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            if (returnFocus.current) launcherRef.current?.focus()
            returnFocus.current = true
          }}
          onEscapeKeyDown={(event) => {
            const active = document.activeElement
            if (!phone && !contentRef.current?.contains(active) && active !== launcherRef.current) event.preventDefault()
          }}
          onInteractOutside={(event) => {
            if (!phone) event.preventDefault()
          }}
          className={cn(
            'assistant-panel flex flex-col overflow-hidden bg-bg text-text outline-none',
            dock === 'touch' && 'assistant-touch',
            'data-[state=open]:animate-[lm-sheet-in_260ms_var(--ease-decelerate)]',
            'md:rounded-xl md:border md:border-border md:shadow-e2 md:data-[state=open]:animate-[lm-dialog-in_220ms_var(--ease-standard)]',
          )}
        >
          <AssistantPanelHeader
            phone={phone}
            pending={pending}
            hasEntries={entries.length > 0}
            expanded={expanded}
            moved={placement !== null}
            gripRef={gripRef}
            headerHandlers={headerHandlers}
            onGripKeyDown={handleGripKeyDown}
            onRestart={handleRestart}
            onToggleExpanded={() => assistantSession.setExpanded(!expanded)}
            onResetPlacement={resetPlacement}
          />
          {/* Vị trí sau khi dời bằng phím — ngắn, chỉ cho trình đọc màn hình */}
          <p className="sr-only" aria-live="polite">{announcement}</p>
          {/* Vạch gradient chạy ngang khi Lumo đang trả lời (assistant.css) — chỉ là hình, vùng log đã có dấu "đang gõ" */}
          <div aria-hidden className="assistant-thinking-bar flex-none" data-on={pending || undefined} />
          <AssistantLog
            entries={entries}
            pending={pending}
            context={context}
            onAsk={chat.send}
            onRuns={chat.sendRuns}
            onHandoff={chat.handoff}
            onEscalate={chat.escalate}
            onBriefing={chat.briefing}
            onNavigate={phone ? leave : undefined}
          />
          <AssistantComposer onSend={chat.send} pending={pending}>
            {/* Mô tả của hộp thoại: trình đọc màn hình đọc câu này cùng tên "Lumo" khi khung mở */}
            <DialogPrimitive.Description className="m-0 text-center text-fine text-ink-3 pointer-coarse:text-body-lg in-[.assistant-touch]:text-body-lg">
              {t(disclaimer, { name: LUMO_NAME })}
            </DialogPrimitive.Description>
          </AssistantComposer>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
