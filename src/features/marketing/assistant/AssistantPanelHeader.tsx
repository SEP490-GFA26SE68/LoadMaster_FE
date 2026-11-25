import * as DialogPrimitive from '@radix-ui/react-dialog'
import { GripVertical, LocateFixed, Maximize2, Minimize2, RotateCcw, X } from 'lucide-react'
import type { KeyboardEvent, PointerEventHandler, RefObject } from 'react'
import { LUMO_NAME } from '@/components/brand/Lumo'
import { SKY_FOCUS } from '@/components/sky-focus'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { AssistantAvatar } from './AssistantAvatar'

const KEYS = 'ArrowLeft ArrowRight ArrowUp ArrowDown Shift+ArrowLeft Shift+ArrowRight Shift+ArrowUp Shift+ArrowDown Home'

/**
 * Đầu khung chat trên dải trời: ảnh Lumo, tên, các nút. Từ 768 px đầu khung là chỗ nắm để kéo khung đi (con trỏ `grab`), kèm tay nắm là
 * một nút focus được — "Di chuyển khung chat": mũi tên dời 16 px, Shift + mũi tên 64 px, Home về chỗ mặc định (WCAG 2.5.7: dời được mà
 * không cần kéo). "Về chỗ mặc định" chỉ hiện khi khung đã bị dời. Dưới 768 px (tờ phủ cả màn) không có tay nắm.
 */
export function AssistantPanelHeader({ phone, pending, hasEntries, expanded, moved, gripRef, headerHandlers, onGripKeyDown, onRestart, onToggleExpanded, onResetPlacement }: {
  phone: boolean
  pending: boolean
  hasEntries: boolean
  expanded: boolean
  moved: boolean
  gripRef: RefObject<HTMLButtonElement | null>
  headerHandlers: Record<'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel', PointerEventHandler<HTMLElement>>
  onGripKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void
  onRestart: () => void
  onToggleExpanded: () => void
  onResetPlacement: () => void
}) {
  const t = useT()
  const iconClass = cn(SKY_FOCUS, 'pointer-coarse:size-12 in-[.assistant-touch]:size-14')
  return (
    <div
      {...(phone ? {} : headerHandlers)}
      className={cn(
        'assistant-panel-head flex flex-none items-center gap-3 bg-sky-end bg-(image:--sky) px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 text-sky-text md:pt-3',
        !phone && 'gap-2 pl-2',
      )}
    >
      {phone ? null : (
        <Button
          ref={gripRef}
          type="button"
          variant="skyGhost"
          size="icon"
          onKeyDown={onGripKeyDown}
          aria-label={t('assistant.panel.move')}
          title={t('assistant.panel.moveHint')}
          aria-keyshortcuts={KEYS}
          className={cn(SKY_FOCUS, 'assistant-grip in-[.assistant-touch]:size-14')}
        >
          <GripVertical aria-hidden />
        </Button>
      )}
      {/* Vòng gradient trợ lý quanh ảnh (assistant.css): đứng yên lúc nghỉ, quay khi Lumo đang trả lời — chỉ là hình */}
      <span className="assistant-avatar-ring" data-thinking={pending || undefined}>
        <AssistantAvatar pose="explain" size="md" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col select-none">
        <DialogPrimitive.Title className="m-0 font-display text-h3 font-[650] font-stretch-108% text-sky-text">{LUMO_NAME}</DialogPrimitive.Title>
        <p className="m-0 text-small text-sky-text-2 pointer-coarse:text-body-lg in-[.assistant-touch]:text-body-lg">{t('assistant.panel.subtitle')}</p>
      </div>
      {moved && !phone ? (
        <Button
          type="button"
          variant="skyGhost"
          size="icon"
          onClick={onResetPlacement}
          aria-label={t('assistant.panel.resetPosition')}
          title={t('assistant.panel.resetPosition')}
          className={iconClass}
        >
          <LocateFixed aria-hidden />
        </Button>
      ) : null}
      {hasEntries ? (
        <Button type="button" variant="skyGhost" size="icon" onClick={onRestart} aria-label={t('assistant.panel.restart')} title={t('assistant.panel.restart')} className={iconClass}>
          <RotateCcw aria-hidden />
        </Button>
      ) : null}
      {/* Phóng to chỉ từ 768 px: dưới đó khung đã phủ cả màn */}
      <Button
        type="button"
        variant="skyGhost"
        size="icon"
        onClick={onToggleExpanded}
        aria-label={t(expanded ? 'assistant.panel.shrink' : 'assistant.panel.expand')}
        title={t(expanded ? 'assistant.panel.shrink' : 'assistant.panel.expand')}
        className={cn(SKY_FOCUS, 'hidden md:inline-flex in-[.assistant-touch]:size-14')}
      >
        {expanded ? <Minimize2 aria-hidden /> : <Maximize2 aria-hidden />}
      </Button>
      <DialogPrimitive.Close asChild>
        <Button type="button" variant="skyGhost" size="icon" aria-label={t('assistant.panel.close')} className={iconClass}>
          <X aria-hidden />
        </Button>
      </DialogPrimitive.Close>
    </div>
  )
}
