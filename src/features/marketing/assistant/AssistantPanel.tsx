import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Maximize2, Minimize2, RotateCcw, X } from 'lucide-react'
import { useRef, useSyncExternalStore, type RefObject } from 'react'
import { LUMO_NAME } from '@/components/brand/Lumo'
import { SKY_FOCUS } from '@/components/sky-focus'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { ASSISTANT_USES_AI } from './assistant-api'
import { ASSISTANT_PANEL_ID, assistantSession, useAssistantSession } from './assistant-session'
import { useAssistantSurface } from './assistant-surface'
import { AssistantAvatar } from './AssistantAvatar'
import { AssistantComposer, focusAssistantInput } from './AssistantComposer'
import { AssistantLog } from './AssistantLog'
import { useAssistantChat, useAssistantContext } from './useAssistantChat'

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
 * của nút đổi theo trạng thái ("Phóng to" / "Thu nhỏ").
 */
export default function AssistantPanel({ launcherRef, skipInitialFocus = false }: {
  launcherRef: RefObject<HTMLButtonElement | null>
  skipInitialFocus?: boolean
}) {
  const t = useT()
  const { open, entries, pending, expanded } = useAssistantSession()
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

  function handleRestart() {
    assistantSession.restart()
    focusAssistantInput()
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={assistantSession.setOpen} modal={phone}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-200 bg-scrim" />
        <DialogPrimitive.Content
          ref={contentRef}
          id={ASSISTANT_PANEL_ID}
          data-expanded={expanded || undefined}
          // Trong ứng dụng khung neo góc trên phải, dưới nút "Trợ lý AI" của thanh điều hướng (assistant.css)
          data-surface={surface}
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
            'data-[state=open]:animate-[lm-sheet-in_260ms_var(--ease-decelerate)]',
            'md:rounded-xl md:border md:border-border md:shadow-e2 md:data-[state=open]:animate-[lm-dialog-in_220ms_var(--ease-standard)]',
          )}
        >
          <div className="flex flex-none items-center gap-3 bg-sky-end bg-(image:--sky) px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 text-sky-text md:pt-3">
            {/* Vòng gradient trợ lý quanh ảnh (assistant.css): đứng yên lúc nghỉ, quay khi Lumo đang trả lời — chỉ là hình */}
            <span className="assistant-avatar-ring" data-thinking={pending || undefined}>
              <AssistantAvatar pose="explain" size="md" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <DialogPrimitive.Title className="m-0 font-display text-h3 font-[650] font-stretch-108% text-sky-text">{LUMO_NAME}</DialogPrimitive.Title>
              <p className="m-0 text-small text-sky-text-2 pointer-coarse:text-body-lg">{t('assistant.panel.subtitle')}</p>
            </div>
            {entries.length > 0 ? (
              <Button
                type="button"
                variant="skyGhost"
                size="icon"
                onClick={handleRestart}
                aria-label={t('assistant.panel.restart')}
                title={t('assistant.panel.restart')}
                className={cn(SKY_FOCUS, 'pointer-coarse:size-12')}
              >
                <RotateCcw aria-hidden />
              </Button>
            ) : null}
            {/* Phóng to chỉ từ 768 px: dưới đó khung đã phủ cả màn */}
            <Button
              type="button"
              variant="skyGhost"
              size="icon"
              onClick={() => assistantSession.setExpanded(!expanded)}
              aria-label={t(expanded ? 'assistant.panel.shrink' : 'assistant.panel.expand')}
              title={t(expanded ? 'assistant.panel.shrink' : 'assistant.panel.expand')}
              className={cn(SKY_FOCUS, 'hidden md:inline-flex')}
            >
              {expanded ? <Minimize2 aria-hidden /> : <Maximize2 aria-hidden />}
            </Button>
            <DialogPrimitive.Close asChild>
              <Button type="button" variant="skyGhost" size="icon" aria-label={t('assistant.panel.close')} className={cn(SKY_FOCUS, 'pointer-coarse:size-12')}>
                <X aria-hidden />
              </Button>
            </DialogPrimitive.Close>
          </div>
          {/* Vạch gradient chạy ngang khi Lumo đang trả lời (assistant.css) — chỉ là hình, vùng log đã có dấu "đang gõ" */}
          <div aria-hidden className="assistant-thinking-bar flex-none" data-on={pending || undefined} />
          <AssistantLog
            entries={entries}
            pending={pending}
            context={context}
            onAsk={chat.send}
            onRuns={chat.sendRuns}
            onHandoff={chat.handoff}
            onBriefing={chat.briefing}
            onNavigate={phone ? leave : undefined}
          />
          <AssistantComposer onSend={chat.send} pending={pending}>
            {/* Mô tả của hộp thoại: trình đọc màn hình đọc câu này cùng tên "Lumo" khi khung mở */}
            <DialogPrimitive.Description className="m-0 text-center text-fine text-ink-3 pointer-coarse:text-body-lg">
              {t(disclaimer, { name: LUMO_NAME })}
            </DialogPrimitive.Description>
          </AssistantComposer>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
