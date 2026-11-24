import { lazy, Suspense, useLayoutEffect, useRef, useState } from 'react'
import { LUMO_NAME } from '@/components/brand/Lumo'
import { useAuthSafe } from '@/features/auth/AuthProvider'
import { useT } from '@/lib/i18n'
import { assistantSession, useAssistantSession } from './assistant-session'
import { useAssistantSurface } from './assistant-surface'
import './assistant.css'

const AssistantPanel = lazy(() => import('./AssistantPanel'))

/**
 * Phần chung của hai nút mở trợ lý — nút nổi "Hỏi Lumo" của hai trang công khai (`AssistantLauncher`) và nút "Trợ lý AI" trên thanh điều
 * hướng của ứng dụng (`AppAssistant`). Cuộc trò chuyện gắn với người đang xem và bề mặt (`assistantSession.bind`, trước khi vẽ: cuộc trò
 * chuyện của người trước không hiện ra dù chỉ một khung hình). Khung chat là chunk lười, chỉ tải ở lần mở đầu tiên rồi giữ lại để đóng /
 * mở không tải lại; dựng lại khi khung đã mở sẵn (chuyển giữa hai trang công khai) thì khung không giành focus của trang. `dock`: nơi
 * neo khung khi trang không có thanh điều hướng (Planner — nút "Trợ lý AI" ở góc dưới phải khung 3D, `PlannerAssistant`; màn cảm ứng
 * kho, tài xế — nút trên thanh dải trời, `TouchAssistant`).
 */
export type AssistantDock = 'planner' | 'touch'

export function useAssistantLauncher(dock?: AssistantDock) {
  const t = useT()
  const surface = useAssistantSurface()
  const userId = useAuthSafe()?.user?.id ?? ''
  useLayoutEffect(() => assistantSession.bind(`${surface}:${userId}`), [surface, userId])
  const label = surface === 'app' ? t('assistant.launcher.labelApp') : t('assistant.launcher.label', { name: LUMO_NAME })
  const { open, pending } = useAssistantSession()
  const [loaded, setLoaded] = useState(open)
  const [mountedOpen] = useState(open)
  const ref = useRef<HTMLButtonElement>(null)

  function toggle() {
    setLoaded(true)
    assistantSession.setOpen(!assistantSession.get().open)
  }

  const panel = loaded ? (
    <Suspense fallback={null}>
      <AssistantPanel launcherRef={ref} skipInitialFocus={mountedOpen} dock={dock} />
    </Suspense>
  ) : null

  return { label, open, pending, ref, toggle, panel }
}
