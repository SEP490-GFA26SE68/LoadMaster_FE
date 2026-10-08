import { ChevronLeft, LogOut } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useAuth } from './AuthProvider'
import { exitAction } from './exit'

type ExitTarget = {
  /**
   * Đường dẫn màn nút này nằm trên (`/kho`, `/kho?chuyen=TRIP-…`). Trùng màn chính của vai trò thì thoát là đăng xuất; khác thì
   * về màn chính (`exitAction`).
   */
  screenHome: string
  /** Trang đã mở màn này, ví dụ chi tiết chuyến — chỉ vai trò xem được chuyến quay về đó (`exitAction`). */
  contextual?: string
}

/** Thoát theo vai trò đang đăng nhập (`exitAction`): đăng xuất ở màn chính của vai trò, còn lại quay về trang phù hợp. */
function useExit({ screenHome, contextual }: ExitTarget) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const action = user ? exitAction(user.role, screenHome, contextual) : { kind: 'link' as const, to: '/dang-nhap' }
  async function handleSignOut() {
    await signOut()
    void navigate('/dang-nhap', { replace: true })
  }
  return { action, handleSignOut }
}

/** Nút thoát cỡ cảm ứng ở thanh trên của màn toàn màn hình. */
export function ExitIconButton({ label, className, iconClassName, tone = 'light', ...target }: ExitTarget & {
  /** `sky`: nút đặc trên dải trời (kho, V2.3 đợt 6); mặc định nền sáng. */
  tone?: 'light' | 'sky'
  /** Nhãn khi thoát là quay về trang khác, ví dụ "Thoát phiên xếp hàng". */
  label: string
  className?: string
  iconClassName?: string
}) {
  const t = useT()
  const { action, handleSignOut } = useExit(target)
  const classes = cn(
    'grid size-14 flex-none place-items-center rounded-md transition-colors duration-(--dur-fast) ease-standard focus-visible:outline-2 focus-visible:outline-offset-2',
    tone === 'sky'
      ? 'border border-sky-solid-border bg-sky-solid text-sky-text hover:bg-sky-solid-hover focus-visible:outline-cyan-300'
      : 'text-text-2 hover:bg-surface focus-visible:outline-primary',
    className,
  )
  if (action.kind === 'signOut') {
    return (
      <button type="button" aria-label={t('nav.signOut')} onClick={() => void handleSignOut()} className={classes}>
        <LogOut className={iconClassName} strokeWidth={2} aria-hidden />
      </button>
    )
  }
  return (
    <Link to={action.to} aria-label={label} className={classes}>
      <ChevronLeft className={iconClassName} strokeWidth={2} aria-hidden />
    </Link>
  )
}
