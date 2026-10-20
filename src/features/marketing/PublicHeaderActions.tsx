import { LayoutDashboard, LogIn, MessageSquareText } from 'lucide-react'
import { Link } from 'react-router'
import { LanguageMenu } from '@/components/LanguageMenu'
import { SKY_FOCUS } from '@/components/sky-focus'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/AuthProvider'
import { landingPath } from '@/features/auth/landing'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { CONTACT_LINK, PUBLIC_TOUCH } from './public-chrome'
import { PublicNavMenu } from './PublicNavMenu'

/** Biểu tượng trong nút 56 px của máy cảm ứng lên 20 px (nút 40 px giữ 16 px của `Button`). */
const TOUCH_ICON = 'pointer-coarse:[&_svg]:size-5'

/** Dưới 390 px trên máy cảm ứng, nút Liên hệ chỉ còn biểu tượng (vuông 56 px); chuột có nút 40 px nên vẫn đủ chỗ cho chữ. */
const ICON_ONLY_NARROW_TOUCH = 'max-[389px]:pointer-coarse:aspect-square max-[389px]:pointer-coarse:px-0'

/**
 * Phần phải của đầu trang công khai: "Liên hệ" gọn (dưới 1.024 px — từ đó hàng điều hướng đã có mục Liên hệ), ngôn ngữ (nút quả địa
 * cầu ở mọi bề rộng), "Đăng nhập" / "Vào ứng dụng" và nút menu (dưới 1.024 px). Mọi nút là kính trên dải trời — nút chính của trang nằm
 * ở phần mở đầu. Điện thoại hẹp không đủ chỗ cho chữ của mọi nút cạnh nhau (năm vùng chạm 56 px): dưới 480 px "Đăng nhập" chỉ còn biểu
 * tượng, dưới 390 px trên máy cảm ứng "Liên hệ" cũng vậy; chữ vẫn là tên truy cập (`sr-only`), nên tên nút không đổi theo bề rộng.
 */
export function PublicHeaderActions() {
  const t = useT()
  const { user } = useAuth()
  const SignInIcon = user ? LayoutDashboard : LogIn

  return (
    <div className="ml-auto flex flex-none items-center gap-1.5 min-[400px]:gap-2 md:gap-3">
      <Button
        asChild
        variant="glass"
        className={cn(PUBLIC_TOUCH, SKY_FOCUS, TOUCH_ICON, 'gap-1.5 px-3 lg:hidden', ICON_ONLY_NARROW_TOUCH)}
      >
        <Link to={CONTACT_LINK.to}>
          <MessageSquareText aria-hidden strokeWidth={1.5} />
          <span className="max-[389px]:pointer-coarse:sr-only">{t(CONTACT_LINK.labelKey)}</span>
        </Link>
      </Button>
      <LanguageMenu className="size-10 pointer-coarse:size-14" itemClassName={PUBLIC_TOUCH} />
      <Button asChild variant="glass" className={cn(PUBLIC_TOUCH, SKY_FOCUS, TOUCH_ICON, 'max-[479px]:aspect-square max-[479px]:px-0')}>
        <Link to={user ? landingPath(user.role) : '/dang-nhap'}>
          <SignInIcon aria-hidden strokeWidth={1.5} className="min-[480px]:hidden" />
          <span className="max-[479px]:sr-only">{user ? t('landingChrome.openApp') : t('landingChrome.signIn')}</span>
        </Link>
      </Button>
      <PublicNavMenu className="lg:hidden" />
    </div>
  )
}
