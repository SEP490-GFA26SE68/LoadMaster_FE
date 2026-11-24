import { useLayoutEffect, type RefObject } from 'react'
import { useAuthSafe } from '@/features/auth/AuthProvider'
import { cn } from '@/lib/utils'
import { appAssistantShown } from './AppAssistant'
import { AssistantAvatar } from './AssistantAvatar'
import { ASSISTANT_PANEL_ID } from './assistant-session'
import { AssistantSurfaceContext } from './assistant-surface'
import { useAssistantLauncher } from './useAssistantLauncher'

/**
 * Nút "Trợ lý AI" của màn cảm ứng toàn màn hình — kho (`/kho`, soạn, xếp, xếp xong) và tài xế (`/tai-xe`, điểm giao, tổng kết): những màn
 * này không có thanh điều hướng của khung ứng dụng nên nút nằm trên thanh dải trời `TouchTopBar` (prop `assistant`), cạnh ngôn ngữ, chuông,
 * tài khoản. Cùng điều kiện với nút của thanh điều hướng (`appAssistantShown`: nhóm `assistant` nối máy chủ, người không bị gắn cờ, công ty
 * còn gói) — kho mẫu không có trợ lý nên không có nút (D-20). Nút 56 px, điều khiển ĐẶC như mọi nút của thanh (nền `--sky-solid`, không
 * kính). Khung chat là bản cảm ứng (`dock='touch'`, `AssistantPanel`): dưới 768 px phủ cả màn, từ 768 px neo góc phải ngay dưới thanh — đáy
 * thanh đo ở đây và ghi vào `--assistant-touch-top` trên <html> (thanh màn tài xế cao theo nội dung).
 */
export function TouchAssistant() {
  const user = useAuthSafe()?.user
  if (!appAssistantShown(user)) return null
  return (
    <AssistantSurfaceContext value="app">
      <TouchAssistantButton />
    </AssistantSurfaceContext>
  )
}

function TouchAssistantButton() {
  const { label, open, pending, ref, toggle, panel } = useAssistantLauncher('touch')
  useTouchBarBottom(ref)
  return (
    <>
      <button
        ref={ref}
        type="button"
        data-touch-assistant
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? ASSISTANT_PANEL_ID : undefined}
        onClick={toggle}
        className={cn(
          'assistant-rail grid size-14 flex-none place-items-center rounded-md border border-sky-solid-border bg-sky-solid',
          'transition-colors duration-(--dur-fast) ease-standard hover:bg-sky-solid-hover aria-expanded:bg-sky-solid-hover',
          'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300',
        )}
      >
        <span className="assistant-avatar-ring" data-thinking={pending || undefined}>
          <AssistantAvatar pose="wink" size="sm" />
        </span>
      </button>
      {panel}
    </>
  )
}

/** Ghi đáy của thanh chứa nút vào `--assistant-touch-top` (px) để khung chat từ 768 px đứng ngay dưới thanh; gỡ nút thì xoá biến. */
function useTouchBarBottom(ref: RefObject<HTMLButtonElement | null>) {
  useLayoutEffect(() => {
    const bar = ref.current?.closest('header')
    if (!bar) return
    const root = document.documentElement
    const write = () => root.style.setProperty('--assistant-touch-top', `${Math.round(bar.getBoundingClientRect().bottom)}px`)
    write()
    if (typeof ResizeObserver === 'undefined') return () => root.style.removeProperty('--assistant-touch-top')
    const observer = new ResizeObserver(write)
    observer.observe(bar)
    return () => {
      observer.disconnect()
      root.style.removeProperty('--assistant-touch-top')
    }
  }, [ref])
}
